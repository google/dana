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
/* eslint guard-for-in: "off" */

var cwd = process.cwd();

var fs = require('fs');
var util = require('util');
var AsciiTable = require('ascii-table');
var htmlBuilder = require(cwd + '/src/htmlBuilder');
var www = require(cwd + '/src/www');
var logger = require(cwd + '/src/logger').getLogger();
var moduleRun = require('./run')


var globalBot = {
  version: undefined,
  updateAvailable: false,
  tmpPath: cwd + '/tmp/bot.tmp',
  repoPath: cwd + '/tmp/bot.repo',
  spongePath: cwd + '/www/public/sponge',
  buildPath: cwd + '/configs/builds',
  projectBot: undefined,
  debug: false,
  config: undefined,
  currentRun: undefined,
  QTimeTag: undefined,
  repositories: undefined,
  tasks: undefined,
  state: "inactive", // can be active or stopping
  QId: 1,
  Q: {},
  limitPatches: 10,
  running: undefined,
  tickInterval: 60, // 60 for one minute
  tickTimer: undefined,
  taskTicks: {},
  builds: {},
  users: undefined
};

/*
* Element:
*   "<taskName>": {
*      currentTot: "<hash>"
*   }
*      
*/
var tasksCurrentTot = {}

globalBot.version = JSON.parse(fs.readFileSync(cwd + '/package.json')).version;

if (!fs.existsSync(cwd + '/tmp'))
  fs.mkdirSync(cwd + '/tmp');

if (!fs.existsSync(globalBot.tmpPath))
  fs.mkdirSync(globalBot.tmpPath);

if (!fs.existsSync(globalBot.spongePath))
  fs.mkdirSync(globalBot.spongePath);

if (!fs.existsSync(globalBot.buildPath))
  fs.mkdirSync(globalBot.buildPath);

if (!fs.existsSync(globalBot.tmpPath + '/tasks'))
  fs.mkdirSync(globalBot.tmpPath + '/tasks');

var gitForBot = require(cwd + '/src/gitForBot');
var sendMail = require(cwd + '/src/sendMail');

if (!fs.existsSync(globalBot.repoPath))
  fs.mkdirSync(globalBot.repoPath);

gitForBot.setRepoPath(globalBot.repoPath);

function loadContext() {
  var d;
  var e;
  if (fs.existsSync(cwd + '/configs/tasks.js')) {
    d = fs.readFileSync(cwd + '/configs/tasks.js');
    e = JSON.parse(d);
    var keys = Object.keys(e);
    for (var ii = 0; ii < keys.length; ii++) {
      if (e[keys[ii]].name === undefined)
        e[keys[ii]].name = keys[ii];
      else
      if (e[keys[ii]].name !== keys[ii]) {
        console.log("loadContext -- ERROR - invalid tasks.js - names and keys dont match");
        console.log("loadContext", e[keys[ii]].name, keys[ii]);
        process.exit(1);
      }
    }
    globalBot.tasks = e;
  } else
    globalBot.tasks = {};

  // load repositories
  if (fs.existsSync(cwd + '/configs/repositories.js')) {
    d = fs.readFileSync(cwd + '/configs/repositories.js');
    e = JSON.parse(d);
    var keys = Object.keys(e);
    for (var ii = 0; ii < keys.length; ii++) {
      if (e[keys[ii]].name === undefined)
        e[keys[ii]].name = keys[ii];
      else
      if (e[keys[ii]].name !== keys[ii]) {
        console.log("loadContext -- ERROR - invalid repositories.js - names and keys dont match");
        console.log("loadContext", e[keys[ii]].name, keys[ii]);
        process.exit(1);
      }
    }
    globalBot.repositories = e;
  } else
    globalBot.repositories = {};

  var keys = Object.keys(globalBot.tasks);
  for (var ii = 0; ii < keys.length; ii++) {
    if (globalBot.repositories[globalBot.tasks[keys[ii]].repository] === undefined) {
      console.log("loadContext -- ERROR - task repository is invalid");
      console.log("loadContext", tasks[keys[ii]], repositories);
      process.exit(1);
    }
  }
}
loadContext();

//
// Support for git monitoring, tasks and Q management
//

function internalRunStart(argv) {
  globalBot.QTimeTag = Date.now();
  var spongePath = globalBot.spongePath + '/' +
    globalBot.QTimeTag;

  if (fs.existsSync(spongePath)) {
    console.log('nodeCiBot', 'ERROR - Sponge directory already exist ' + spongePath);
    return;
  }
  fs.mkdirSync(spongePath);

  globalBot.config.master.userCommand(argv);
}

function endRunEmitMail() {
  // check and create folders used by the tasks
  if (!fs.existsSync(globalBot.tmpPath + '/tasks/' + globalBot.running.task))
    fs.mkdirSync(globalBot.tmpPath + '/tasks/' + globalBot.running.task);

  var status = 'SUCCESS';
  var color = 'background-color:rgb(0,228,118)';

  if (globalBot.currentRun.numFailing !== 0) {
    status = 'FAILED';
    color = "background-color:rgb(234,153,153)";
  }

  // do the history
  htmlBuilder.bodyReset();

  htmlBuilder.bodyTableStart();

  var link = '<a href=http://' +
    globalBot.config.configBot.ip + ':' +
    globalBot.config.configBot.port +
    '/tasks/' + globalBot.running.task + '/' + globalBot.running.buildId +
    '.report.html>Report</a>';

  htmlBuilder.bodyTableTdStyleProp([{
    txt: globalBot.running.task,
    style: color
  }, {
    txt: globalBot.running.buildId,
    style: color
  }, {
    txt: globalBot.running.repository,
    style: color
  }, {
    txt: globalBot.running.patch,
    style: color
  }, {
    txt: "<b>" + status + "</b>",
    style: color
  }, {
    txt: '<b>Failing: ' + globalBot.currentRun.numFailing + '</b>'
  }, {
    txt: globalBot.running.infos[0].abbrevHash
  }, {
    txt: globalBot.running.infos[0].subject
  }, {
    txt: globalBot.running.infos[0].authorEmail
  }, {
    txt: link
  }]);

  htmlBuilder.bodyTableEnd();

  /* EMAIL */
  var subject = '[' + globalBot.config.configBot.system + ']' + '[' + globalBot.running.task + ']';
  subject += ' ';
  subject += 'BuildId ' + globalBot.running.buildId + ' - ';
  if (globalBot.currentRun.numFailing === 0) {
    subject += 'All tests passing :)';
  } else {
    subject += globalBot.currentRun.numFailing + ' tests failing :(';
  }

  htmlBuilder.bodyReset();

  htmlBuilder.bodyTableStart();

  htmlBuilder.bodyTableTd([
    'System',
    '<b>' + globalBot.config.configBot.system + '<b>'
  ]);
  htmlBuilder.bodyTableTd([
    'Task Run',
    '<b>' + globalBot.running.task + '<b>'
  ]);
  htmlBuilder.bodyTableTd([
    'BuildId',
    '<b>' + globalBot.running.buildId + '<b>'
  ]);

  htmlBuilder.bodyTableTdStyle(['<b>STATUS</b>', '<b>' + status + '</b>'],
    color);

  htmlBuilder.bodyTableTd([
    '<b>Number of Tests Failing</b>',
    '<b>' + globalBot.currentRun.numFailing + '</b>'
  ]);

  htmlBuilder.bodyTableEnd();

  htmlBuilder.bodyH4('Build Infos');

  htmlBuilder.bodyTableStart();

  htmlBuilder.bodyTableTd([
    'Author',
    globalBot.running.infos[0].authorName + ' (' + globalBot.running.infos[0].authorEmail + ')'
  ]);
  htmlBuilder.bodyTableTd([
    'Subject',
    globalBot.running.infos[0].subject
  ]);
  htmlBuilder.bodyTableTd([
    'Hash',
    globalBot.running.infos[0].hash
  ]);
  htmlBuilder.bodyTableTd([
    'Links',
    '<a href=https://android.git.corp.google.com/toolchain/jack/+/' + globalBot.running.infos[0].hash + '>Git log on android.git.corp.google.com</a>'
  ]);
  htmlBuilder.bodyTableEnd();

  var ii;
  var jj;

  if (globalBot.currentRun.numFailing !== 0) {
    htmlBuilder.bodyH4('Failing tests');
    htmlBuilder.bodyTableStart();
    htmlBuilder.bodyTableTh(['Num', 'Desc', 'Options', 'Log']);

    for (ii = 0; ii < globalBot.currentRun.failingSeries.length; ii++) {
      var serie = globalBot.currentRun.failingSeries[ii];

      var desc = '';
      var kdesc = Object.keys(serie.desc);
      for (jj = 0; jj < kdesc.length; jj++)
        desc += kdesc[jj] + ': ' + serie.desc[kdesc[jj]] + '<br>';

      var options = '';
      var koptions = Object.keys(serie.options);
      for (jj = 0; jj < koptions.length; jj++)
        options += koptions[jj] + ': ' + serie.options[koptions[jj]] + '<br>';

      htmlBuilder.bodyTableTd([
        ii,
        desc,
        options,
        '<a href=http://' +
        globalBot.config.configBot.ip + ':' +
        (globalBot.config.configBot.port) +
        '/sponge/' + globalBot.QTimeTag + '/' +
        serie.exec.QId + '.txt>Link</a>'
      ]);
    }

    htmlBuilder.bodyTableEnd();
  }

  htmlBuilder.bodyH4('Run details');

  htmlBuilder.bodyTableStart();

  htmlBuilder.bodyTableTh([
    'Test sequence',
    'Num series',
    'Num runs',
    'Num failing',
    'Sequence time'
  ]);
  for (ii = 0; ii < globalBot.currentRun.numSequences; ii++) {
    var s = globalBot.currentRun.sequences[ii + 1];
    htmlBuilder.bodyTableTd([
      s.info,
      s.maxSamples,
      s.numSeries,
      s.numFailing,
      s.timer + ' ms (' + (s.timer / 1000 / 60).toFixed(2) + ' min)'
    ]);
  }
  htmlBuilder.bodyTableTdStyle(['Overall',
      globalBot.currentRun.maxSamples,
      globalBot.currentRun.numSeries,
      globalBot.currentRun.numFailing,
      globalBot.currentRun.timer + ' ms (' + (globalBot.currentRun.timer / 1000 / 60).toFixed(2) + ' min)'
    ],
    'background-color:rgb(192,192,192)');

  htmlBuilder.bodyTableEnd();

  htmlBuilder.bodyH4('Links');

  htmlBuilder.bodyTableStart();
  htmlBuilder.bodyTableTd([
    'Current status of nodeCiBot',
    '<a href=http://' +
    globalBot.config.configBot.ip + ':' +
    (globalBot.config.configBot.port) +
    '/bot/status>Status</a>'
  ]);
  htmlBuilder.bodyTableEnd();

  htmlBuilder.bodyPar('<i>-- Your dana-bot</i>');

  var report = htmlBuilder.bodyGet();

  fs.writeFileSync(
    globalBot.tmpPath + '/tasks/' + globalBot.running.task + '/' + globalBot.running.buildId + '.report.html',
    report
  );

  // send notification email when at least one test is failing
  if (globalBot.currentRun.numFailing !== 0) {
    var notifier = globalBot.tasks[globalBot.running.task].notify;
    if (notifier !== '') {
      //sendMail.sendMail(globalBot.running.infos[0].authorEmail, notifier, subject, report);
      sendMail.sendMail(notifier, '', subject, report);
    }
  }
}

function internalGitFetch(repoName) {
  if (!fs.existsSync(globalBot.repoPath + '/' + repoName)) {
    logger.debug('internalGitFetch -- Cloning repo');
    gitForBot.clone();
  }

  logger.debug('internalGitFetch -- Fetching repo');
  gitForBot.fetch();
}

function internalCheckTasks() {
  logger.debug('internalCheckTasks');

  // check tick for all tasks
  // if 0, then insertIt in the Q
  // if hour, check if we are in the hour
  var today = new Date();
  var currentMtime = today.getMinutes() + today.getHours() * 60;
  var taskList = {};
  var tName;
  var t;
  var ii;
  var k = Object.keys(globalBot.tasks);
  var tasksInfos = {};
  for (ii in k) {
    tName = k[ii];
    t = globalBot.tasks[tName];
    if (!t.active) continue;
    if (t.period.tick) {
      if (globalBot.taskTicks[tName] === undefined) {
        globalBot.taskTicks[tName] = t.period.tick;
      }
      globalBot.taskTicks[tName]--;
      if (globalBot.taskTicks[tName] === 0) {
        taskList[tName] = true;
        globalBot.taskTicks[tName] = t.period.tick;
      }
    }
    if (t.period.fixedTime) {
      if (globalBot.taskTicks[tName] === undefined) {
        var tt = t.period.fixedTime.split(':');
        var taskMtime = Number(tt[1]) + Number(tt[0]) * 60;
        if (taskMtime === currentMtime) {
          taskList[tName] = true;
          globalBot.taskTicks[tName] = 24 * 60;
        }
        if (taskMtime > currentMtime) {
          globalBot.taskTicks[tName] = taskMtime - currentMtime;
        } else {
          globalBot.taskTicks[tName] = (24 * 60 - currentMtime) + taskMtime;
        }
        if (globalBot.debug) console.log('globalBot.taskTicks[tName]', globalBot.taskTicks[tName]);
      } else {
        globalBot.taskTicks[tName]--;
        if (globalBot.taskTicks[tName] === 0) {
          taskList[tName] = true;
          globalBot.taskTicks[tName] = (24 * 60);
        }
        if (globalBot.debug) console.log('globalBot.taskTicks[tName]', globalBot.taskTicks[tName]);
      }
    }
  }

  if (globalBot.debug) console.log('checking tasks')
  // for all repositories to monitor
  k = Object.keys(taskList);
  for (ii in k) {
    var patches = [];
    tName = k[ii];
    t = globalBot.tasks[tName];
    if ((t.active) && (t.base !== undefined)) {
      if (globalBot.debug) console.log('setRepo')
      gitForBot.setRepo(globalBot.repositories[t.repository]);
      if (globalBot.debug) console.log('internalGitFetch')
      internalGitFetch(t.repository);
      if (globalBot.debug) console.log('getRemoteToT')
      var remoteTot = gitForBot.getRemoteToT(t.branch);

      if (tasksCurrentTot[tName] === undefined
           || tasksCurrentTot[tName].currentTot === undefined) {
        tasksCurrentTot[tName] = { currentTot: t.base };
      }

      if (remoteTot !== tasksCurrentTot[tName].currentTot) {
        if (globalBot.debug) console.log('repoResetHard')
        gitForBot.repoResetHard(remoteTot);
        if (globalBot.debug) console.log('getRepoToT')
        var repoTot = gitForBot.getRepoToT();        
        if (t.mode === "patch") {
          let iterCommit = repoTot;
          while (iterCommit !== tasksCurrentTot[tName].currentTot && patches.length < globalBot.limitPatches) {
            patches.push(iterCommit);
            if (globalBot.debug) console.log('repoResetHardPrevious')
            iterCommit = gitForBot.repoResetHardPrevious();
          }
        } else
        if (t.mode === "patchSet") {
          if (repoTot !== t.base) {
            patches.push(repoTot);
          }
        } else
          console.log('nodeCiBot', 'ERROR mode is invalid', t.mode);
        if (globalBot.debug) console.log('patches computed', patches.length)

        for (var jj in patches) {
          if (globalBot.debug) console.log('getBuildId', jj)
          var bId = gitForBot.getBuildId(patches[jj]);
          if (globalBot.debug) console.log('getPatchInfo', jj)
          var pInfo = gitForBot.getPatchInfo(patches[jj]);

          if (t.mode === "patchSet") {
            // we are going to insert a new task in Q
            // if task is patchSet, then we remove all previous tasks in Q except the new one
            var queueKeys = Object.keys(globalBot.Q)
            for (var queueII = 0; queueII < queueKeys.length; queueII++) {
              if (globalBot.Q[queueKeys[queueII]].task === tName)
                delete globalBot.Q[queueKeys[queueII]];
            }
          }

          if (tasksInfos[tName] === undefined) {
            let infos = [];
            tasksInfos[tName] = {
              infos: infos
            }
          }
          tasksInfos[tName].infos.push({
            tName: tName,
            buildId: bId,
            patch: patches[jj],
            pInfo: pInfo
          });

        }

        tasksCurrentTot[tName].currentTot = remoteTot;
        www.updateQueue();
      }
    }
  }

  let keepGoing = true;
  while (keepGoing) {
    if (Object.keys(tasksInfos).length === 0) {
      break;
    }
    keepGoing = false;
    // Consume and push to queue 1 build per task until none is left
    for (var tinfo in tasksInfos) {
      if (tasksInfos[tinfo].infos.length === 0) {
        continue;
      }
      keepGoing = true;
      var info = tasksInfos[tinfo].infos.pop();
      globalBot.Q[globalBot.QId] = {
        id: globalBot.QId,
        task: info.tName,
        buildId: info.buildId,
        repository: globalBot.tasks[info.tName].repository,
        patch: info.patch,
        infos: info.pInfo
      };
      globalBot.QId++;
      www.updateQueue();
    }
  }

  if (globalBot.debug) console.log('checking done')

}

function internalQNotifyEnd() {
  logger.debug('internalQNotifyEnd');
  globalBot.running = undefined;

  if (globalBot.state === "stopping") {
    console.log('Bot is inactive now');
    globalBot.state = "inactive";
    www.updateState();
  } else {
    internalQRunFirst();
  }
}

function internalTickTimeout() {
  logger.debug('internalTickTimeout');
  internalCheckTasks();
  internalQRunFirst();
}

function internalQRunFirst() {
  logger.debug('internalQRunFirst BEFORE');
  if (globalBot.debug) logger.debug(internalBotState());

  if (globalBot.running !== undefined) {
    www.updateQueue();
    return;
  }

  if (globalBot.state !== "active")
    return;

  // priority 1 must be executed before priority 2
  var keysSorted = Object.keys(globalBot.Q).sort(function(a, b) {
    var v = globalBot.tasks[globalBot.Q[a].task].priority - globalBot.tasks[globalBot.Q[b].task].priority;
    if (v === 0) {
      // Use buildId to prioritize got to older to more recent one
      v = globalBot.tasks[globalBot.Q[a].task].buildId - globalBot.tasks[globalBot.Q[b].task].buildId;
    }
    return v;
  });
  if (keysSorted.length > 0) {
    globalBot.running = globalBot.Q[keysSorted[0]];
    delete globalBot.Q[keysSorted[0]];
    var repo = {
      name: globalBot.repositories[globalBot.running.repository].name,
      git: {
        url: globalBot.repositories[globalBot.running.repository].git.url
      },
      patch: globalBot.running.patch
    };

    globalBot.config.master.userSyncProject(repo);
    www.updateQueue();
  }

  logger.debug('internalQRunFirst END');
  if (globalBot.debug) logger.debug(internalBotState());
}

/*
One task:

"taskname" : {
  "branch" // branch name in repository to monitor
  "priority" // relative priority with other tasks, default
  "active": // true or false, indicate if task must be monitored or not
  "notify": // email(s) to notify after each run
  "mode": // monitoring mode 'patch' (run on all patches to base) 'patchSet' (run on ToT)
  "period": {
    "minutes"  // indicate the number of minutes (minium is one) to do periodic
    or
    "fixedTime" // indicate the time (in hour:minutes) to launch the run
  },
  "base": "c24c7a5d1170d09e75db822daa1
}

*/

function internalSaveContext() {
  fs.writeFileSync(cwd + '/configs/tasks.js', JSON.stringify(globalBot.tasks));
}

function botStop() {
  if (globalBot.state === "inactive") {
    console.log('botStop -- bot already inactive');
  } else {
    if (globalBot.tickTimer !== undefined)
      clearInterval(globalBot.tickTimer);

    if (globalBot.running === undefined) {
      console.log('Bot Stopped');
      globalBot.state = "inactive";
      www.updateState();
    } else {
      console.log('Stopping bot in progress, there is still one running -- please wait...');
      globalBot.state = "stopping";
      www.updateState();
    }
  }
}

function botStart() {
  if (globalBot.state === "active") {
    console.log('botStart -- bot already active');
    return;
  }
  globalBot.taskTicks = {};
  globalBot.state = "active";
  www.updateState();

  console.log('Bot Started');
  globalBot.tickTimer = setInterval(internalTickTimeout,
    globalBot.tickInterval * 1000);
  internalTickTimeout();
}

function botQDelete(qid) {
  if (globalBot.Q[qid] === undefined) {
    console.log('botQDelete --', qid, 'doesnt exist');
  } else
    delete globalBot.Q[qid];
}

function botQAdd(tName, patch) {
  if (globalBot.tasks[tName] === undefined) {
    console.log('botQAdd -- task', tName, 'doesnt exist');
    return;
  }
  if (patch === undefined) {
    console.log('botQAdd -- patch is undefined');
    return;
  }

  var t = globalBot.tasks[tName];
  gitForBot.setRepo(globalBot.repositories[t.repository]);
  internalGitFetch(t.repository);
  var bId = gitForBot.getBuildId(patch);
  var pInfo = gitForBot.getPatchInfo(patch);
  globalBot.Q[globalBot.QId] = {
    id: globalBot.QId,
    task: tName,
    buildId: bId,
    repository: t.repository,
    patch: patch,
    infos: pInfo
  };
  globalBot.QId++;
}

function setUpProjectModules() {
  var projectPath = cwd + '/project';
  globalBot.projectBot = require(projectPath + '/commands');

  if (globalBot.projectBot.userCommands === undefined) {
    hdlSend('Missing userCommands in ' + projectPath + '/commands');
    return;
  }
}

function setConfig(config) {
  if (config === undefined)
    return 'nodeCiBot config undefined';

  if (config.master === undefined)
    return 'nodeCiBot master missing';

  if (config.configBot === undefined)
    return 'nodeCiBot configBot missing';

  config.configBot.users = [{
    id: 1,
    username: config.configBot.admin.name,
    password: config.configBot.admin.password,
    displayName: 'Admin'
  }]
  globalBot.config = config;
  setUpProjectModules();
  www.setConfig({
    globalBot: globalBot,
    botStart: botStart,
    botStop: botStop,
    botQAdd: botQAdd,
    botQDelete: botQDelete
  })
  logger.setLevel('DEBUG');
  return undefined;
}

function userCommandList(commands) {
  if (globalBot.debug)
    console.log('nodeCiBot', 'userCommandList', commands);

  // a syncProject has been launched automatically
  // now the system is synced on the right repo/patch
  // and we can launch the task command

  // check if command is a valid command in Project
  var k = Object.keys(commands);
  var ok = false;
  var ii;
  for (ii = 0; ii < k.length; ii++) {
    if (k[ii] === globalBot.tasks[globalBot.running.task].command)
      ok = true;
  }
  if (ok) {
    console.log('Launching command',
      globalBot.tasks[globalBot.running.task].command);
    var argv = [globalBot.tasks[globalBot.running.task].command];
    internalRunStart(argv);
  } else {
    // TODO:0 ERROR TREATMENT WHEN AN AUTO COMMAND FAILS
    logger.error('Command', globalBot.tasks[globalBot.running.task].command,
      'doesnt exist in project');

    console.log('Command', globalBot.tasks[globalBot.running.task].command,
      'doesnt exist in project');
    internalQNotifyEnd();
  }
}

function userCommandEnd(msg) {
  console.log('userCommandEnd', msg);

  logger.error('userCommandEnd', msg.str);

  // TODO:10 ERROR TREATMENT WHEN AN AUTO COMMAND FAILS
  internalQNotifyEnd();
}

function userRunStart(msg) {
  if (globalBot.debug)
    console.log('userRunStart', msg);

  // msg.command
  // msg.repository.name, msg.repository.git.url, msg.repository.patch
  globalBot.currentRun = {
    command: msg.command,
    repository: msg.repository,
    startTime: new Date().getTime(),
    numSequences: 0,
    numSeries: 0,
    numFailing: 0,
    numSuccess: 0,
    maxSamples: 0,
    sequences: {},
    failingSeries: [],
    allSeries: [],
    metadata: {}
  };

  www.startingBuild();
}

function userSequenceStart(msg) {
  // msg.info, msg.maxSamples
  globalBot.currentRun.maxSamples += msg.maxSamples;
  globalBot.currentRun.numSequences += 1;
  globalBot.currentRun.sequences[globalBot.currentRun.numSequences] = {
    info: msg.info,
    maxSamples: msg.maxSamples,
    numFailing: 0,
    startTime: new Date().getTime(),
    numSeries: 0,
    series: {}
  };
}

function serieDump(s) {
  var t = '';
  var ts;
  var l;
  t += 'Serie----------------------------------------------------------------' +
    '---------------';
  t += '\n';
  t += 'Module:' + s.module;
  t += '\n';
  t += 'Desc:\n' + JSON.stringify(s.desc, null, 4);
  t += '\n';
  t += 'Options:\n' + JSON.stringify(s.options, null, 4);
  t += '\n';
  t += 'Exec infos-----------------------------------------------------------' +
    '----------------';
  t += '\n';
  t += 'globalMaster.QId:' + s.exec.QId;

  if (s.exec.runnerId !== undefined)
    t += ' runnerId:' + s.exec.runnerId;

  if (s.exec.requires !== undefined)
    t += ' requires:' + JSON.stringify(s.exec.requires);
  if (s.exec.broadcast !== undefined)
    t += ' broadcast:' + s.exec.broadcast;
  if (s.exec.user !== undefined)
    t += ' user:' + s.exec.user;
  t += '\n';
  if (s.exec.timer !== undefined)
    t += 'timer:' + s.exec.timer;
  t += '\n';
  t += 'Logs-----------------------------------------------------------------' +
    '---------------';
  t += '\n';
  if (s.exec.broadcast) {
    for (var jj = 0; jj < s.result.length; jj++) {
      t += '\nrunner ' + jj + ':\n';
      ts = s.result[jj].sample;
      if (ts !== undefined) {
        t += 'Sample:\n' + JSON.stringify(ts, null, 4);
        t += '\n';
      }
      l = s.result[jj].logs;
      if (l !== undefined) {
        if (l.error !== undefined) {
          t += 'error:\n';
          t += JSON.stringify(l.error, null, 4);
          t += '\n';
        }
        if (l.stdout !== undefined) {
          t += 'stdout:\n';
          t += l.stdout;
          t += '\n';
        }
        if (l.stderr !== undefined) {
          t += 'stderr:\n';
          t += l.stderr;
          t += '\n';
        }
      }
    }
  } else {
    ts = s.result.sample;
    if (ts !== undefined) {
      t += 'Sample:\n' + JSON.stringify(ts, null, 4);
      t += '\n';
    }
    l = s.result.logs;
    if (l !== undefined) {
      if (l.error !== undefined) {
        t += 'error:\n';
        t += JSON.stringify(l.error, null, 4);
        t += '\n';
      }
      if (l.stdout !== undefined) {
        t += 'stdout:\n';
        t += l.stdout;
        t += '\n';
      }
      if (l.stderr !== undefined) {
        t += 'stderr:\n';
        t += l.stderr;
        t += '\n';
      }
    }
  }
  return t;
}

// msg.sample
/*
    var serie = {
        module: Q.done[QId].module,
        desc,
        options,
        result: sample and logs,
        exec: {
            QId: QId,
            spongeJson: sponge + '.json',
            spongeTxt: sponge + '.txt',
            requires: Q.done[QId].requires,
            broadcast: Q.done[QId].broadcast,
            logs: logs,
            timer: msg.timer
        }
    }
*/
function userSerie(serie) {
  globalBot.currentRun.numSeries++;
  globalBot.currentRun.sequences[globalBot.currentRun.numSequences].numSeries++;
  globalBot.currentRun.sequences[globalBot.currentRun.numSequences].series[globalBot.currentRun.sequences[globalBot.currentRun.numSequences].numSeries] = serie;
  var oneIsFailing = false;
  //console.log(JSON.stringify(serie, null, 4));
  if (util.isArray(serie.result)) {
    for (var jj = 0; jj < serie.result.length; jj++) {
      if (!serie.result[jj].sample.passing) {
        oneIsFailing = true;
      }
    }
  } else
  if (!serie.result.sample.passing) {
    oneIsFailing = true;
  }
  serie.state = {
    passing: !oneIsFailing,
    success: !oneIsFailing
  };

  var spongePath = globalBot.spongePath + '/' +
    globalBot.QTimeTag + '/';

  if (oneIsFailing) {
    var spongePathSerie = spongePath + serie.exec.QId;
    serie.exec.spongeTxt = spongePathSerie + '.txt';

    fs.writeFileSync(spongePathSerie + '.txt', serieDump(serie));
    fs.writeFileSync(spongePathSerie + '.json', JSON.stringify(serie, null, 4));

    globalBot.currentRun.numFailing++;
    globalBot.currentRun.failingSeries.push(serie);
    globalBot.currentRun.sequences[globalBot.currentRun.numSequences].numFailing++;
  } else
    globalBot.currentRun.numSuccess++;

  globalBot.currentRun.allSeries.push(serie);

  www.updatingBuild();
}

function userSequenceEnd(msg) {
  // msg.info
  if (msg.info !== globalBot.currentRun.sequences[globalBot.currentRun.numSequences].info) {
    logger.info('WARNING!!! userSequenceEnd info dont correspond', msg.info, globalBot.currentRun.sequences[globalBot.currentRun.numSequences].info);
  }
  var endTime = new Date().getTime();
  globalBot.currentRun.sequences[globalBot.currentRun.numSequences].timer = endTime - globalBot.currentRun.sequences[globalBot.currentRun.numSequences].startTime;
  delete globalBot.currentRun.sequences[globalBot.currentRun.numSequences].startTime;
}

function userRunEnd(msg) {
  var endTime = new Date().getTime();
  globalBot.currentRun.timer = endTime - globalBot.currentRun.startTime;
  delete globalBot.currentRun.startTime;


  var spongePath = globalBot.spongePath + '/' +
    globalBot.QTimeTag + '/';
  fs.writeFileSync(spongePath + 'all.json', JSON.stringify(globalBot.currentRun.allSeries));

  if (msg.name !== globalBot.currentRun.command) {
    logger.info('WARNING!!! userSequenceEnd info doesnt correspond', msg.name, globalBot.currentRun.command);
  }
  if (globalBot.debug) fs.writeFileSync(globalBot.currentRun.command + '.js', JSON.stringify(globalBot.currentRun));

  endRunEmitMail();

  // storing new build in globalBot.buildPath/g.running.task.json
  // storing buildid results in globalBot.buildPath/g.running.task/buildId.json
  var g = globalBot;
  var b = {
    task: g.running.task,
    buildId: g.running.buildId,
    repository: g.tasks[g.running.task].repository,
    branch: g.tasks[g.running.task].branch,
    spongeTag: g.QTimeTag,
    infos: {
      hash: g.running.infos[0].hash,
      abbrevHash: g.running.infos[0].abbrevHash,
      authorName: g.running.infos[0].authorName,
      authorEmail: g.running.infos[0].authorEmail,
      subject: g.running.infos[0].subject
    },
    state: {
      running: false,
      numTests: g.currentRun.numSeries,
      numFailing: g.currentRun.numFailing,
      numSuccess: g.currentRun.numSeries - g.currentRun.numFailing
    }
  }

  var f = globalBot.spongePath + '/' + globalBot.QTimeTag + '/build.json';
  fs.writeFileSync(f, JSON.stringify(b));

  if (globalBot.builds[g.running.task] === undefined)
    globalBot.builds[g.running.task] = {};

  var f = globalBot.buildPath + '/' + g.running.task + '.json';
  if (fs.existsSync(f)) {
    var d = fs.readFileSync(f);
    globalBot.builds[g.running.task] = JSON.parse(d);
  }

  globalBot.builds[g.running.task][g.running.buildId] = b;

  fs.writeFileSync(f, JSON.stringify(globalBot.builds[g.running.task]));

  var f = globalBot.buildPath + '/' + g.running.task;
  if (!fs.existsSync(f))
    fs.mkdirSync(f);

  var f = globalBot.buildPath + '/' + g.running.task + '/' + b.buildId + '.json';
  fs.writeFileSync(f, JSON.stringify(globalBot.currentRun.allSeries));
  var f = globalBot.buildPath + '/' + g.running.task + '/' + b.buildId + '.full.json';
  fs.writeFileSync(f, JSON.stringify(globalBot.currentRun));


  g.tasks[g.running.task].base = b.infos.hash;
  internalSaveContext();
  www.updateTasks();

  var postBuildCmd = globalBot.config.configBot.postBuildCmd;

  if (postBuildCmd !== undefined) {
    console.log("Post-processing build '" + b.buildId + "'...");
    moduleRun.exec(postBuildCmd.exec, postBuildCmd.args, cwd,
        function(err, stdout, stderr) {
          if (err) {
            console.log("Couldn't post-process build '" + b.buildId + "'");
            if (globalBot.debug) {
              console.log('stdout: ', stdout);
              console.log('stderr: ', stderr);
            }
          } else {
            console.log("Done post-processing '" + b.buildId + "'");
          }
        }
    )
  }

  www.stoppingBuild();

  globalBot.currentRun = undefined;
}

function userSyncProjectEnd(status) {
  var oneIsFailing = false;
  for (var jj = 0; jj < status.length; jj++) {
    if (!status[jj].sample.passing) {
      oneIsFailing = true;
    }
  }
  if (oneIsFailing) {
    console.log('nodeCiBot', 'killing current task');
    internalQNotifyEnd();
    return;
  }

  globalBot.config.master.userGetCommandList();
}

module.exports.setConfig = setConfig;
module.exports.userCommandList = userCommandList;
module.exports.userCommandEnd = userCommandEnd;
module.exports.userRunStart = userRunStart;
module.exports.userSequenceStart = userSequenceStart;
module.exports.userSerie = userSerie;
module.exports.userSequenceEnd = userSequenceEnd;
module.exports.userRunEnd = userRunEnd;
module.exports.userSyncProjectEnd = userSyncProjectEnd;
