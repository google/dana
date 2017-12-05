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
var os = require('os');
var fs = require('fs');
var path = require('path');
var cwd = process.cwd();
var debug = false;
var bot;

var modules = {
  sync: require('./sync')
}

module.exports = {
  setup: setup,
  modules: modules,
  userCommands: {
    runSync: {
      hdl: runSync,
      args: 0,
      help: 'runSync -- Run sync command '
    }
  }
};

function setup(nodeCiBot) {
  if (debug) console.log('dana-bot launched');
  bot = nodeCiBot;
}

function runSync() {
  bot.startRun(1, startRunDone);

  function startRunDone(err) {
    if (err) {
      bot.endRun('error - cannot start - ' + err);
      return;
    }

    bot.start('sync');

    bot.addAll(modules.sync, {
      action: 'sync'
    });

    function syncEnd(series) {
      if (!bot.checkAllTestsPassing(series)) {
        hdl('sync failed', series);
        return;
      }
      bot.endRun('done');
    }
    bot.end(syncEnd);
  }
}
