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

var masterNetRunnerConfig;

function setConfig(config) {
  if (config === undefined)
    return 'masterNetRunner config undefined';

  if (config.wsSend === undefined)
    return 'masterNetRunner wsSend undefined';

  var k = Object.keys(config.runners);
  if (k === 0) {
    return 'masterNetRunner no runners';
  }

  masterNetRunnerConfig = config;
  return undefined;
}

function runnerRunJob(runnerId, job) {
  masterNetRunnerConfig.wsSend(
    runnerId,
    'runnerRunJob',
    job);
}

function runnerSyncProject(runnerId, repository) {
  masterNetRunnerConfig.wsSend(
    runnerId,
    'runnerSyncProject',
    repository);
}

module.exports.setConfig = setConfig;
module.exports.runnerRunJob = runnerRunJob;
module.exports.runnerSyncProject = runnerSyncProject;
