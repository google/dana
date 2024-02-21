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

const cwd = process.cwd();
const fs = require('fs');
const global = {
  ws: {},
  states: {},
  repositories: {},
  series: {},
  debug: false,
  version: undefined,
  config: require(cwd + '/configs/dana.js'),
  projectsConfig: {},
  projects: {},
  admin: {},
  emailIsEnabled: true,
  comparesConfig: {},
};

if (global.config === undefined) {
  console.log('ERROR Invalid configuration file, undefined');
  process.exit(2);
}

const ModuleFiles = require(cwd + '/src/files');
global.admin = new ModuleFiles(cwd + '/configs/db/admin', 200);

if (global.admin.existsSync('projects')) {
  global.projectsConfig = global.admin.readSync('projects');
}

const serieIdFind = /stringToFindInSerieId/; // regex
const serieIdReplace = "stringToReplaceInSerieId";
const serieInfosFind = /stringToFindInInfos/; // regex
const serieInfosReplace = "stringToReplaceInInfos";

let k = Object.keys(global.projectsConfig);
for (let ii = 0; ii < k.length; ii++) {
  global.projects[k[ii]] = {};
  if (!fs.existsSync(cwd + '/configs/db/' + k[ii])) {
    fs.mkdirSync(cwd + '/configs/db/' + k[ii]);
  }
  global.projects[k[ii]].series =
    new ModuleFiles(cwd + '/configs/db/' + k[ii] + '/series', 10);
  global.projects[k[ii]].comments =
    new ModuleFiles(cwd + '/configs/db/' + k[ii] + '/comments', 10);
  global.projects[k[ii]].infos =
    new ModuleFiles(cwd + '/configs/db/' + k[ii] + '/infos', 200);
}

if (global.admin.existsSync('compares')) {
  global.comparesConfig = global.admin.readSync('compares');
}

let projectId, serieId, compareId;

var kProjects = Object.keys(global.projects);
for (var ii = 0; ii < kProjects.length; ii++) {
  let series, kSeries;
  projectId = kProjects[ii];
  if (global.projects[projectId].infos.existsSync('tests.series')) {
    series = global.projects[projectId].infos
      .readSync('tests.series');
    kSeries = Object.keys(series);
    for (let ii = 0; ii < kSeries.length; ii++) {
      let serie;
      serieId = kSeries[ii];
      if (serieId.search(serieIdFind) !== -1) {
        if (!global.projects[projectId].series.existsSync(serieId)) {
          console.log('Database integrity error - ', projectId, serieId);
          process.exit(1);
        }
        serie = global.projects[projectId].series.readSync(serieId);
        let newSerieId = serieId.replace(serieIdFind, serieIdReplace);
        if (serie.infos)
          serie.infos = serie.infos.replace(serieInfosFind, serieInfosReplace);
        console.log(projectId, 'Tests.series converting "', serieId, '" into "', newSerieId, '"');
        global.projects[projectId].series.writeSync(newSerieId, serie);
        global.projects[projectId].series.deleteSync(serieId);
        series[newSerieId] = series[serieId];
        delete series[serieId];
      }
    }
    series = global.projects[projectId].infos
      .writeSync('tests.series', series);
  }

  if (global.projects[projectId].infos.existsSync('benchmarks.series')) {
    series = global.projects[projectId].infos
      .readSync('benchmarks.series');
    kSeries = Object.keys(series);
    for (let ii = 0; ii < kSeries.length; ii++) {
      let serie;
      serieId = kSeries[ii];
      if (serieId.search(serieIdFind) !== -1) {
        if (!global.projects[projectId].series.existsSync(serieId)) {
          console.log('Database integrity error - ', projectId, serieId);
          process.exit(1);
        }
        serie = global.projects[projectId].series.readSync(serieId);
        let newSerieId = serieId.replace(serieIdFind, serieIdReplace);
        if (serie.infos)
          serie.infos = serie.infos.replace(serieInfosFind, serieInfosReplace);
        console.log(projectId, 'Benchmark.series converting "', serieId, '" into "', newSerieId, '"');
        global.projects[projectId].series.writeSync(newSerieId, serie);
        global.projects[projectId].series.deleteSync(serieId);
        series[newSerieId] = series[serieId];
        delete series[serieId];
      }
    }
    series = global.projects[projectId].infos
      .writeSync('benchmarks.series', series);
  }

  let k = Object.keys(global.comparesConfig);
  for (let ii = 0; ii < k.length; ii++) {
    let compareId = k[ii];
    let cp = global.comparesConfig[compareId];
    if (cp.projectId !== projectId) continue;
    let compare = global.projects[projectId].infos
      .readSync('benchmarks.compare_' + compareId);
    kSeries = Object.keys(compare);
    for (let ii = 0; ii < kSeries.length; ii++) {
      serieId = kSeries[ii];
      if (serieId.search(serieIdFind) !== -1) {
        let newSerieId = serieId.replace(serieIdFind, serieIdReplace)
        console.log(projectId, 'Compares Converting "', serieId, '" into "', newSerieId, '"');
        compare[newSerieId] = compare[serieId];
        delete compare[serieId];
      }
    }
    global.projects[projectId].infos
      .writeSync('benchmarks.compare_' + compareId, compare);
  }
}
