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

// Private
var fs = require('fs');
var debug = false;

function getFileName(id, sizeCut) {
  if (debug) console.log('getFileName', id)
  var a = [];
  for (var i = 0; i < id.length; i += sizeCut)
    a.push(id.substring(i, i + sizeCut));
  return a;
}

//Public
module.exports = dbFile;
module.exports.deleteFolderRecursive = deleteFolderRecursive;

function dbFile(d, cut) {
  if (debug) console.log('new dbFile', d);
  if (d === undefined) {
    console.error('Files - Missing directory to setup db');
    return;
  }
  this.rootDir = d;
  this.sizeCut = 4;
  if (cut !== undefined) this.sizeCut = cut;
  if (!fs.existsSync(d))
    fs.mkdirSync(d);
  return null;
}

dbFile.prototype.existsSync = function existsSync(id) {
  if (debug) console.log('existsSync', id)
  var n = getFileName(id, this.sizeCut);
  var d = this.rootDir;
  for (var i in n) {
    d += '/' + n[i];
    if (i == (n.length - 1)) d += '.json';
  }
  if (debug) console.log('existsSync checking', d)
  if (!fs.existsSync(d)) return false;
  return true;
}

dbFile.prototype.readSync = function readSync(id) {
  if (debug) console.log('readSync', id)
  var n = getFileName(id, this.sizeCut);
  var d = this.rootDir;
  for (var i in n) {
    d += '/' + n[i];
    if (i == (n.length - 1)) d += '.json';
  }
  if (debug) console.log('readSync checking', d)
  if (!fs.existsSync(d))
    return undefined;
  return JSON.parse(fs.readFileSync(d));
}

dbFile.prototype.getReadStream = function getReadStream(id) {
  if (debug) console.log('getReadStream', id)
  var n = getFileName(id, this.sizeCut);
  var d = this.rootDir;
  for (var i in n) {
    d += '/' + n[i];
    if (i == (n.length - 1)) d += '.json';
  }
  if (debug) console.log('getReadStream checking', d)
  return fs.createReadStream(d);
}

dbFile.prototype.writeSync = function writeSync(id, o) {
  if (debug) console.log('writeSync', id)
  var n = getFileName(id, this.sizeCut);
  var d = this.rootDir;
  for (var i in n) {
    d += '/' + n[i];
    if (i == (n.length - 1)) d += '.json';
    else
    if (!fs.existsSync(d)) {
      if (debug) console.log('writeSync create dir', d)
      fs.mkdirSync(d);
    }
  }
  if (debug) console.log('writeSync create file', d)
  fs.writeFileSync(d, JSON.stringify(o));
}

dbFile.prototype.deleteSync = function deleteSync(id) {
  if (debug) console.log('deleteSync', id)
  var n = getFileName(id, this.sizeCut);
  var rdir = this.rootDir;
  var pdir = this.rootDir;

  function recurseDelete(index) {
    var d = rdir;
    var p = pdir;
    for (var i = 0; i < index; i++) {
      d += '/' + n[i];
      if (i == (n.length - 1)) d += '.json';
      else p += '/' + n[i];
    }
    if (index === n.length) {
      if (debug) console.log('deleting file', d)
      fs.unlinkSync(d);
      recurseDelete(index - 1);
    } else {
      if (index === 0) return;
      var f = fs.readdirSync(p);
      if (debug) console.log('content of', p, f);
      if (f.length === 0) {
        if (debug) console.log('deleting dir', p)
        fs.rmdirSync(p);
        recurseDelete(index - 1);
      }
    }
  }
  recurseDelete(n.length);
}

function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

dbFile.prototype.deleteSyncAll = function deleteSyncAll() {
  deleteFolderRecursive(this.rootDir);
}

dbFile.prototype.getIds = function getIds() {
  if (debug) console.log('getIds')
  var ids = [];

  function find(dir, id) {
    var files = fs.readdirSync(dir);
    for (var i in files) {
      if (debug) console.log('getIds', 'Looking to', dir, id, files[i])
      if (fs.existsSync(dir + '/' + files[i])) {
        var name = dir + '/' + files[i];
        var nid = id + files[i];
        if (fs.existsSync(name)) {
          if (fs.statSync(name).isDirectory()) {
            find(name, nid);
          } else {
            ids.push(nid.substring(0, nid.length - 5));
          }
        }
      }
    }
  }
  find(this.rootDir, '');
  return ids;
}
