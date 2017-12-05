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
var debug = false;

var moduleLogger = require(cwd + '/src/logger');
var moduleLoggerLogger = moduleLogger.createLogger('noconsole',
  cwd + '/server.log', 'DEBUG');
var moduleLoggerLog4js = moduleLogger.getLog4Js();

var configBot = require(cwd + '/configs/bot').config;
if (configBot === undefined) {
  console.log('ERROR Invalid master configuration file, undefined', process.argv[2]);
  process.exit(2);
}

if (configBot.system === undefined) {
  console.log('ERROR master configuration file, system undefined');
  process.exit(2);
}

var k = Object.keys(configBot.runners);
if (k.length > 1) {
  console.log('ERROR Invalid master configuration file, too many runners', process.argv[2]);
  process.exit(2);
}

var configRunner = configBot.runners[k[0]];

if (debug) {
  console.log('Server -----------');
  console.log('configBot:', JSON.stringify(configBot, null, 4));
  console.log('configRunner:', JSON.stringify(configRunner, null, 4));
}

if (configRunner === undefined) {
  console.log('ERROR Invalid configuration file, runners not defined');
  process.exit(2);
}

var nodeCiBot = require(cwd + '/src/bot');
var master = require(cwd + '/src/master');
var service = require(cwd + '/src/service');
var runner = require(cwd + '/src/runner');
var runners = {};

var err = runner.setConfig({
  configRunner: configRunner,
  master: master,
});
if (err) {
  console.log('Unable to set runner config - ', err);
  process.exit(1);
}

err = service.setConfig({
  master: master
});
if (err) {
  console.log('Unable to set service config - ', err);
  process.exit(1);
}

runners[k[0]] = {
  config: configRunner,
  instance: runner
};

err = master.setConfig({
  master: master,
  runners: runners,
  user: nodeCiBot,
  service: service
});

if (err) {
  console.log('Unable to set master config - ', err);
  process.exit(1);
}

nodeCiBot.setConfig({
  master: master,
  configBot: configBot
});
