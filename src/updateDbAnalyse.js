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
const moduleAnalyse = require(cwd + '/src/analyse');
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

if (!fs.existsSync(cwd + '/configs/db')) {
  fs.mkdirSync(cwd + '/configs/db');
}

const ModuleFiles = require(cwd + '/src/files');
global.admin = new ModuleFiles(cwd + '/configs/db/admin', 200);

if (global.admin.existsSync('projects')) {
  global.projectsConfig = global.admin.readSync('projects');
}

let k = Object.keys(global.projectsConfig);
for (let ii = 0; ii < k.length; ii++) {
  global.projects[k[ii]] = {};
  if (!fs.existsSync(cwd + '/configs/db/' + k[ii])) {
    fs.mkdirSync(cwd + '/configs/db/' + k[ii]);
  }
  global.projects[k[ii]].series =
    new ModuleFiles(cwd + '/configs/db/' + k[ii] + '/series', 200);
  global.projects[k[ii]].comments =
    new ModuleFiles(cwd + '/configs/db/' + k[ii] + '/comments', 200);
  global.projects[k[ii]].infos =
    new ModuleFiles(cwd + '/configs/db/' + k[ii] + '/infos', 200);
}

if (global.config === undefined) {
  console.log('ERROR Invalid configuration file, undefined');
  process.exit(2);
}

if (global.admin.existsSync('compares')) {
  global.comparesConfig = global.admin.readSync('compares');
}

// serieUpdateAnalyse (projectId, serieId, analyse)
// -> receiveUpdateAnalyseDone (projectId, serieId, analyse)
function serieUpdateAnalyse(req) {
  let projectId = req.projectId;
  let serieId = req.serieId;
  let analyse = req.analyse;
  if (global.debug) console.log('serieUpdateAnalyse', req);
  if (analyse === undefined) {
    let e = 'serieUpdateAnalyse analyse undefined';
    console.error(e);
    console.log('serverError', e);
    return;
  }
  if (projectId === undefined) {
    let e = 'serieUpdateAnalyse projectId undefined';
    console.error(e);
    console.log('serverError', e);
    return;
  }
  if (global.projects[projectId] === undefined) {
    let e = 'serieUpdateAnalyse projectId not in projects';
    console.error(e, projectId, serieId);
    console.log('serverError', e);
    return;
  }
  if (global.projects[projectId].series === undefined) {
    let e = 'serieUpdateAnalyse projectId series undefined';
    console.error(e, projectId, serieId);
    console.log('serverError', e);
    return;
  }
  if (!global.projects[projectId].series.existsSync(serieId)) {
    let e = 'serieUpdateAnalyse serieId doesnt exist';
    console.error(e, projectId, serieId);
    console.log('serverError', e);
    return;
  }
  let serie = global.projects[projectId].series.readSync(serieId);

  serie.analyse = analyse;

  if (serie.analyse.benchmark) {
    moduleAnalyse.analyse(serie);

    let st = serie.state.analyse;

    // convert an existing database
    if (st === 'none') st = undefined;
    if (st === 'assigned') st = 'regressionAssigned';
    if (st === 'new') st = 'regressionConfirmed';
    if (st === 'wontfix') st = 'regressionIntended';

    if (st !== 'similarNoisy') {
      if (serie.analyseResult.summary.status === 'regression') {
        if (st === undefined)
          serie.state.analyse = 'regressionNeedstriage';
        else if (st.indexOf('regression') === -1)
          serie.state.analyse = 'regressionNeedstriage';
      } else {
        serie.assignee.analyse = undefined;
        if (serie.analyseResult.summary.status === 'improvement') {
          if (st === undefined)
            serie.state.analyse = 'improvementNeedstriage';
          else if (st.indexOf('improvement') === -1)
            serie.state.analyse = 'improvementNeedstriage';
        } else {
          if (st === undefined)
            serie.state.analyse = 'similarNeedstriage';
          else if (st.indexOf('similar') === -1)
            serie.state.analyse = 'similarNeedstriage';
        }
      }
    } else {
      //TODO: noisy management to know if serie is back to a normal mode
    }

    // series management
    let series = global.projects[projectId].infos
      .readSync('benchmarks.series');
    if (series[serieId] === undefined) {
      let e = 'serieUpdateAnalyse series[serieId] undefined';
      console.error(e, projectId, serieId);
      console.log('serverError', e);
      return;
    }
    series[serieId].status = serie.analyseResult.summary;
    series[serieId].state = serie.state.analyse;

    global.projects[projectId].infos.writeSync('benchmarks.series', series);

    //
    // Compare management
    //
    let k = Object.keys(global.comparesConfig);
    for (let ii = 0; ii < k.length; ii++) {
      let compareId = k[ii];
      let cp = global.comparesConfig[compareId];
      if (cp.projectId !== projectId) continue;
      let cpProjectId = cp.projectId;
      if (global.projects[cpProjectId].series) {
        if (global.projects[cpProjectId].series.existsSync(serieId)) {
          let cpSerie = global.projects[cpProjectId].series
            .readSync(serieId);
          let result = moduleAnalyse.benchmarkCompare(cp, serie, cpSerie);
          if (result !== undefined) {

            let st = serie.state.compares[compareId];
            if (result.status === 'lower') {
              if (st === undefined)
                serie.state.compares[compareId] = 'lowerNeedstriage';
              else if (st.indexOf('lower') === -1)
                serie.state.compares[compareId] = 'lowerNeedstriage';
            } else {
              serie.assignee.compares[compareId] = undefined;
              if (serie.analyseResult.summary.status === 'better') {
                if (st === undefined)
                  serie.state.compares[compareId] = 'betterNeedstriage';
                else if (st.indexOf('better') === -1)
                  serie.state.compares[compareId] = 'betterNeedstriage';
              } else {
                if (st === undefined)
                  serie.state.compares[compareId] = 'similarNeedstriage';
                else if (st.indexOf('similar') === -1)
                  serie.state.compares[compareId] = 'similarNeedstriage';
              }
            }

            // serie file
            if (serie.compares === undefined) serie.compares = {};
            serie.compares[compareId].result = result;

            // compares file
            let compare = global.projects[projectId].infos
              .readSync('benchmarks.compare_' + compareId);
            if (compare[serieId] === undefined) {
              let e = 'serieUpdateAnalyse compare[serieId] undefin';
              console.error(e, projectId, serieId);
              console.log('serverError', e);
              return;
            }
            compare[serieId].result = result;
            compare[serieId].state = serie.state.compares[compareId];

            global.projects[projectId].infos
              .writeSync('benchmarks.compare_' + compareId, compare);
          }
        }
      }
    }
  }

  global.projects[projectId].series.writeSync(serieId, serie);
}

var req = {};
var kProjects = Object.keys(global.projects);
for (var ii = 0; ii < kProjects.length; ii++) {
  req.projectId = kProjects[ii];
  let series = global.projects[req.projectId].infos
    .readSync('benchmarks.series');
  var kSeries = Object.keys(series);
  for (var ii = 0; ii < kSeries.length; ii++) {
    req.serieId = kSeries[ii];
    req.analyse = {
      benchmark: {
        range: "5%",
        trend: "higher",
        required: 2
      }
    };
    console.log(req)
    serieUpdateAnalyse(req);
  }
}
