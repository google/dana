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
/* eslint guard-for-in: "off" */

var os = require('os');
var fs = require('fs');
var childProcess = require('child_process');
var exec = childProcess.execFile;
var execSync = childProcess.execFileSync;
var spawn = childProcess.spawn;

var lowLevelDebug = false;

module.exports.exec = function(cmd, args, cwd, hdl) {
  if (os.platform() === 'win32') {
    var newargs = [];
    newargs.push('/c');
    newargs.push(cmd);
    for (var i in args)
      newargs.push(args[i]);
    args = newargs;
    cmd = 'cmd.exe';
  }

  if (lowLevelDebug) console.log('exec (', cmd, args, cwd, ')');

  if (cwd && !fs.existsSync(cwd)) {
    console.log("exec -- ERROR: directory '" + cwd + "' does not exist");
    hdl("exec -- ERROR: directory '" + cwd + "' does not exist", "", "")
    return;
  }

  exec(
    cmd,
    args, {
      cwd: cwd,
      encoding: 'utf8',
      maxBuffer: 1024 * 500
    },
    function(err, stdout, stderr) {
      if ((lowLevelDebug) && (err)) {
        console.log('exec -- ERROR ', err, stdout, stderr);
      }
      hdl(err, stdout, stderr);
    });
};

module.exports.execSync = function(cmd, args, cwd) {
  if (lowLevelDebug) console.log('execSync (', cmd, args, cwd, ')');

  if (cwd && !fs.existsSync(cwd)) {
    console.log("exec -- ERROR: directory '" + cwd + "' does not exist");
    return {
      err : true,
      stdout : "",
      stderr : "",
      status : -1,
      output : "exec -- ERROR: directory '" + cwd + "' does not exist"
    };
  }

  var cmdout = {};
  var out;
  try {
    out = execSync(
      cmd,
      args, {
        cwd: cwd,
        encoding: 'utf8',
        maxBuffer: 1024 * 500
      }
    );
    cmdout.err = undefined;
    cmdout.stdout = out;
    cmdout.stderr = '';
    cmdout.status = 0;
    cmdout.output = out;
  } catch (err) {
    if (lowLevelDebug)
      console.log('execSync -- ERROR ', err.stdout, err.stderr, err.status,
        err.output);

    cmdout.err = true;
    cmdout.stdout = err.stdout;
    cmdout.stderr = err.stderr;
    cmdout.status = err.status;
    cmdout.output = err.output;
  }
  return cmdout;
};

module.exports.dumpOut = function(out) {
  console.log('------');
  console.log('ERR:', out.err);
  console.log('STDOUT:', out.stdout);
  console.log('STDERR:', out.stderr);
  console.log('STATUS:', out.status);
  console.log('OUTPUT:', out.output);
  console.log('------');
};

function timer(name) {
  var start = new Date();
  if (lowLevelDebug) console.log('LOG(' + start + ')', name, 'START');
  return {
    stop: function() {
      var end = new Date();
      var time = end.getTime() - start.getTime();
      if (lowLevelDebug)
        console.log('LOG(' + end + ')', name, 'END (in', time, 'ms)');
      return time;
    }
  };
}

module.exports.timer = timer;

module.exports.execRedirect = function(cmd, args, cwd, hdl) {
  var localStdout = '';

  if (os.platform() === 'win32') {
    var newargs = [];
    newargs.push('/c');
    newargs.push(cmd);
    for (var i in args)
      newargs.push(args[i]);
    args = newargs;
    cmd = 'cmd.exe';
  }

  if (lowLevelDebug) console.log('execRedirect (', cmd, args, cwd, ')');

  if (cwd && !fs.existsSync(cwd)) {
    console.log("exec -- ERROR: directory '" + cwd + "' does not exist");
    hdl("exec -- ERROR: directory '" + cwd + "' does not exist")
    return;
  }

  var proc = spawn(
    cmd,
    args, {
      cwd: cwd,
      encoding: 'utf8'
    }
  );

  proc.on("exit", function(exitCode) {
    hdl(exitCode, localStdout);
  });

  proc.stdout.on("data", function(chunk) {
    localStdout += chunk;
  });

  proc.stdout.on("end", function() {});
}
