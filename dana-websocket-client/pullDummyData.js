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
var url = 'ws://localhost:7001';

var danaWs;
var danaHdl;
var numSend = 0;
var numDone = 0;
var sendMutipleSamples = true;

function connectToDana() {
  danaWs = new WebSocket(url);
  danaWs.on('open', function connection(err) {
    console.log('Connected to Dana');
    iAmConnectedToDana();
  });
  danaWs.on('message', function(msg, flags) {
    if (msg !== 'done')
      console.log('Message from Dana', msg);
    numDone++;
    if (numSend === numDone) process.exit(0);
  });
  danaWs.on('error', function error(err) {
    console.log('Error from Dana', err);
  });
  danaWs.on('close', function close() {
    console.log('Disconnected from Dana');
  });
}

//connectToDana();
var numBuilds = process.argv[2];
var numTests = process.argv[3];
var numSeries = process.argv[4];
if (numBuilds === undefined) {
  console.log('Missing numBuilds')
}
if (numTests === undefined) {
  console.log('Missing numTests')
}
if (numSeries === undefined) {
  console.log('Missing numSeries')
}
if ((numBuilds === undefined) ||
  (numSeries === undefined) ||
  (numTests === undefined)) {
  console.log('usage: node pullDummyData numBuilds numTests numSeries');
  process.exit(1);
}

function sendToDana(data) {
  numSend++;
  danaWs.send(JSON.stringify(data));
  //console.log(data)
}

function iAmConnectedToDana() {

  console.log('Pulling ', numBuilds, 'builds');
  for (let ii = 0; ii < numBuilds; ii++) {
    var data = {
      api: 'addBuild',
      projectId: 'Test',
      build: {
        buildId: 1000 + ii,
        infos: {
          hash: "hash_build_" + 1000 + ii,
          abbrevHash: "abbrevHash_build_" + 1000 + ii,
          authorName: "authorName",
          authorEmail: "authorEmail",
          subject: "Dummy build " + 1000 + ii,
          url: "http://url_build_" + 1000 + ii,
        }
      },
    }
    sendToDana(data);
  }

  console.log('Pulling ', numTests, 'tests');
  for (let ii = 0; ii < numTests; ii++) {
    var data = {
      api: 'addSerie',
      projectId: 'Test',
      serieId: "test.dummy." + ii,
      analyse: {
        test: {}
      },
    }
    sendToDana(data);

    let base0, base2, lengthBase0;
    let target = Math.floor(Math.random() * 2);
    if (Math.random() < 0.6) {
      base0 = true;
      base2 = true;
    } else {
      base0 = true;
      base2 = false
    }
    lengthBase0 = Math.floor(Math.random() * (numBuilds));

    let samples = [];
    let base = base0;
    let currentLength = 0;
    let value;
    for (let jj = 0; jj < numBuilds; jj++) {
      value = base
      currentLength++
      if (currentLength === lengthBase0)
        base = base2;
      let sample = {
        buildId: 1000 + jj,
        value: value
      };
      if (sendMutipleSamples) {
        samples.push(sample)
      } else {
        sendToDana({
          api: 'addSample',
          projectId: 'Test',
          serieId: "test.dummy." + ii,
          sample: sample,
        });
      }
    }
    if (sendMutipleSamples) {
      sendToDana({
        api: 'addSample',
        projectId: 'Test',
        serieId: "test.dummy." + ii,
        samples: samples,
      });
    }
  }

  console.log('Pulling ', numSeries, 'series');
  for (let ii = 0; ii < numSeries; ii++) {
    var data = {
      api: 'addSerie',
      projectId: 'Test',
      serieId: "serie.dummy." + ii,
      analyse: {
        benchmark: {
          range: "5%",
          required: 2,
          trend: "higher"
        }
      },
    }
    sendToDana(data);

    let base0, base2, lengthBase0;
    let target = Math.floor(Math.random() * 3);
    if (target === 0) {
      base0 = Math.floor(Math.random() * 10000) + 100;
      base2 = base0;
    }
    if (target === 1) {
      base0 = Math.floor(Math.random() * 10000) + 100;
      base2 = Math.floor(base0 * (1 + (((Math.random() * 20) + 6) / 100)));
    }
    if (target === 2) {
      base0 = Math.floor(Math.random() * 10000) + 100;
      base2 = Math.floor(base0 * (1 - (((Math.random() * 20) + 6) / 100)));
    }
    lengthBase0 = Math.floor(Math.random() * (numBuilds));

    let samples = [];
    let base = base0;
    let currentLength = 0;
    let value;
    for (let jj = 0; jj < numBuilds; jj++) {
      value = Math.floor(base * (1 + ((Math.random() * 5) / 100)));
      currentLength++
      if (currentLength === lengthBase0)
        base = base2;
      let sample = {
        buildId: 1000 + jj,
        value: value
      };
      if (sendMutipleSamples) {
        samples.push(sample)
      } else {
        sendToDana({
          api: 'addSample',
          projectId: 'Test',
          serieId: "serie.dummy." + ii,
          sample: sample,
        });
      }
    }
    if (sendMutipleSamples) {
      sendToDana({
        api: 'addSample',
        projectId: 'Test',
        serieId: "serie.dummy." + ii,
        samples: samples,
      });
    }
  }
}

connectToDana();
