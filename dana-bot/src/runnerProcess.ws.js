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

var cwd = process.cwd();

var NODE_EXIT_KILL = 1;
var NODE_EXIT_UPDATE = 2;
var NODE_EXIT_MASTERDISCONNECT = 3;
var NODE_EXIT_KILLDAEMON = 128;
var NODE_EXIT_INTERNALERROR = 255;

function usage() {
  console.log('ERROR -- missing config file');
  console.log('Usage: node runnerProcess.ws.js runnerId');
  process.exit(NODE_EXIT_KILLDAEMON);
}

function usage() {
  console.log('ERROR -- missing config file to load');
  console.log('Usage: node standalone.js config.js');
  process.exit(1);
}

if (process.argv.length < 3) usage();

var configMaster = require(cwd + '/configs/bot').config;
if (configMaster === undefined) {
  console.log('ERROR bootbot configuration file, undefined');
  process.exit(NODE_EXIT_KILL);
}

var runnerId = process.argv[2];
var configRunner = configMaster.runners[runnerId];
if (configRunner === undefined) {
  console.log('ERROR Invalid configuration file, runners', runnerId, 'not defined');
  process.exit(NODE_EXIT_KILL);
}

var runnerNetMaster = require(cwd + '/src/runnerNetMaster.ws');
var runner = require(cwd + '/src/runner');

var err = runner.setConfig({
  configRunner: configRunner,
  master: runnerNetMaster,
  env: configRunner.env
});

if (err) {
  console.log('Unable to set runner config - ', err);
  process.exit(NODE_EXIT_INTERNALERROR);
}

var WebSocket = require('ws');

var ws;
var url = 'ws://' + configMaster.ip + ':' + configMaster.port;
ws = new WebSocket(url);

var wsActions = {};

function register(action, handler) {
  wsActions[action] = handler;
}

register('runnerAdmin', function(msg) {
  if (msg.kill) process.exit(NODE_EXIT_KILL);
  if (msg.update) process.exit(NODE_EXIT_UPDATE);
  if (msg.killDaemon) process.exit(NODE_EXIT_KILLDAEMON);
  console.log('Invalid runnerAdmin command');
  process.exit(NODE_EXIT_INTERNALERROR);
});

register('runnerRunJob', function(job) {
  runner.runnerRunJob(configRunner.name, job);
});

register('runnerSyncProject', function(repository) {
  runner.runnerSyncProject(configRunner.name, repository);
});

ws.on('open', function connection() {
  console.log('Connected to Master, sending runner config', configRunner);
  wsSend(
    'runnerConfig',
    configRunner);

  ws.on('message', function(msg, flags) {
    var data = JSON.parse(msg);
    if (wsActions[data.action] === undefined) {
      console.log('received ', data, ' unknown action');
      return;
    }
    wsActions[data.action](data.params);
  });

  ws.on('close', function close() {
    console.log('Master disconnected !');
    process.exit(NODE_EXIT_MASTERDISCONNECT);
  });
});

function wsSend(action, params) {
  ws.send(JSON.stringify({
    action: action,
    params: params
  }));
}

runnerNetMaster.setConfig({
  wsSend: wsSend
});
