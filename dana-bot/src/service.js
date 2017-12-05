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

var fs = require('fs');
var util = require('util');
var cwd = process.cwd();
var run = require(cwd + '/src/run');
var git = require(cwd + '/src/git');
var butils = require(cwd + '/src/utils');

var globalService = {
  debug: false,
  config: undefined,
  useGit: true,
  tmpPath: cwd + '/tmp/service.tmp',
  repoPath: cwd + '/tmp/service.repo',
  stateCommand: undefined,
  currentCommand: undefined,
  projectBot: undefined,
  repository: undefined,
  Q: undefined,
  QId: undefined,
  QUId: undefined,
  QSeqTimer: undefined,
  QSequence: {},
  QNumSequence: undefined,
  QTimeTag: undefined
};

if (!fs.existsSync(cwd + '/tmp'))
  fs.mkdirSync(cwd + '/tmp');

if (!fs.existsSync(globalService.tmpPath))
  fs.mkdirSync(globalService.tmpPath);

if (!fs.existsSync(globalService.repoPath))
  fs.mkdirSync(globalService.repoPath);

var defaultServiceCommands = {};

var theService = {
  addAll: QAddAll,
  addOne: QAddOne,
  start: QStart,
  end: QEnd,
  sync: QSync,
  endRun: QEndRun,
  startRun: startRun,
  checkAllTestsPassing: checkAllTestsPassing,
  endCommand: endCommand
};

function QReset() {
  globalService.Q = {
    running: {},
    done: {},
    sync: {
      pending: false,
      hdl: undefined
    }
  };
  globalService.QId = 0;
  globalService.QSeqTimer = undefined;
  globalService.QUId = 1;
  globalService.QSequence = {};
  globalService.QNumSequence = undefined;
  globalService.QTimeTag = Date.now();
}

function checkAllTestsPassing(series) {
  var success = true;
  var k = Object.keys(series);
  for (var ii = 0; ii < k.length; ii++) {
    var s = series[k[ii]].result;
    if (util.isArray(s)) {
      for (var jj = 0; jj < s.length; jj++) {
        if (!s[jj].sample.passing) {
          success = false;
          if (globalService.debug) console.log('SERVICE', 'ARRAY NOT PASSING', s[jj]);
        }
      }
    } else if (!s.sample.passing) {
      success = false;
      if (globalService.debug) console.log('SERVICE', 'NOT PASSING', s);
    }
  }
  return success;
}

function endCommand(str) {
  globalService.config.master.serviceCommandEnd({
    command: globalService.currentCommand[0],
    str: str
  });
}

function startRun(numSequences, hdl) {
  // reset all Queues for this Run
  QReset();
  globalService.QNumSequence = numSequences;

  // HACK removed but need to validate
  if (globalService.repository === undefined) {
    hdl('nodeCiBot - startRun no repository set');
  }

  /*
  if (globalService.repository.patch === undefined) {
    hdl('startRun, please do a syncProject() before');
    return;
  }
  */
  globalService.config.master.serviceRunStart({
    command: globalService.currentCommand[0],
    repository: globalService.repository
  });

  hdl(undefined);
}

function QEndRun(ret) {
  QSync(function() {
    globalService.config.master.serviceRunEnd({
      command: globalService.currentCommand[0],
      repository: globalService.repository
    });
    globalService.config.master.serviceCommandEnd({
      command: globalService.currentCommand[0],
      str: globalService.currentCommand[0] + ' - ' + ret
    });
    // REVIEW: need to decide if we authorize only one run/repository at a time
    // globalService.repository = undefined;
  });
}

function QStart(info) {
  globalService.QSeqTimer = run.timer(info);
  globalService.QId++;
  if (globalService.QId > globalService.QNumSequence) {
    console.log('SERVICE', 'WARNING number of sequence is not accurate',
      globalService.QNumSequence);
  }
  globalService.QSequence[globalService.QId] = {
    info: info,
    QId: globalService.QId
  };
  // console.log('SERVICE', globalService.QId, globalService.QSequence);
}

function QEnd(hdl) {
  // console.log('SERVICE', globalService.QId, globalService.QSequence);

  globalService.config.master.serviceSequenceStart({
    command: globalService.currentCommand[0],
    info: globalService.QSequence[globalService.QId].info,
    maxSamples: Object.keys(globalService.Q.running).length
  });

  QSync(function() {
    // console.log('SERVICE', 'QSync END ');
    globalService.QSequence[globalService.QId].time =
      globalService.QSeqTimer.stop();

    globalService.config.master.serviceSequenceEnd({
      command: globalService.currentCommand[0],
      info: globalService.QSequence[globalService.QId].info,
      time: globalService.QSequence[globalService.QId].time
    });

    var series = globalService.Q.done;
    globalService.Q.done = {};
    var success = checkAllTestsPassing(series);

    // REVIEW: check validity
    globalService.stateCommand &= success;

    // console.log('SERVICE', 'QEnd calling hdl', samples)
    hdl(series);
  });
}

// run one command on all.
// broadcast
function QAddAll(module, option, hdl) {
  var mrequires = module.requires;
  if (mrequires === undefined) mrequires = {};
  var elt = {
    QUId: globalService.QUId,
    requires: mrequires,
    module: module.moduleName,
    option: option,
    hdl: hdl,
    broadcast: true
  };
  globalService.Q.running[globalService.QUId] = elt;
  globalService.QUId++;
  globalService.config.master.serviceQAddOne(elt);
  QDump('QAddAll Exit');
  return globalService.QUId - 1;
}

function QAddOne(module, option, requires, hdl) {
  var mrequires = module.requires;
  if (requires !== undefined) {
    var k = Object.keys(requires);
    for (var ii = 0; ii < k.length; ii++) {
      mrequires[k[ii]] = requires[k[ii]];
    }
  }
  if (mrequires === undefined) mrequires = {};
  var elt = {
    QUId: globalService.QUId,
    requires: mrequires,
    module: module.moduleName,
    option: option,
    hdl: hdl,
    broadcast: false
  };
  globalService.Q.running[globalService.QUId] = elt;
  globalService.QUId++;
  if (globalService.debug) console.log('SERVICE', 'Emitting elt', option);
  globalService.config.master.serviceQAddOne(elt);
  QDump('QAddOne Exit');
  return globalService.QUId - 1;
}

function QDump(info) {
  if (globalService.debug) {
    var keysQr = Object.keys(globalService.Q.running);
    var keysQd = Object.keys(globalService.Q.done);
    if (globalService.debug)
      console.log('SERVICE', 'QDump', info, '(Running', keysQr, 'Done', keysQd, ')');
  }
}

// var dumpIndex = 1;

// elt is in runningQ, goes in doneQ
function QNotifEnd(msg) {
  // console.log('SERVICE', 'QNotifEnd', msg);
  // msg contains
  // globalService.QId: globalService.QId,
  // result: result
  QDump('QNotifEnd Entry');

  var QId = msg.QUId;

  if (globalService.Q.running[QId].hdl !== undefined)
    globalService.Q.running[QId].hdl(msg);

  var running = globalService.Q.running[QId];
  delete globalService.Q.running[QId];

  var desc =
    globalService.projectBot.modules[running.module].getSerieDesc(running.option);

  var serie = {
    desc: desc,
    options: running.option,
    result: msg.result
  }

  function add(s) {
    s.module = running.module;
    s.exec = {
      QId: QId,
      requires: running.requires,
      broadcast: running.broadcast,
      timer: msg.timer,
      runnerId: msg.runnerId
    }

    globalService.config.master.serviceSerie(s);

    globalService.Q.done[QId] = s;
  }

  /*
  if (util.isArray(serie)) {
    for (var jj = 0; jj < serie.length; jj++) {
      add(serie[jj])
    }
  } else
  */
  add(serie);

  if (globalService.Q.sync.pending) QSync(globalService.Q.sync.hdl);

  QDump('QNotifEnd Exit');
}

function QSync(hdl) {
  if (globalService.debug)
    console.log('SERVICE', 'QSync Still',
      Object.keys(globalService.Q.running).length, 'to run');
  QDump('QSync');
  if (Object.keys(globalService.Q.running).length !== 0) {
    globalService.Q.sync.pending = true;
    globalService.Q.sync.hdl = hdl;
    return;
  }
  globalService.Q.sync.pending = false;
  hdl();
}

function runCommand(argv) {
  if (!util.isArray(argv)) {
    globalService.config.master.serviceCommandEnd({
      command: argv,
      err: 'Bad command format'
    });
    return;
  }

  var commands;

  if (defaultServiceCommands[argv[0]] !== undefined)
    commands = defaultServiceCommands;

  if (globalService.projectBot !== undefined)
    if (globalService.projectBot.userCommands[argv[0]] !== undefined)
      commands = globalService.projectBot.userCommands;

  if (commands === undefined) {
    globalService.config.master.serviceCommandEnd({
      command: globalService.currentCommand[0],
      err: 'Unknown command'
    });
    return;
  }

  if (globalService.debug) console.log('SERVICE', 'Run command', commands[argv[0]]);
  globalService.currentCommand = argv;
  globalService.stateCommand = true;

  if (commands[argv[0]].args === 0) {
    commands[argv[0]].hdl();
  }
  if (commands[argv[0]].args === 1) {
    commands[argv[0]].hdl(argv[1]);
  }
  if (commands[argv[0]].args === 2) {
    commands[argv[0]].hdl(argv[1], argv[2]);
  }
  if (commands[argv[0]].args === 3) {
    commands[argv[0]].hdl(argv[1], argv[2], argv[3]);
  }
  if (commands[argv[0]].args === 4) {
    commands[argv[0]].hdl(argv[1], argv[2], argv[3], argv[4]);
  }
  if (commands[argv[0]].args === 5) {
    commands[argv[0]].hdl(argv[1], argv[2], argv[3], argv[4], argv[5]);
  }
}

function setUpProjectModules() {
  var projectPath = cwd + '/project';
  globalService.projectBot = require(projectPath + '/commands');

  if (globalService.projectBot === undefined) {
    hdlSend('projectBot undefined in ' + projectPath + '/commands');
    return;
  }

  globalService.projectBot.setup(theService);

  if (globalService.projectBot.modules === undefined) {
    hdlSend('Missing modules in ' + projectPath + '/commands');
    return;
  }
}

function setConfig(config) {
  if (config === undefined)
    return 'Service unable to set config - config undefined';

  if (config.master === undefined)
    return 'Service unable to set config - master missing';

  globalService.config = config;
  setUpProjectModules();
  QReset();
  return undefined;
}

function serviceNotifyEnd(msg) {
  QNotifEnd(msg);
}

function serviceCommand(msg) {
  runCommand(msg);
}

function serviceGetCommandList() {
  var commands = defaultServiceCommands;

  if (globalService.projectBot !== undefined) {
    var k = Object.keys(globalService.projectBot.userCommands);
    for (var ii = 0; ii < k.length; ii++) {
      commands[k[ii]] = globalService.projectBot.userCommands[k[ii]];
    }
  }
  globalService.config.master.serviceCommandList(commands);
}

function getResult(error, stdout, stderr) {
  if (error === undefined)
    return {
      sample: {
        passing: true
      }
    };

  return {
    sample: {
      passing: false
    },
    logs: {
      error: error,
      stdout: stdout,
      stderr: stderr
    }
  };
}

function serviceSyncProject(repository) {
  function hdlSend(error, stdout, stderr) {
    globalService.config.master.serviceSyncProjectEnd(
      getResult(error, stdout, stderr));
  }

  function endGitSync() {
    globalService.repository = repository;
    hdlSend();
  }

  // It's a new syncProject, so we delete tmp dir
  butils.deleteDirectory(globalService.tmpPath);

  if (repository === undefined) {
    hdlSend('Service ' +
      ' Missing repository  property, cannot syncProject');
    return;
  }
  if (repository.name === undefined) {
    hdlSend('Service ' +
      ' Missing repository name property, cannot syncProject');
    return;
  }
  if (repository.git === undefined) {
    hdlSend('Service ' +
      ' Missing repository git property, cannot syncProject');
    return;
  }
  if (repository.git.url === undefined) {
    hdlSend('Service ' +
      ' Missing repository git.url property, cannot syncProject');
    return;
  }
  if (repository.patch === undefined) {
    hdlSend('Service ' +
      ' Missing repository patch property, cannot syncProject');
    return;
  }

  if (globalService.useGit) {
    // CLONE the git repository if missing
    var repoName = repository.name;
    git.clone({
      repository: globalService.repoPath,
      name: repoName,
      url: repository.git.url
    }, function(err, stdout, stderr) {
      if (err) {
        hdlSend(err, 'Service ' + stdout, stderr);
        return;
      }
      git.sync({
        repository: globalService.repoPath,
        name: repository.name,
        patch: repository.patch
      }, function(err, stdout, stderr) {
        if (err) {
          hdlSend(err, 'Service ' + stdout, stderr);
          return;
        }
        endGitSync();
      });
    });
  } else
    endGitSync();
}

module.exports.setConfig = setConfig;
module.exports.serviceNotifyEnd = serviceNotifyEnd;
module.exports.serviceCommand = serviceCommand;
module.exports.serviceSyncProject = serviceSyncProject;
module.exports.serviceGetCommandList = serviceGetCommandList;
