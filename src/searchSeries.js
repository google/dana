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

'use strict';
/* eslint require-jsdoc: "off" */
/* eslint-env es6 */

const projectId = process.argv[2];
if (!projectId) {
  console.log('Missing projectId to search');
  return;
}

const keyword = process.argv[3];
if (!keyword) {
  console.log('Missing keyword to search');
  return;
}

const cwd = process.cwd();
const moduleFiles = require(cwd + '/dana/files');

const finfos = new moduleFiles(cwd + '/configs/db/' + projectId + '/infos', 200);
if (finfos.existsSync('benchmarks.series')) {
  const benchmarks = finfos.readSync('benchmarks.series');
  const k = Object.keys(benchmarks);
  const r = [];
  let ii;

  for (ii in k) {
    if (k[ii].indexOf(keyword + '.') !== -1) {
      let s = k[ii].replace(keyword + '.', '');
      r.push({
        "id": s,
        "average": benchmarks[k[ii]].status.current.average
      });
    }
  }
  r.sort(function(a, b) {
    return b.average * 1 - a.average * 1
  });
  const rr = [];
  for (ii in r) rr.push({
    id: r[ii].id,
    name: r[ii].id
  })
  console.log(JSON.stringify(rr, null, 4))
} else
  console.log('No series to load...');
