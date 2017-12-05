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

var fs = require('fs');
var debug = false;

function deleteDirectory(dir) {
  var files = fs.readdirSync(dir);
  for (var i in files) {
    if (fs.existsSync(dir + '/' + files[i])) {
      var name = dir + '/' + files[i];
      if (fs.existsSync(name)) {
        if (fs.statSync(name).isDirectory()) {
          deleteDirectory(name);
          fs.rmdirSync(name);
        } else {
          fs.unlinkSync(name);
        }
      }
    }
  }
}

function copyFile(source, target, hdl) {
  if (debug)
    console.log('copyFile', source, target);

  var wasHandlerCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!wasHandlerCalled) {
      hdl(err);
      wasHandlerCalled = true;
    }
  }
}

function computeOptionsCombination(moduleOptions) {
  var options = [];
  var k = Object.keys(moduleOptions);
  var current = {};

  function addOne(id) {
    if (id === k.length) {
      options.push(JSON.parse(JSON.stringify(current)));
      return;
    }
    for (var ii = 0; ii < moduleOptions[k[id]].length; ii++) {
      current[k[id]] = moduleOptions[k[id]][ii];
      addOne(id + 1);
    }
  }
  addOne(0);
  return options;
}

module.exports.deleteDirectory = deleteDirectory;
module.exports.copyFile = copyFile;
module.exports.computeOptionsCombination = computeOptionsCombination;
