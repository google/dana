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

var WebSocket = require('ws');
var url = 'ws://dana.myserver.com:7001';

var danaWs;
var danaHdl;

function connectToDana() {
  danaWs = new WebSocket(url);
  danaWs.on('open', function connection(err) {
    console.log('Connected to Dana');
    iAmConnectedToDana();
  });
  danaWs.on('message', function(msg, flags) {
    console.log('Message from Dana', msg);
  });
  danaWs.on('error', function error(err) {
    console.log('Error from Dana', err);
  });
  danaWs.on('close', function close() {
    console.log('Disconnected from Dana');
  });
}

function iAmConnectedToDana() {
  var data = {
    api: 'addBuild',
    projectId: 'Test'
  }
  danaWs.send(JSON.stringify(data));

  var data = {
    api: 'addSerie',
    projectId: 'Test'
  }
  danaWs.send(JSON.stringify(data));

  var data = {
    api: 'addSample',
    projectId: 'Test'
  }
  danaWs.send(JSON.stringify(data));
}

connectToDana();
