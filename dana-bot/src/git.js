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

var fs = require('fs');
var path = require('path');
var cwd = process.cwd();
var run = require(cwd + '/src/run');

function sync(config, hdl) {
  if (config.patch === undefined) {
    hdl('ERROR -- no patch');
    return;
  }
  if (config.repository === undefined) {
    hdl('ERROR -- no repository');
    return;
  }
  if (config.name === undefined) {
    hdl('ERROR -- no name');
    return;
  }
  var path = config.repository + '/' + config.name;
  if (path === undefined) {
    hdl('ERROR -- no path');
    return;
  }

  run.exec('git', ['clean', '-f', '-d'], path, function(err, stdout, stderr) {
    if (err) {
      // console.log('ERROR -- ', err, stdout, stderr)
      hdl(err, stdout, stderr);
      return;
    }
    run.exec('git', ['fetch'], path, function(err, stdout, stderr) {
      if (err) {
        // console.log('ERROR -- ', err, stdout, stderr)
        hdl(err, stdout, stderr);
        return;
      }
      run.exec('git', ['reset', '--hard', config.patch], path,
        function(err, stdout, stderr) {
          if (err) {
            // console.log('ERROR -- ', err, stdout, stderr)
            hdl(err, stdout, stderr);
            return;
          }
          run.exec('git', ['log', '-n1', '--pretty=format:"%H"'], path,
            function(err, stdout, stderr) {
              if (err) {
                // console.log('ERROR -- ', err, stdout, stderr)
                hdl(err, stdout, stderr);
                return;
              }
              if (stdout.indexOf(config.patch) === -1) {
                hdl('ERROR, git sync ' +
                  '-- bad sync, config.patch not corresponding.' +
                  ' should be ' + config.patch + ' is ' + stdout);
              } else
                hdl(undefined);
            });
        });
    });
  });
}

function clone(config, hdl) {
  // console.log('git clone check', config);

  if (config.url === undefined) {
    hdl('ERROR -- no url');
    return;
  }
  if (config.repository === undefined) {
    hdl('ERROR -- no repository');
    return;
  }
  if (config.name === undefined) {
    hdl('ERROR -- no name');
    return;
  }
  var tpath = path.normalize(config.repository + '/' + config.name);
  if (tpath === undefined) {
    hdl('ERROR -- no path');
    return;
  }

  if (fs.existsSync(tpath))
    hdl(undefined);
  else {
    console.log('Need to clone repo', config);

    var args = ['clone', config.url, tpath];
    // if (os.platform()!='win32')
    //    args = ['clone', config.url, path, ' < /dev/tty'];

    run.exec('git', args, null, function(err, stdout, stderr) {
      // console.log('ERROR -- ', err, stdout, stderr)
      hdl(err, stdout, stderr);
    });
  }
}

module.exports.sync = sync;
module.exports.clone = clone;
