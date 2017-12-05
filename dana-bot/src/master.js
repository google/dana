/*
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";
/* eslint require-jsdoc: "off" */
/* eslint new-cap: "off" */

var globalMaster = {
  debug: false,
  Q: {},
  QSeqId: undefined,
  QSeqTimer: undefined,
  QId: 1,
  QBroadcastId: 1,
  QBroadcast: {},
  config: undefined,
  syncProjectAck: undefined,
  syncProjectState: undefined
};

// elt contains
//        user: user
//        QUId: QUId,
//        requires: can be undefined or have alone (true/false) 'sys' or 'runnerId' property
//        module: moduleName,
//        option: option,
//        broadcast : false/true, to run to all connected runners or not
// After, globalMaster.QId and globalMaster.QBroadcastId
function QAddOne(elt) {
  function addOne(e) {
    var elt = {
      QId: globalMaster.QId,
      service: 'service',
      QUId: e.QUId,
      requires: e.requires,
      module: e.module,
      option: e.option,
      broadcast: e.broadcast,
      QBroadcastId: e.QBroadcastId
    };
    globalMaster.Q.waiting[globalMaster.QId] = elt;
    globalMaster.QId++;
    QDump('QAddOne Entry');
    QSchedule();
    QDump('QAddOne Exit');
    return globalMaster.QId - 1;
  }

  if (elt.broadcast) {
    var k = Object.keys(globalMaster.config.runners);
    elt.QBroadcastId = globalMaster.QBroadcastId;
    globalMaster.QBroadcast[globalMaster.QBroadcastId] = {
      numRunners: k.length,
      result: [],
      timer: []
    };
    globalMaster.QBroadcastId++;
    for (var ii = 0; ii < k.length; ii++) {
      if (elt.requires === undefined) {
        elt.requires = {
          runnerId: k[ii]
        };
      } else {
        elt.requires = {
          alone: true,
          runnerId: k[ii]
        };
      }
      addOne(elt);
    }
  } else {
    addOne(elt);
  }
}

function QReset() {
  globalMaster.Q = {
    waiting: {},
    running: {}
  };
}

function QDump(info) {
  if (!globalMaster.debug) return;
  var keysQw = Object.keys(globalMaster.Q.waiting);
  var keysQr = Object.keys(globalMaster.Q.running);
  if (globalMaster.debug)
    console.log('MASTER QDump', info, '(Waiting', keysQw, 'Running', keysQr, ')');
}

// affect a run in waitingQ taking requires constraints
// requires can be 'alone' (true/false, 'runnerId', or 'sys')
function QSchedule() {
  var ii;
  var keysQ = Object.keys(globalMaster.Q.waiting);
  var keysRunners = Object.keys(globalMaster.config.runners);

  for (ii = 0; ii < keysQ.length; ii++) {
    var jj;
    var QId = keysQ[ii];
    var elt = globalMaster.Q.waiting[QId];

    /*

     console.log('QSchedule looking to', JSON.stringify(elt));
    console.log('globalMaster.Q.waiting', JSON.stringify(globalMaster.Q.waiting));
    console.log('QId', JSON.stringify(QId));
    */

    // compute runner subset candidate to placements
    var rset = keysRunners;

    if (elt.requires === undefined) {
      console.log('ERROR QSchedule, elt.requires==undefined', elt);
      return;
    }

    if (elt.requires.runnerId !== undefined)
      rset = [elt.requires.runnerId];

    if (elt.requires.sys !== undefined) {
      var tset = [];
      for (jj = 0; jj < rset.length; jj++) {
        if (globalMaster.config.runners[rset[jj]].config.sys ===
          elt.requires.sys)
          tset.push(rset[jj]);
      }
      rset = tset;
    }
    if (rset.length === 0) {
      console.log('ERROR: rset is empty');
      console.log('elt:', elt);
      console.log('globalMaster.config.runners:', JSON.stringify(globalMaster.config.runners, null, 4));
      console.log('globalMaster:', JSON.stringify(globalMaster, null, 4));
      return;
    }

    // console.log('QSchedule runnerSet is', JSON.stringify(rset));

    // no constraints, select first available
    var found;
    if (elt.requires.alone) {
      found = false;
      for (jj = 0; jj < rset.length; jj++) {
        if (globalMaster.config.runners[rset[jj]].running === 0) {
          // console.log('QSchedule found', rset[jj]);
          QRun(QId, rset[jj]);
          found = true;
          break;
        }
      }
      if (!found)
        return;
    } else {
      found = false;
      for (jj = 0; jj < rset.length; jj++) {
        if (globalMaster.config.runners[rset[jj]].running <
          globalMaster.config.runners[rset[jj]].config.cpu) {
          // console.log('QSchedule found', rset[jj]);
          QRun(QId, rset[jj]);
          found = true;
          break;
        }
      }
      if (!found)
        return;
    }
  }
}

// elt is in waitingQ, goes in runningQ
function QRun(QId, runnerId) {
  if (globalMaster.debug)
    console.log('QRun', QId, runnerId);
  globalMaster.Q.waiting[QId].runnerId = runnerId;
  var job = {
    QId: QId,
    module: globalMaster.Q.waiting[QId].module,
    option: globalMaster.Q.waiting[QId].option
  };
  globalMaster.config.runners[runnerId].instance.runnerRunJob(runnerId, job);
  globalMaster.config.runners[runnerId].running++;
  globalMaster.Q.running[QId] = globalMaster.Q.waiting[QId];
  delete globalMaster.Q.waiting[QId];
}

// elt is in runningQ, send back to requester, delete from jobQ
function QNotifEnd(job) {
  if (globalMaster.debug)
    console.log('MASTER QNotifEnd job', job);

  if (globalMaster.debug)
    console.log('MASTER QNotifEnd runners config', JSON.stringify(globalMaster.config.runners, null, 0));

  if (globalMaster.debug)
    console.log('MASTER QNotifEnd globalMaster.Q', JSON.stringify(globalMaster.Q, null, 0));

  // globalMaster.config.runners[socket.name].running--;

  QDump('QNotifEnd Entry');

  var QId = job.QId;
  var elt = globalMaster.Q.running[QId];
  var send = true;
  var result = job.result;
  var timer = job.timer;

  if (globalMaster.debug)
    console.log('QNotifEnd runners elt', elt);

  globalMaster.config.runners[elt.runnerId].running--;

  if (elt.broadcast) {
    // console.log('QNotifEnd', globalMaster.QBroadcast)

    globalMaster.QBroadcast[elt.QBroadcastId].numRunners--;
    globalMaster.QBroadcast[elt.QBroadcastId].result.push(job.result);
    globalMaster.QBroadcast[elt.QBroadcastId].timer.push(job.timer);
    if (globalMaster.QBroadcast[elt.QBroadcastId].numRunners === 0) {
      result = globalMaster.QBroadcast[elt.QBroadcastId].result;
      timer = globalMaster.QBroadcast[elt.QBroadcastId].timer;
      delete globalMaster.QBroadcast[elt.QBroadcastId];
    } else
      send = false;
  }

  if (send) {
    var answer = {
      QUId: elt.QUId,
      timer: timer,
      result: result,
      runnerId: elt.runnerId
    };
    // console.log('QNotifEnd Entry', JSON.stringify(answer, null, 4))
    globalMaster.config.service.serviceNotifyEnd(answer);
  }

  delete globalMaster.Q.running[QId];

  QSchedule();

  QDump('QNotifEnd Exit');
}

function setConfig(config) {

  console.log('setConfig', JSON.stringify(config, null, 4));

  if (config === undefined)
    return 'Master unable to set config - master missing';

  if (config.master === undefined)
    return 'Master unable to set config - master missing';

  if (config.service === undefined)
    return 'Master unable to set config - service missing';

  if (config.user === undefined)
    return 'Master unable to set config - user missing';

  if (config.runners === undefined)
    return 'Master unable to set config - runners missing';

  globalMaster.config = config;
  var k = Object.keys(globalMaster.config.runners);
  for (var ii = 0; ii < k.length; ii++) {
    globalMaster.config.runners[k[ii]].running = 0;
  }
  QReset();
  return undefined;
}

function userCommand(argv) {
  if (globalMaster.debug)
    console.log('userCommand', argv);
  globalMaster.config.service.serviceCommand(argv);
}

function userGetCommandList() {
  if (globalMaster.debug)
    console.log('userGetCommandList');
  globalMaster.config.service.serviceGetCommandList();
}

function userSyncProject(repository) {
  if (globalMaster.debug)
    console.log('userSyncProject', repository);
  var k = Object.keys(globalMaster.config.runners);
  globalMaster.syncProjectAck = 1 + k.length;
  globalMaster.syncProjectState = [];
  globalMaster.config.service.serviceSyncProject(repository);
  for (var ii = 0; ii < k.length; ii++) {
    globalMaster.config.runners[k[ii]].instance.runnerSyncProject(k[ii],
      repository);
  }
}

module.exports.setConfig = setConfig;
module.exports.userCommand = userCommand;
module.exports.userSyncProject = userSyncProject;
module.exports.userGetCommandList = userGetCommandList;

// use by runner
function runnerRunJobEnd(job) {
  if (globalMaster.debug)
    console.log('runnerJobRunEnd', job);
  QNotifEnd(job);
}

function runnerSyncProjectEnd(result) {
  if (globalMaster.debug)
    console.log('runnerSyncProjectEnd', result, globalMaster.syncProjectAck);
  globalMaster.syncProjectState.push(result);
  globalMaster.syncProjectAck--;
  if (globalMaster.syncProjectAck === 0)
    globalMaster.config.user.userSyncProjectEnd(globalMaster.syncProjectState);
}

module.exports.runnerRunJobEnd = runnerRunJobEnd;
module.exports.runnerSyncProjectEnd = runnerSyncProjectEnd;

// use by service
function serviceCommandList(commands) {
  if (globalMaster.debug)
    console.log('serviceCommandList', commands);
  globalMaster.config.user.userCommandList(commands);
}

function serviceSyncProjectEnd(result) {
  if (globalMaster.debug)
    console.log('serviceSyncProjectEnd', result, globalMaster.syncProjectAck);
  globalMaster.syncProjectState.push(result);
  globalMaster.syncProjectAck--;
  if (globalMaster.syncProjectAck === 0)
    globalMaster.config.user.userSyncProjectEnd(globalMaster.syncProjectState);
}

function serviceCommandEnd(obj) {
  // obj contains str
  if (globalMaster.debug)
    console.log('serviceCommandEnd', obj);
  globalMaster.config.user.userCommandEnd(obj);
}

function serviceRunEnd(obj) {
  // obj contains name and patch
  if (globalMaster.debug)
    console.log('serviceRunEnd', obj);
  globalMaster.config.user.userRunEnd(obj);
}

function serviceRunStart(obj) {
  if (globalMaster.debug)
    console.log('serviceRunStart', obj);
  globalMaster.config.user.userRunStart(obj);
}

function serviceSequenceStart(obj) {
  // obj contains info and maxSamples
  if (globalMaster.debug)
    console.log('serviceSequenceStart', obj);
  globalMaster.config.user.userSequenceStart(obj);
}

function serviceSequenceEnd(obj) {
  // obj contains info and time
  if (globalMaster.debug)
    console.log('serviceSequenceEnd', obj);
  globalMaster.config.user.userSequenceEnd(obj);
}

function serviceQAddOne(elt) {
  if (globalMaster.debug)
    console.log('serviceQAddOne', elt);
  QAddOne(elt);
}

function serviceSerie(serie) {
  if (globalMaster.debug)
    console.log('serviceSerie', JSON.stringify(serie));
  globalMaster.config.user.userSerie(serie);
}

module.exports.serviceCommandList = serviceCommandList;
module.exports.serviceSyncProjectEnd = serviceSyncProjectEnd;
module.exports.serviceCommandEnd = serviceCommandEnd;
module.exports.serviceRunEnd = serviceRunEnd;
module.exports.serviceRunStart = serviceRunStart;
module.exports.serviceSequenceStart = serviceSequenceStart;
module.exports.serviceSequenceEnd = serviceSequenceEnd;
module.exports.serviceQAddOne = serviceQAddOne;
module.exports.serviceSerie = serviceSerie;
