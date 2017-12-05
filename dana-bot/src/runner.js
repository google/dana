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
/* eslint new-cap: "error" */

var fs = require('fs');
var os = require('os');
var cwd = process.cwd();
var run = require(cwd + '/src/run');
var git = require(cwd + '/src/git');
var butils = require(cwd + '/src/utils');

var globalRunner = {
  debug: false,
  config: undefined,
  useGit: true,
  tmpPath: cwd + '/tmp/runner.tmp',
  repoPath: cwd + '/tmp/runner.repo',
  projectBot: undefined,
  repository: undefined,
  runs: {},
  numberOfRuns: 0
};

if (!fs.existsSync(cwd + '/tmp'))
  fs.mkdirSync(cwd + '/tmp');

if (!fs.existsSync(globalRunner.tmpPath))
  fs.mkdirSync(globalRunner.tmpPath);

if (!fs.existsSync(globalRunner.repoPath))
  fs.mkdirSync(globalRunner.repoPath);

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

function runnerSyncProject(runnerId, repository) {
  function hdlSend(error, stdout, stderr) {
    globalRunner.config.master.runnerSyncProjectEnd(
      getResult(error, stdout, stderr));
  }

  function endGitSync() {
    globalRunner.repository = repository;
    hdlSend();
  }

  if (globalRunner.debug)
    console.log('RUNNER runnerSyncProject', repository);

  // It's a new syncProject, so we delete tmp dir
  butils.deleteDirectory(globalRunner.tmpPath);

  // Need to regenerate temp files of modules in tmp dir
  setUpProjectModules();

  if (repository === undefined) {
    hdlSend('Runner ' + globalRunner.config.configRunner.name +
      ' Missing repository  property, cannot syncProject');
    return;
  }
  if (repository.name === undefined) {
    hdlSend('Runner ' + globalRunner.config.configRunner.name +
      ' Missing repository name property, cannot syncProject');
    return;
  }
  if (repository.git === undefined) {
    hdlSend('Runner ' + globalRunner.config.configRunner.name +
      ' Missing repository git property, cannot syncProject');
    return;
  }
  if (repository.git.url === undefined) {
    hdlSend('Runner ' + globalRunner.config.configRunner.name +
      ' Missing repository git.url property, cannot syncProject');
    return;
  }
  if (repository.patch === undefined) {
    hdlSend('Runner ' + globalRunner.config.configRunner.name +
      ' Missing repository patch property, cannot syncProject');
    return;
  }
  if (globalRunner.useGit) {
    // CLONE the git repository if missing
    var repoName = repository.name;
    git.clone({
      repository: globalRunner.repoPath,
      name: repoName,
      url: repository.git.url
    }, function(err, stdout, stderr) {
      if (err) {
        hdlSend(err, 'Runner ' + globalRunner.config.configRunner.name +
          ' ' + stdout, stderr);
        return;
      }
      git.sync({
        repository: globalRunner.repoPath,
        name: repository.name,
        patch: repository.patch
      }, function(err, stdout, stderr) {
        if (err) {
          hdlSend(err, 'Runner ' + globalRunner.config.configRunner.name +
            ' ' + stdout, stderr);
          return;
        }
        endGitSync();
      });
    });
  } else
    endGitSync();
}

// job contains a QId, a module name and an option
// When job is done, sends back a QId, a timer, and a result
function runnerRunJob(runnerId, job) {
  var QId = job.QId;
  var QTimer;

  // result is in this format
  //  result = {
  //    sample : {
  //      passing: true/false,       // required
  //      value: value    // optional
  //    },
  //    logs : {
  //      error: undefined/string    // required
  //      stdout: stdout, // optional
  //      stderr: stderr  // optional
  //    }
  //  }
  function endRun(output) {
    var result = {
      sample: {
        passing: output.passing,
        value: output.value
      },
      logs: {
        error: output.error,
        stdout: output.stdout,
        stderr: output.stderr
      }
    };

    globalRunner.numberOfRuns--;

    if (globalRunner.debug)
      console.log('RUNNER endRun',
        QId, result, globalRunner.numberOfRuns, globalRunner.runs[QId]);

    delete globalRunner.runs[QId];

    if (result.sample.passing) {
      delete result.logs;
    }
    globalRunner.config.master.runnerRunJobEnd({
      QId: QId,
      timer: QTimer.stop(),
      result: result
    });
  }

  if (job.QId === undefined) {
    console.log('ERROR from master, no QId in job', job);
    globalRunner.config.master.runnerRunJobEnd({
      QId: undefined,
      timer: undefined,
      result: getResult(
        'Runner ' + globalRunner.config.configRunner.name +
        ' Missing QId cannot run the job',
        JSON.stringify(job)
      )
    });
  }

  if (job.module === undefined) {
    console.log('ERROR from master, no module in job', job);
    globalRunner.config.master.runnerRunJobEnd({
      QId: QId,
      timer: undefined,
      result: getResult(
        'Runner ' + globalRunner.config.configRunner.name +
        ' Missing module in job',
        JSON.stringify(job))
    });
  }

  if (job.option === undefined) {
    console.log('ERROR from master, no option in job', job);
    globalRunner.config.master.runnerRunJobEnd({
      QId: QId,
      timer: undefined,
      result: getResult(
        'Runner ' + globalRunner.config.configRunner.name +
        ' Missing option in job',
        JSON.stringify(job))
    });
  }

  if (globalRunner.projectBot.modules[job.module] === undefined) {
    console.log('ERROR, module not exist', globalRunner.projectBot.modules,
      job);

    globalRunner.config.master.runnerRunJobEnd({
      QId: QId,
      timer: undefined,
      result: getResult(
        'Runner ' + globalRunner.config.configRunner.name +
        ' module does not exist',
        JSON.stringify(job) + '\nglobalRunner.projectBot:' +
        JSON.stringify(globalRunner.projectBot.modules))
    });
  }

  globalRunner.runs[QId] = job;
  globalRunner.numberOfRuns++;

  if (globalRunner.debug)
    console.log('RUNNER runJob', job, globalRunner.numberOfRuns);

  QTimer = run.timer(QId);
  globalRunner.projectBot.modules[job.module].run(job.option, endRun);
}

function setUpProjectModules() {
  var projectPath = cwd + '/project';
  globalRunner.projectBot = require(projectPath + '/commands');
  if (globalRunner.projectBot.modules === undefined) {
    hdlSend('Missing modules in ' + projectPath + '/commands');
    return;
  }
  console.log('setUpProjectModules', JSON.stringify(globalRunner.config, null, 4));

  var k = Object.keys(globalRunner.projectBot.modules);
  for (var ii = 0; ii < k.length; ii++) {
    globalRunner.projectBot.modules[k[ii]].moduleName = k[ii];
    globalRunner.projectBot.modules[k[ii]].setConfig({
      cwd: cwd,
      tmpPath: globalRunner.tmpPath,
      repoPath: globalRunner.repoPath,
      env: globalRunner.config.configRunner.env,
      runner: true
    });

  }
}

function setConfig(config) {
  if (config === undefined)
    return 'Runner unable to set config - config undefined';

  if (config.master === undefined)
    return 'Runner unable to set config - master missing';

  if (config.configRunner === undefined)
    return 'Runner unable to set config - configRunner missing';

  if (config.configRunner.env === undefined)
    return 'Runner unable to set config - env missing';

  globalRunner.config = config;

  setUpProjectModules();

  return undefined;
}

module.exports.setConfig = setConfig;
module.exports.runnerRunJob = runnerRunJob;
module.exports.runnerSyncProject = runnerSyncProject;
