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

function run(options, hdl) {
  function exit(v) {
    function pexit() {
      hdl(v);
    }
    process.nextTick(pexit);
  }

  console.log('SYNC RUNNING', options)

  exit({
    error: undefined,
    stdout: undefined,
    stderr: undefined,
    passing: true,
    value: true
  })
}

function setConfig(config) {}

function getSerieDesc(options) {
  return {
    name: "Synchronization barrier"
  }
}

module.exports = {
  setConfig: setConfig,
  run: run,
  requires: {
    alone: true
  },
  getSerieDesc: getSerieDesc
};
