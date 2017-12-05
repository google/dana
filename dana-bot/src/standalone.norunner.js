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

function usage() {
  console.log('ERROR -- missing config file');
  console.log('Usage: node standalone.norunner.js');
  process.exit(1);
}

var configMaster = require(cwd + '/configs/bot').config;
if (configMaster === undefined) {
  console.log('ERROR Invalid master configuration file', process.argv[2]);
  process.exit(2);
}

var NODE_EXIT_MASTERDISCONNECT = 3;

var nodeCiBot = require(cwd + '/src/bot');
var master = require(cwd + '/src/master');
var service = require(cwd + '/src/service');
var masterNetRunner = require(cwd + '/src/masterNetRunner.ws');
var runners = {};

/*
  ws.on('disconnect', function() {
    var t;
    if (ws.runner) {
      t = 'RUNNER ' + ws.name + ' disconnected';
      delete runners[ws.name];
    } else {
      console.log('One unknown socket disconnected');
      process.exit(NODE_EXIT_MASTERDISCONNECT);
    }
    nodeCiBot.userStop(t);
  });

  ws.on('error', function(err) {
    if (ws.runner) {
      console.log('RUNNER', ws.name, 'error', err);
    } else
      console.log('One unknown socket disconnected', err);
    process.exit(NODE_EXIT_MASTERDISCONNECT);
  });
*/

var wsActions = {};

function register(action, handler) {
  wsActions[action] = handler;
}

function wsSend(runnerId, action, params) {
  console.log('wsSend', runnerId, action, params)
  runners[runnerId].ws.send(JSON.stringify({
    action: action,
    params: params
  }));
}

// RUNNER protocol
//
register('runnerConfig', function(ws, config) {
  console.log('RUNNER node connected:)');
  if (isSystemRunning()) {
    console.log('System is already running');
    wsSend(ws, 'connectionRefused');
    return;
  }

  ws.name = config.name;
  ws.runner = true;
  runners[config.name] = {
    config: config,
    instance: masterNetRunner,
    ws: ws
  };
  isSystemReady();
});

register('runnerRunJobEnd', function(ws, msg) {
  master.runnerRunJobEnd(msg);
});

register('runnerSyncProjectEnd', function(ws, state) {
  master.runnerSyncProjectEnd(state);
});

function isSystemRunning() {
  if (Object.keys(runners).length === 1)
    return true;
  return false;
}

function isSystemReady() {
  if (Object.keys(runners).length === 1) {
    console.log()
    var err = masterNetRunner.setConfig({
      wsSend: wsSend,
      runners: runners
    });
    if (err) {
      console.log('Unable to set masterNetRunner config - ', err);
      process.exit(1);
    }
    err = service.setConfig({
      master: master
    });
    if (err) {
      console.log('Unable to set service config - ', err);
      process.exit(1);
    }
    err = master.setConfig({
      master: master,
      runners: runners,
      user: nodeCiBot,
      service: service
    });
    if (err) {
      console.log('Unable to set masterconfig - ', err);
      process.exit(1);
    }
    err = nodeCiBot.setConfig({
      master: master,
      configWeb: configMaster
    });
    if (err) {
      console.log('Unable to set nodeCiBot - ', err);
      process.exit(1);
    }
  }
}

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({
  port: configMaster.port
});

wss.on('connection', function connection(ws) {
  console.log('New connection received');
  ws.on('message', function(msg, flags) {
    var data = JSON.parse(msg);
    if (wsActions[data.action] === undefined) {
      console.log('received ', data, ' unknown action');
      return;
    }
    wsActions[data.action](ws, data.params);
  });
  ws.on('close', function close() {
    console.log('One Runner disconnected !', ws.name, ws.runner);
  });
});
