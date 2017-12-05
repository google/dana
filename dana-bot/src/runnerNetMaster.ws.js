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

var runnerNetMasterConfig;

function setConfig(config) {
  if (config === undefined)
    return 'runnerNetMaster config undefined';

  if (config.wsSend === undefined)
    return 'runnerNetMaster wsSend missing';

  runnerNetMasterConfig = config;
  return undefined;
}

function runnerRunJobEnd(job) {
  runnerNetMasterConfig.wsSend(
    'runnerRunJobEnd',
    job);
}

function runnerSyncProjectEnd(state) {
  runnerNetMasterConfig.wsSend(
    'runnerSyncProjectEnd',
    state);
}

module.exports.setConfig = setConfig;
module.exports.runnerRunJobEnd = runnerRunJobEnd;
module.exports.runnerSyncProjectEnd = runnerSyncProjectEnd;
