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

const cwd = process.cwd();
const fs = require('fs');
const moduleAnalyse = require(cwd + '/src/analyse');
const moduleHtmlBuilder = require(cwd + '/src/htmlBuilder');
const moduleSendMail = require(cwd + '/src/sendMail');

function snapshotAtMidnight() {
  let now = new Date();
  let night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // the next day, ...
    0, 0, 0 // ...at 00:00:00 hours
  );
  let msToMidnight = night.getTime() - now.getTime();
  setTimeout(function() {
    periodicSnapshot();
    snapshotAtMidnight();
  }, msToMidnight);
}

function periodicSnapshot() {
  let k = Object.keys(global.projects);
  for (let ii = 0; ii < k.length; ii++) {
    createSnapshotProjectId(k[ii]);
    sendDailyReport(k[ii]);
  }
}

function createSnapshotProjectId(projectId) {
  let nowTime = new Date().getTime();

  if (global.projects[projectId].infos.existsSync('tests.series')) {
    let tests = global.projects[projectId].infos.readSync('tests.series');
    let res = {
      numTests: 0,
      numTestsPassing: 0,
      numTestsFailing: 0,
      time: nowTime,
    };

    let k = Object.keys(tests);
    if (k.length !== 0) {
      res.numTests += k.length;
      for (let ii = 0; ii < k.length; ii++) {
        let s = tests[k[ii]];
        if (s.status.isPassing) {
          res.numTestsPassing++;
        } else {
          res.numTestsFailing++;
        }
      }
      let statusSeries = {};
      if (global.projects[projectId].infos.existsSync('tests.statusSeries')) {
        statusSeries = global.projects[projectId].infos
          .readSync('tests.statusSeries');
      }
      let id = Object.keys(statusSeries).length;
      statusSeries[id] = res;
      global.projects[projectId].infos
        .writeSync('tests.statusSeries', statusSeries);
    }
  }

  if (global.projects[projectId].infos.existsSync('benchmarks.series')) {
    let benchmarks = global.projects[projectId].infos
      .readSync('benchmarks.series');
    let res = {
      numSeries: 0,
      numSeriesSimilar: 0,
      numSeriesImproved: 0,
      numSeriesRegression: 0,
      numSeriesUndefined: 0,
      time: nowTime,
    };
    let k = Object.keys(benchmarks);
    res.numSeries = k.length;
    if (k.length !== 0) {
      for (let ii = 0; ii < k.length; ii++) {
        let s = benchmarks[k[ii]];
        if (s.status.error) {
          res.numSeriesUndefined++;
        } else {
          if (s.status.status.indexOf('similar') !== -1) {
            res.numSeriesSimilar++;
          }
          if (s.status.status.indexOf('regression') !== -1) {
            res.numSeriesRegression++;
          }
          if (s.status.status.indexOf('improvement') !== -1) {
            res.numSeriesImproved++;
          }
        }
      }
      let statusSeries = {};
      if (global.projects[projectId].infos
        .existsSync('benchmarks.statusSeries')) {
        statusSeries = global.projects[projectId].infos
          .readSync('benchmarks.statusSeries');
      }
      let id = Object.keys(statusSeries).length;
      statusSeries[id] = res;
      global.projects[projectId].infos
        .writeSync('benchmarks.statusSeries', statusSeries);
    }
  }

  let k = Object.keys(global.comparesConfig);
  for (let ii = 0; ii < k.length; ii++) {
    let compareId = k[ii];
    if (global.projects[projectId].infos
      .existsSync('benchmarks.compare_' + compareId)) {
      let compare;
      compare = global.projects[projectId].infos
        .readSync('benchmarks.compare_' + compareId);
      let res = {
        numSeries: 0,
        numSeriesBetter: 0,
        numSeriesLower: 0,
        numSeriesSimilar: 0,
        time: nowTime,
      };

      let kk = Object.keys(compare);
      res.numSeries = kk.length;
      for (let jj = 0; jj < kk.length; jj++) {
        let s = compare[kk[jj]];
        if (s.result.status.indexOf('better') !== -1) {
          res.numSeriesBetter++;
        }
        if (s.result.status.indexOf('lower') !== -1) {
          res.numSeriesLower++;
        }
        if (s.result.status.indexOf('similar') !== -1) {
          res.numSeriesSimilar++;
        }
      }
      let statusCompares = {};
      if (global.projects[projectId].infos
        .existsSync('benchmarks.statusCompare_' + compareId)) {
        statusCompares = global.projects[projectId].infos
          .readSync('benchmarks.statusCompare_' + compareId);
      };
      let id = Object.keys(statusCompares).length;
      statusCompares[id] = res;
      global.projects[projectId].infos
        .writeSync('benchmarks.statusCompare_' + compareId, statusCompares);
    }
  }
}

function sendDailyReport(projectId) {

  var danaUrl =
    'http://' + global.config.server.ip + ':' +
    global.config.server.port;

  moduleHtmlBuilder.bodyReset();

  moduleHtmlBuilder.bodyTableStart();

  moduleHtmlBuilder.bodyTableTd([
    'Project Id',
    '<b>' + projectId + '<b>'
  ]);
  moduleHtmlBuilder.bodyTableTd([
    'Project description',
    '<b>' + global.projectsConfig[projectId].description + '<b>'
  ]);

  moduleHtmlBuilder.bodyTableEnd();

  let numTestsNew = 0;
  if (global.projects[projectId].infos.existsSync('tests.series')) {
    let tests = global.projects[projectId].infos.readSync('tests.series');
    let k = Object.keys(tests);
    if (k.length !== 0) {
      let first = true;
      moduleHtmlBuilder.bodyH4('New failing tests to triage');
      for (let ii = 0; ii < k.length; ii++) {
        let s = tests[k[ii]];
        // convert an existing database
        let st = s.state;
        // convert an existing database
        if (st === 'new') st = 'failingNeedstriage';

        if (s.new === undefined)
          continue;
        delete s.new;

        if (st === 'failingNeedstriage') {
          if (first) {
            moduleHtmlBuilder.bodyTableStart();
            moduleHtmlBuilder.bodyTableTh(['Id', 'Last Passing', 'Failing Since', 'Last Executed', '']);
            first = false;
          }
          numTestsNew++;
          moduleHtmlBuilder.bodyTableTd([
            k[ii],
            s.status.lastPassing,
            s.status.failingSince,
            s.status.lastExecuted,
            '<a href=' + danaUrl +
            '/serie?' + projectId + '?' + encodeURI(k[ii]) + '>View</a>'
          ]);
        }
      }
      if (!first)
        moduleHtmlBuilder.bodyTableEnd();
      else
        moduleHtmlBuilder.bodyPar('None');
      global.projects[projectId].infos.writeSync('tests.series', tests);
    }
  }

  var dataBenchmarksNew = [];
  if (global.projects[projectId].infos.existsSync('benchmarks.series')) {
    let benchmarks = global.projects[projectId].infos
      .readSync('benchmarks.series');
    let k = Object.keys(benchmarks);
    if (k.length !== 0) {
      for (let ii = 0; ii < k.length; ii++) {
        let s = benchmarks[k[ii]];
        if (s.new === undefined)
          continue;
        delete s.new;
        let st = s.state;
        // convert an existing database
        if (st === 'new') st = 'regressionNeedstriage';
        if (st !== 'regressionNeedstriage') continue;

        dataBenchmarksNew.push({
          serieId: k[ii],
          ratio: benchmarks[k[ii]].status.current.ratio * 1
        });
      }
      global.projects[projectId].infos.writeSync('benchmarks.series', benchmarks)
      dataBenchmarksNew.sort(function(a, b) {
        return a.ratio - b.ratio;
      });
      moduleHtmlBuilder.bodyH4('New benchmark regressions to triage');
      if (dataBenchmarksNew.length !== 0) {
        moduleHtmlBuilder.bodyTableStart();
        moduleHtmlBuilder.bodyTableTh(['Id', 'BuildId', 'Base', 'Current', 'Ratio', '']);
        for (let ii = 0; ii < dataBenchmarksNew.length; ii++) {
          let s = benchmarks[dataBenchmarksNew[ii].serieId];
          moduleHtmlBuilder.bodyTableTd([
            dataBenchmarksNew[ii].serieId,
            s.status.lastBuildId,
            s.status.base.average * 1,
            s.status.current.average * 1,
            s.status.current.ratio * 1,
            '<a href=' + danaUrl +
            '/serie?' + projectId + '?' + encodeURI(dataBenchmarksNew[ii].serieId) + '>View</a>'
          ]);
        }
        moduleHtmlBuilder.bodyTableEnd();
      } else
        moduleHtmlBuilder.bodyPar('None');
    }
  }

  let numBenchmarksComparesNew = 0;
  let k = Object.keys(global.comparesConfig);
  for (let ii = 0; ii < k.length; ii++) {
    let compareId = k[ii];
    if (global.projects[projectId].infos
      .existsSync('benchmarks.compare_' + compareId)) {
      let compare;
      compare = global.projects[projectId].infos
        .readSync('benchmarks.compare_' + compareId);
      var dataCompareNew = [];
      let kk = Object.keys(compare);
      for (let jj = 0; jj < kk.length; jj++) {
        let s = compare[kk[jj]];
        if (s.new === undefined)
          continue;
        delete s.new;

        let st = s.state;
        // convert an existing database
        if (st === 'new') st = 'lowerNeedstriage';
        if (st !== 'lowerNeedstriage') continue;
        let p = s.result.diff / s.result.compareValue * 100;
        dataCompareNew.push({
          serieId: kk[jj],
          p: p
        })
      }
      global.projects[projectId].infos
        .writeSync('benchmarks.compare_' + compareId, compare)
      numBenchmarksComparesNew += dataCompareNew.length;
      dataCompareNew.sort(function(a, b) {
        return a.p - b.p;
      });
      moduleHtmlBuilder.bodyH4('New lower comparison for ' + compareId);
      if (dataCompareNew.length !== 0) {
        moduleHtmlBuilder.bodyTableStart();
        moduleHtmlBuilder.bodyTableTh(['Id', 'My value', 'Compare value', 'Ratio', '']);
        for (let jj = 0; jj < dataCompareNew.length; jj++) {
          let s = compare[dataCompareNew[jj].serieId];
          let ratio;
          let p = dataCompareNew[jj].p;
          if (s.result.diff == 0)
            ratio = '0%';
          if (s.result.diff > 0)
            ratio = '+' + p.toFixed(2) + '%';
          if (s.result.diff < 0)
            ratio = p.toFixed(2) + '%';
          moduleHtmlBuilder.bodyTableTd([
            dataCompareNew[jj].serieId,
            s.result.myValue * 1,
            s.result.compareValue * 1,
            ratio,
            '<a href=' + danaUrl +
            '/serie?' + projectId + '?' + encodeURI(dataCompareNew[jj].serieId) + '>View</a>'
          ]);
        }
        moduleHtmlBuilder.bodyTableEnd();
      } else
        moduleHtmlBuilder.bodyPar('None');
    }
  }

  moduleHtmlBuilder.bodyPar('<a href=' + danaUrl +
    '><i>-- Your Dana dashboard </i><a>');

  let report = moduleHtmlBuilder.bodyGet();

  let date = new Date();
  let subject = projectId + ' on ' + date.toLocaleString();
  if (numTestsNew !== 0) {
    if (numTestsNew === 1) {
      subject += ' - ' + numTestsNew + '  New test'
    } else {
      subject += ' - ' + numTestsNew + '  New tests'
    }
  }
  if (dataBenchmarksNew.length !== 0) {
    if (dataBenchmarksNew.length === 1) {
      subject += ' - 1  New regression'
    } else {
      subject += ' - ' + dataBenchmarksNew.length + '  New regressions'
    }
  }
  if (numBenchmarksComparesNew !== 0) {
    if (numBenchmarksComparesNew === 1) {
      subject += ' - ' + numBenchmarksComparesNew + '  New lower'
    } else {
      subject += ' - ' + numBenchmarksComparesNew + '  New lowers'
    }
  }
  //sendMail.sendMail(global.projectsConfig[projectId].users, '', subject, report);

  if (global.emailIsEnabled)
    moduleSendMail.sendMail('gcabillic@google.com', '', subject, report);

  if (!fs.existsSync(cwd + '/www/public/dailyReports')) {
    fs.mkdirSync(cwd + '/www/public/dailyReports');
  }

  fs.writeFileSync(cwd + '/www/public/dailyReports/' + projectId + '.html', '<H3>' + subject + '<br></H3>')
  fs.appendFileSync(cwd + '/www/public/dailyReports/' + projectId + '.html', report)
}

/**
 * Add a build to a project.
 * @param {object} apiData, object containing the build.
 * @param {function} hdl handler called at the end of the function.
 * @return {void}.
 */
function apiAddBuild(apiData, hdl) {
  let projectId;
  let build;
  if (apiData.projectId === undefined) {
    return hdl('Invalid data, projectId is missing');
  }
  projectId = apiData.projectId;
  if (global.projects[projectId] === undefined) {
    return hdl('Invalid data, projectId does not exist');
  }
  if (apiData.build === undefined) {
    return hdl('Invalid data, build is missing');
  }
  build = apiData.build;
  if (build.buildId === undefined) {
    return hdl('Invalid data, build.buildId is missing');
  }
  if (build.infos === undefined) {
    return hdl('Invalid data, build.infos is missing');
  }
  if (build.infos.hash === undefined) {
    return hdl('Invalid data, build.infos.hash is missing');
  }
  if (build.infos.abbrevHash === undefined) {
    return hdl('Invalid data, build.infos.abbrevHash is missing');
  }
  if (build.infos.authorName === undefined) {
    return hdl('Invalid data, build.infos.authorName is missing');
  }
  if (build.infos.authorEmail === undefined) {
    return hdl('Invalid data, build.infos.authorEmail is missing');
  }
  if (build.infos.subject === undefined) {
    return hdl('Invalid data, build.infos.subject is missing');
  }
  if (build.infos.url === undefined) {
    return hdl('Invalid data, build.infos.url is missing');
  }

  let builds = {};
  if (global.projects[projectId].infos.existsSync('builds')) {
    builds = global.projects[projectId].infos.readSync('builds');
  }

  if ((builds[build.buildId]) && (apiData.override !== true)) {
    return hdl('build.buildId already exist, use override flag to override content.');
  }

  builds[build.buildId] = build;
  global.projects[projectId].infos.writeSync('builds', builds);
  return hdl();
}

/**
 * Add a serie to a project and serie.
 * @param {object} apiData, object containing the serie.
 * @param {function} hdl handler called at the end of the function.
 * @return {void}.
 */
function apiAddSerie(apiData, hdl) {
  let projectId;
  let serieId;
  let analyse;
  if (apiData.projectId === undefined) {
    return hdl('Invalid data, projectId is missing');
  }
  projectId = apiData.projectId;
  if (global.projects[projectId] === undefined) {
    return hdl('Invalid data, projectId does not exist');
  }
  if (global.projects[projectId].series === undefined) {
    return hdl('Dana Error, projectId.series does not exist');
  }
  if (apiData.serieId === undefined) {
    return hdl('Invalid data, serieId is missing');
  }
  serieId = apiData.serieId;

  // analyse
  if (apiData.analyse === undefined) {
    return hdl('Invalid data, analyse is missing');
  }
  analyse = apiData.analyse;
  if ((!analyse.benchmark) && (!analyse.test)) {
    return hdl('Invalid data, invalid analyse');
  }

  // load serie if exist
  let newSerie = true;
  let serie = {};
  if (global.projects[projectId].series.existsSync(serieId)) {
    serie = global.projects[projectId].series.readSync(serieId);
    newSerie = false;
  }
  serie.projectId = projectId;

  if ((!newSerie) && (apiData.override !== true)) {
    return hdl('Serie serieId already exist, use override flag to override content.');
  }

  // optional apiData.description
  if (apiData.description) {
    serie.description = apiData.description;
  }

  // optional apiData.infos
  if (apiData.infos) {
    serie.infos = apiData.infos;
  }

  // Override serie.analyse data using the API call payload.
  // This is done per field to avoid discarding existing data if not supplied
  // in the payload.
  if (analyse.base) {
    serie.analyse.base = analyse.base;
  }
  if (analyse.benchmark) {
    serie.analyse.benchmark = analyse.benchmark;
  }
  if (analyse.test) {
    serie.analyse.test = analyse.test;
  }

  if (serie.assignee === undefined) {
    serie.assignee = {};
  }

  if (global.debug) console.log('apiAddSerie update', serieId, 'to', serie)

  global.projects[projectId].series.writeSync(serieId, serie);

  let gs = {
    numSamples: 0,
    numSeries: 1,
    projects: {},
  };
  if (global.admin.existsSync('globalStats')) {
    gs = global.admin.readSync('globalStats');
    if (newSerie) {
      gs.numSeries++;
    }
  }

  if (gs.projects[projectId] === undefined) {
    gs.projects[projectId] = {
      numSamples: 0,
      numSeries: 1,
    };
  } else {
    if (newSerie) {
      gs.projects[projectId].numSeries++;
    }
  }
  global.admin.writeSync('globalStats', gs);

  return hdl();
}

/**
 * Add a sample to a project and serie.
 * @param {object} apiData, object containing the sample.
 * @param {function} hdl handler called at the end of the function.
 * @return {void}.
 */
function apiAddSample(apiData, hdl) {
  let projectId;
  let serieId;
  let samples;
  let analyse;
  if (apiData.projectId === undefined) {
    return hdl('Invalid data, projectId is missing');
  }
  projectId = apiData.projectId;
  if (global.projects[projectId] === undefined) {
    return hdl('Invalid data, projectId does not exist');
  }
  if (global.projects[projectId].series === undefined) {
    return hdl('Dana Error, projectId.series does not exist');
  }
  if (apiData.serieId === undefined) {
    return hdl('Invalid data, serieId is missing');
  }
  serieId = apiData.serieId;

  if ((apiData.sample === undefined) && (apiData.samples === undefined)) {
    return hdl('Invalid data, sample or samples is missing');
  }
  if (apiData.sample) {
    if (apiData.samples) {
      return hdl('Invalid data, sample and samples are both defined');
    }
    apiData.samples = [apiData.sample]
  }
  samples = apiData.samples;

  // check buildId exist
  let builds;
  if (global.projects[projectId].infos.existsSync('builds')) {
    builds = global.projects[projectId].infos.readSync('builds');
  } else {
    return hdl('Invalid data - no builds in project');
  }

  // load serie if exist
  let serie = {};
  if (global.projects[projectId].series.existsSync(serieId)) {
    serie = global.projects[projectId].series.readSync(serieId);
    if (serie === undefined) {
      return hdl('Invalid data - serieId doesnt exist in project');
    }
  } else {
    return hdl('Invalid data - no series in project');
  }

  for (let ii = 0; ii < samples.length; ii++) {
    let sample = samples[ii];

    if (sample.buildId === undefined) {
      return hdl('Invalid data, sample.buildId is missing');
    }
    if (builds[sample.buildId] === undefined) {
      return hdl('Invalid data - sample.buildId doesnt exist in project');
    }
    if (sample.value === undefined) {
      return hdl('Invalid data, sample.value is missing');
    }
    if (serie.samples !== undefined) {
      if ((serie.samples[sample.buildId]) && (apiData.override !== true)) {
        return hdl('Sample already exist, use override flag to override content.');
      }
    }

    if (serie.analyse.benchmark) {
      if (typeof(sample.value) !== 'number') {
        return hdl('Invalid data - sample.value is not a number');
      }
      if (sample.value === 0) {
        return hdl('Invalid data - sample.value is zero');
      }
      //
      // Serie analysis for benchmark
      //
      sample.value = sample.value.toFixed(2) * 1;

      if (serie.samples === undefined) serie.samples = {};
      serie.samples[sample.buildId] = sample.value;
    }

    if (serie.analyse.test) {
      if ((sample.value !== false) && (sample.value !== true)) {
        return hdl('Invalid data - sample.value is not a boolean');
      }

      if (serie.samples === undefined) serie.samples = {};
      if ((serie.samples[sample.buildId]) && (apiData.override !== true)) {
        return hdl('Sample already exist, use override flag to override content.');
      }

      serie.samples[sample.buildId] = sample.value;
    }
    // optional sample.url
    if (sample.url !== undefined) {
      if (serie.url === undefined) {
        serie.url = {};
      }
      serie.url[sample.buildId] = sample.url;
    }
  }

  // serie.state
  if (serie.state === undefined) {
    serie.state = {
      analyse: 'none',
    };
  }

  if (serie.analyse.benchmark) {
    let newRegression = undefined;
    let k = Object.keys(serie.samples);
    k.sort(function(a, b) {
      return b * 1 - a * 1;
    });
    serie.lastBuildId = k[0];

    if (apiData.skipAnalysis !== true) {
      // analysis
      moduleAnalyse.analyse(serie);

      if (serie.analyseResult.summary.reduceBaseTo) {
        if (global.debug) console.log('Reset base to', serie.analyseResult.summary.reduceBaseTo, serieId)
        serie.analyse.base = serie.analyseResult.summary.reduceBaseTo;
      }

      let st = serie.state.analyse;

      // convert an existing database
      if (st === 'none') st = undefined;
      if (st === 'assigned') st = 'regressionAssigned';
      if (st === 'new') st = 'regressionConfirmed';
      if (st === 'wontfix') st = 'regressionIntended';

      if (st !== 'similarNoisy') {
        if (serie.analyseResult.summary.status === 'regression') {
          if (st === undefined) {
            serie.state.analyse = 'regressionNeedstriage';
            newRegression = true;
          } else if (st.indexOf('regression') === -1) {
            serie.state.analyse = 'regressionNeedstriage';
            newRegression = true;
          }
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
      let series = {};
      if (global.projects[projectId].infos.existsSync('benchmarks.series')) {
        series = global.projects[projectId].infos.readSync('benchmarks.series');
      }
      series[serieId] = {
        status: serie.analyseResult.summary,
        description: serie.description,
        state: serie.state.analyse,
        assignee: serie.assignee.analyse,
      };
      if (newRegression) series[serieId].new = true;
      if (serie.url !== undefined)
        if (serie.url[serie.lastBuildId])
          series[serieId].url = serie.url[serie.lastBuildId];
      global.projects[projectId].infos.writeSync('benchmarks.series', series);
    }

    //
    // Compare management
    //

    if (serie.assignee.compares === undefined) {
      serie.assignee.compares = {};
    }

    // clean old compares
    if (serie.compares) {
      let k = Object.keys(serie.compares);
      for (let ii = 0; ii < k.length; ii++) {
        if (serie.compares[k[ii]] === undefined) delete serie.compares[k[ii]];
      }
    }

    if (serie.state.compares === undefined) {
      serie.state.compares = {};
    }

    // update
    let kk = Object.keys(global.comparesConfig);
    for (let ii = 0; ii < kk.length; ii++) {
      let compareId = kk[ii];
      let cp = global.comparesConfig[compareId];
      if (cp.projectId != projectId) continue;

      if (serie.state.compares[compareId] === undefined) {
        serie.state.compares[compareId] = 'none';
      }

      let cpProjectId = cp.compareWith.projectId;

      if (cp.filter)
        if (serieId.indexOf(cp.filter) === -1) continue;

      let cpSerie;
      let cpSerieId = serieId;

      if (cp.compareWith.replace) {
        cpSerieId = cpSerieId.replace(cp.compareWith.replace.substr, cp.compareWith.replace.newSubStr);
      }

      if ((cpProjectId === projectId) && (cpSerieId === serieId)) {
        cpSerie = serie;
      } else {
        if (global.projects[cpProjectId]) {
          if (global.projects[cpProjectId].series.existsSync(cpSerieId)) {
            cpSerie = global.projects[cpProjectId].series.readSync(cpSerieId);
            if (cpSerie === undefined) console.log('cpSerie undefined');
          }
        }
      }
      if (cpSerie === undefined) continue;
      let result = moduleAnalyse.benchmarkCompare(cp, serie, cpSerie);
      if (global.debug) {
        console.log('result', result);
        console.log('serie.state', JSON.stringify(serie.state));
      }
      let newLower = undefined;
      if (result !== undefined) {
        let st = serie.state.compares[compareId];

        // convert an existing database
        if (st === 'none') st = undefined;
        if (st === 'assigned') st = 'lowerAssigned';
        if (st === 'new') st = 'lowerNeedstriage';
        if (st === 'wontfix') st = 'lowerIntended';

        if (result.status === 'lower') {
          if (st === undefined) {
            serie.state.compares[compareId] = 'lowerNeedstriage';
            newLower = true;
          } else if (st.indexOf('lower') === -1) {
            serie.state.compares[compareId] = 'lowerNeedstriage';
            newLower = true;
          }
        } else {
          serie.assignee.compares[compareId] = undefined;
          if (result.status === 'better') {
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

        if (global.debug) {
          console.log('serie.state', serie.state.compares[compareId]);
        }
        // serie file
        if (serie.compares === undefined) serie.compares = {};
        serie.compares[compareId] = {
          result: result,
          description: cp.description,
        };
        if (serie.url !== undefined)
          if (serie.url[serie.lastBuildId])
            serie.compares[compareId].url = serie.url[serie.lastBuildId];

        // compares file
        let compare = {};
        if (global.projects[projectId].infos
          .existsSync('benchmarks.compare_' + compareId)) {
          compare = global.projects[projectId].infos
            .readSync('benchmarks.compare_' + compareId);
        }
        compare[serieId] = {
          result: result,
          description: serie.description,
          state: serie.state.compares[compareId],
          assignee: serie.assignee.compares[compareId],
        };
        if (newLower) compare[serieId].new = true;
        global.projects[projectId].infos
          .writeSync('benchmarks.compare_' + compareId, compare);
      }
    }
  }

  if (serie.analyse.test) {
    //
    // Serie analysis for test
    //
    let newRegression = undefined;

    let k = Object.keys(serie.samples);
    k.sort(function(a, b) {
      return b * 1 - a * 1;
    });
    serie.lastBuildId = k[0];

    if (apiData.skipAnalysis !== true) {

      // analysis
      moduleAnalyse.analyse(serie);

      // convert an existing database
      if (serie.state.analyse === 'failing')
        serie.state.analyse = 'failingNeedstriage';
      else
        serie.state.analyse = 'passing';

      if (serie.analyseResult.isPassing) {
        serie.state.analyse = 'passing';
      } else {
        if (serie.state.analyse.indexOf('failing') === -1) {
          newRegression = true;
          serie.state.analyse = 'failingNeedstriage';
        }
      }

      // series management
      let series = {};
      if (global.projects[projectId].infos.existsSync('tests.series')) {
        series = global.projects[projectId].infos.readSync('tests.series');
      };

      series[serieId] = {
        status: serie.analyseResult,
        description: serie.description,
        state: serie.state.analyse,
      };
      if (newRegression) series[serieId].new = true;
      if (serie.url !== undefined)
        if (serie.url[serie.lastBuildId])
          series[serieId].url = serie.url[serie.lastBuildId];

      global.projects[projectId].infos.writeSync('tests.series', series);
    }
  }

  if (global.debug) console.log('apiAddSample update', serieId, 'to', serie)
  global.projects[projectId].series.writeSync(serieId, serie);

  if (!global.admin.existsSync('globalStats')) {
    return hdl('Error globalStats doesnt exist');
  }
  let gs = global.admin.readSync('globalStats');
  gs.numSamples++;

  if (gs.projects[projectId] === undefined) {
    return hdl('Error gs.projects[projectId] doesnt exist', projectId);
  }
  gs.projects[projectId].numSamples++;
  global.admin.writeSync('globalStats', gs);

  return hdl();
}

function apiGetBuild(apiData, hdl) {
  let projectId;
  let buildId;

  if (apiData.projectId === undefined) {
    return hdl(null, 'Invalid data, projectId is missing');
  }
  projectId = apiData.projectId;

  if (apiData.buildId === undefined) {
    return hdl(null, 'Invalid data, buildId is missing');
  }
  buildId = apiData.buildId;

  if (!global.projects[projectId].infos.existsSync('builds')) {
    // No information about this build; just return an empty result.
    return hdl(null);
  }

  let series = {};
  if (global.projects[projectId].infos.existsSync('benchmarks.series')) {
    series = global.projects[projectId].infos.readSync('benchmarks.series');
  }

  let results = {};

  let keys = Object.keys(series);
  for (let ii = 0; ii < keys.length; ii++) {
    let thisSeries = global.projects[projectId].series.readSync(keys[ii]);
    if (thisSeries.projectId !== projectId) continue;

    let samples = thisSeries.samples;
    if (samples[buildId] === undefined) continue;
    results[keys[ii]] = samples[buildId];
  }

  return hdl(results);
}

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
  comparesConfig: {},
  admin: {},
  emailIsEnabled: true,
};

if (!fs.existsSync(cwd + '/configs/db')) {
  fs.mkdirSync(cwd + '/configs/db');
}

if (!fs.existsSync(cwd + '/configs/client_secret.json')) {
  console.log('configs/client_secret.json not found, disabling email reports')
  global.emailIsEnabled = false;
}

if (!fs.existsSync(cwd + '/configs/gmail-credentials.json')) {
  console.log('configs/gmail-credentials.json not found, disabling email reports')
  global.emailIsEnabled = false;
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
    new ModuleFiles(cwd + '/configs/db/' + k[ii] + '/series', 10);
  global.projects[k[ii]].comments =
    new ModuleFiles(cwd + '/configs/db/' + k[ii] + '/comments', 10);
  global.projects[k[ii]].infos =
    new ModuleFiles(cwd + '/configs/db/' + k[ii] + '/infos', 200);
}

if (global.admin.existsSync('compares')) {
  global.comparesConfig = global.admin.readSync('compares');
}

global.version = JSON.parse(fs.readFileSync(cwd + '/package.json')).version;

if (global.config === undefined) {
  console.log('ERROR Invalid configuration file, undefined');
  process.exit(2);
}

if (global.config.adminUser === undefined) {
  console.log('ERROR Invalid configuration file, adminUser undefined');
  process.exit(2);
}

// addProjectCompare('D8_master', {
//   compareId: 'Compare_with_DX_master',
//   description: 'Compare D8_master with DX_master results',
//   projectId: 'DX_master',
//   useAverage: true
// });

// addProjectCompare('Test', {
//   compareId: 'Compare_with_build_1000',
//   description: 'Compare with build 1000',
//   useBuildId: 1000,
//   projectId: 'Test',
//   useAverage: true
// });

// Configure the local strategy for use by Passport.
const passport = require('passport');
const Strategy = require('passport-local').Strategy;

/*
function findById(id, cb) {
  let records = global.config.adminUser;
  process.nextTick(function() {
    let idx = id - 1;
    if (records[idx]) {
      cb(null, records[idx]);
    } else {
      cb(new Error('User ' + id + ' does not exist'));
    }
  });
}
*/

function findByUsername(username, cb) {
  let records = global.config.adminUser;
  process.nextTick(function() {
    for (let ii = 0, len = records.length; ii < len; ii++) {
      let record = records[ii];
      if (record.username === username) {
        return cb(null, record);
      }
    }
    return cb(null, null);
  });
};

passport.use(new Strategy(
  function(username, password, cb) {
    findByUsername(username, function(err, user) {
      if (err) {
        return cb(err);
      }
      if (!user) {
        console.log('Unknown username');
        return cb(null, false, {message: 'Unknown username'});
      }
      if (user.password !== password) {
        console.log('Incorrect passward');
        return cb(null, false, {message: 'Incorrect passward'});
      }
      return cb(null, user);
    });
  }));

passport.serializeUser(function(user, cb) {
  cb(null, user.username);
});

passport.deserializeUser(function(username, cb) {
  findByUsername(username, function(err, user) {
    if (err) {
      return cb(err);
    }
    cb(null, user);
  });
});

// Setup basic express server
const express = require('express');
const app = express();
const server = require('http').createServer(app);

app.locals.fs = fs;
app.locals.cwd = cwd;

app.use(express.static(cwd + '/www/public'));
app.set('views', cwd + '/www/views');
app.set('view engine', 'ejs');

app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({
  extended: true,
}));
app.use(require('body-parser').json());

const session = require("express-session");
const sessionMiddleware = session({
  secret: global.config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: global.config.secureCookie }

});
app.use(sessionMiddleware);

app.use(require('connect-flash')());

app.use(passport.initialize());
app.use(passport.session());

// LOGIN / LOGOUT
app.get('/',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (global.config.defaultUrl)
      res.redirect(global.config.defaultUrl);
    else
      res.redirect('/admin/viewProjects');

  });

app.get('/login',
  function(req, res) {
    res.render('common/login', {
      global: global,
      title: 'Login',
      user: req.user,
    });
  });

app.post('/login',
  passport.authenticate('local', {
    successRedirect: '/admin/viewProjects',
    failureRedirect: '/login',
    failureFlash: true
  }));

app.get('/logout',
  function(req, res) {
    req.logout();
    res.redirect('/');
  });

app.get('/admin/*',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    let l = '/admin/'.length;
    let r = req.originalUrl.substring(l);
    if (r.indexOf('editProject') !== -1) {
      r = r.split('?');
      let projectId = r[1];
      console.log(global.projectsConfig[projectId]);
      res.render('common/admin/editProject', {
        projectId: projectId,
        project: global.projectsConfig[projectId],
        global: global,
        title: 'Login',
        user: req.user,
      });
    } else
    if (r.indexOf('deleteProject') !== -1) {
      r = r.split('?');
      let projectId = r[1];
      console.log(global.projectsConfig[projectId]);
      res.render('common/admin/deleteProject', {
        projectId: projectId,
        project: global.projectsConfig[projectId],
        global: global,
        title: 'Login',
        user: req.user,
      });
    } else
    if (r.indexOf('editCompare') !== -1) {
      r = r.split('?');
      let compareId = r[1];
      console.log(global.comparesConfig[compareId]);
      res.render('common/admin/editCompare', {
        compareId: compareId,
        compare: global.comparesConfig[compareId],
        global: global,
        title: 'Login',
        user: req.user,
      });
    } else
    if (r.indexOf('deleteCompare') !== -1) {
      r = r.split('?');
      let compareId = r[1];
      console.log(global.comparesConfig[compareId]);
      res.render('common/admin/deleteCompare', {
        compareId: compareId,
        compare: global.comparesConfig[compareId],
        global: global,
        title: 'Login',
        user: req.user,
      });
    } else {
      res.render('common/admin/' + r, {
        global: global,
        title: 'Login',
        user: req.user,
      });
    }
  });

// *compareId
// description
// *projectId
// *filter
// *useAverage
// *with_projectId
// *with_buildId
// *with_useAverage
app.post('/admin/addComparator',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (global.debug)
      console.log('/admin/addComparator', req.body);

    // if (req.user.username !== 'admin') {
    //   appError(req, res, '/bot/addRepository, You must be an administrator');
    //   return;
    // }
    let compareId = req.body.compareId;
    if (compareId === '') {
      appError(req, res, '/admin/addComparator, compareId undefined');
      return;
    }
    if (global.comparesConfig[compareId] !== undefined) {
      appError(req, res, '/admin/addComparator, comparator ' + compareId + ' already exist');
      return;
    }

    let description;
    if (req.body.description !== '') description = req.body.description;

    let projectId = req.body.projectId;
    if (projectId === '') {
      appError(req, res, '/admin/addComparator, projectId undefined');
      return;
    }

    let filter;
    if (req.body.filter !== '') filter = req.body.filter;

    let useAverage = true;
    if (req.body.useAverage !== 'useAverage') useAverage = false;

    let compareWith = {};
    compareWith.projectId = req.body.with_projectId;
    if (compareWith.projectId === '') {
      appError(req, res, '/admin/addComparator, compareWith.projectId undefined');
      return;
    }

    let replace;
    if (req.body.with_useReplace) {
      if (req.body.with_useReplace_substr === '') {
        appError(req, res, '/admin/addComparator, substr in empty');
        return;
      }
      replace = {
        substr: req.body.with_useReplace_substr,
        newSubStr: req.body.with_useReplace_newSubStr
      }
    }
    compareWith.replace = replace;

    compareWith.buildId = undefined;
    if (req.body.with_buildId !== 'None') compareWith.buildId = req.body.with_buildId * 1;

    compareWith.useAverage = true;
    if (req.body.with_useAverage !== 'with_useAverage') compareWith.useAverage = false;

    global.comparesConfig[compareId] = {
      compareId: compareId,
      description: description,
      projectId: projectId,
      filter: filter,
      useAverage: useAverage,
      compareWith: compareWith
    }
    global.admin.writeSync('compares', global.comparesConfig);

    res.redirect('/admin/viewCompares');
  });

// *compareId
// description
// *projectId
// *filter
// *useAverage
// *with_projectId
// *with_buildId
// *with_useAverage
app.post('/admin/saveComparator',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    //if (global.debug)
    console.log('/admin/saveComparator', req.body);

    // if (req.user.username !== 'admin') {
    //   appError(req, res, '/bot/addRepository, You must be an administrator');
    //   return;
    // }
    let compareId = req.body.compareId;
    if (compareId === '') {
      appError(req, res, '/admin/saveComparator, compareId undefined');
      return;
    }
    if (global.comparesConfig[compareId] === undefined) {
      appError(req, res, '/admin/saveComparator, comparator ' + compareId + ' doesnt exist');
      return;
    }

    let description;
    if (req.body.description !== '') description = req.body.description;

    let projectId = req.body.projectId;
    if (projectId === '') {
      appError(req, res, '/admin/saveComparator, projectId undefined');
      return;
    }

    let filter;
    if (req.body.filter !== '') filter = req.body.filter;

    let useAverage = true;
    if (req.body.useAverage !== 'useAverage') useAverage = false;

    let compareWith = {};
    compareWith.projectId = req.body.with_projectId;
    if (compareWith.projectId === '') {
      appError(req, res, '/admin/saveComparator, compareWith.projectId undefined');
      return;
    }

    let replace;
    if (req.body.with_useReplace) {
      if (req.body.with_useReplace_substr === '') {
        appError(req, res, '/admin/saveComparator, substr in empty');
        return;
      }
      replace = {
        substr: req.body.with_useReplace_substr,
        newSubStr: req.body.with_useReplace_newSubStr
      }
    }
    compareWith.replace = replace;

    compareWith.buildId = undefined;
    if (req.body.with_buildId !== 'None') compareWith.buildId = req.body.with_buildId * 1;

    compareWith.useAverage = true;
    if (req.body.with_useAverage !== 'with_useAverage') compareWith.useAverage = false;

    global.comparesConfig[compareId] = {
      compareId: compareId,
      description: description,
      projectId: projectId,
      filter: filter,
      useAverage: useAverage,
      compareWith: compareWith
    }
    global.admin.writeSync('compares', global.comparesConfig);

    res.redirect('/admin/viewCompares');
  });

app.post('/admin/deleteComparator',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (global.debug)
      console.log('/admin/deleteComparator', req.body);

    // if (req.user.username !== 'admin') {
    //   appError(req, res, '/bot/addRepository, You must be an administrator');
    //   return;
    // }
    let compareId = req.body.compareId;
    if (compareId === '') {
      appError(req, res, '/admin/deleteComparator, compareId undefined');
      return;
    }
    if (global.comparesConfig[compareId] === undefined) {
      appError(req, res, '/admin/deleteComparator, comparator ' + compareId + ' doesnt exist');
      return;
    }

    delete global.comparesConfig[compareId];
    global.admin.writeSync('compares', global.comparesConfig);

    res.redirect('/admin/viewCompares');
  });

app.post('/admin/addProject',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (global.debug) console.log('/admin/addProject', req.body);

    // if (req.user.username !== 'admin') {
    //   appError(req, res, '/bot/addRepository, You must be an administrator');
    //   return;
    // }
    let projectId = req.body.projectId;
    if (global.projectsConfig[projectId] !== undefined) {
      appError(req, res, '/admin/addProject, project of ' + req.body.projectId + ' already exist');
      return;
    }
    var users = req.body.users.replace(/\r\n/g, ",");
    let dp;
    let useBugTracker = false;
    if (req.body.bugtracker === 'bugtracker') useBugTracker = true;
    if (req.body.defaultPage !== '') dp = req.body.defaultPage;
    global.projectsConfig[projectId] = {
      description: req.body.description,
      defaultPage: dp,
      infos: req.body.infos,
      users: users,
      useBugTracker: useBugTracker
    }
    global.admin.writeSync('projects', global.projectsConfig);

    global.projects[projectId] = {};
    if (!fs.existsSync(cwd + '/configs/db/' + projectId)) {
      fs.mkdirSync(cwd + '/configs/db/' + projectId);
    }
    global.projects[projectId].series =
      new ModuleFiles(cwd + '/configs/db/' + projectId + '/series', 10);
    global.projects[projectId].comments =
      new ModuleFiles(cwd + '/configs/db/' + projectId + '/comments', 10);
    global.projects[projectId].infos =
      new ModuleFiles(cwd + '/configs/db/' + projectId + '/infos', 200);

    res.redirect('/admin/viewProjects');
  });

app.post('/admin/saveProject',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (global.debug) console.log(req.body);
    // if (req.user.username !== 'admin') {
    //   appError(req, res, '/bot/addRepository, You must be an administrator');
    //   return;
    // }
    let projectId = req.body.projectId;
    if (global.projectsConfig[projectId] === undefined) {
      appError(req, res, '/admin/saveProject, project of ' + projectId + ' doesnt exist');
      return;
    }

    var users = req.body.users.replace(/\r\n/g, ",");
    let dp;
    if (req.body.defaultPage !== '') dp = req.body.defaultPage;
    let useBugTracker = false;
    if (req.body.bugtracker === 'bugtracker') useBugTracker = true;
    global.projectsConfig[projectId] = {
      description: req.body.description,
      defaultPage: dp,
      infos: req.body.infos,
      users: users,
      useBugTracker: useBugTracker
    }
    global.admin.writeSync('projects', global.projectsConfig);
    res.redirect('/admin/viewProjects');
  });

app.post('/admin/deleteProject',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (global.debug) console.log(req.body);
    // if (req.user.username !== 'admin') {
    //   appError(req, res, '/bot/addRepository, You must be an administrator');
    //   return;
    // }
    let projectId = req.body.projectId;
    if (global.projectsConfig[projectId] === undefined) {
      appError(req, res, '/admin/deleteProject, project of ' + projectId + ' doesnt exist');
      return;
    }
    delete global.projectsConfig[projectId];
    global.admin.writeSync('projects', global.projectsConfig);
    global.projects[projectId].series.deleteSyncAll();
    global.projects[projectId].comments.deleteSyncAll();
    global.projects[projectId].infos.deleteSyncAll();
    ModuleFiles.deleteFolderRecursive(cwd + '/configs/db/' + projectId)
    res.redirect('/admin/viewProjects');
  });

app.get('/serie',
  function(req, res) {
    let l = '/serie?'.length;
    let r = req.originalUrl.substring(l);
    r = r.split('?');
    let projectId = r[0];
    if (projectId === undefined) {
      console.error('/serie projectId undefined');
      return;
    }
    if (global.projects[projectId] === undefined) {
      console.error('/serie projectId  not in projects',
        projectId, global.projects);
      return;
    }
    let serieId = r[1];
    serieId = decodeURI(serieId);

    if (global.debug) {
      console.log('/serie projectId', projectId, 'serieId', serieId);
    }
    if (global.projects[projectId].series.existsSync(serieId)) {
      res.render('common/showOneSerie', {
        user: req.user,
        global: global,
        projectId: projectId,
        serieId: serieId,
      });
    } else {
      return appError(req, res, 'Serie ' + req.originalUrl + ' doesnt exist !');
    }
  });

app.post('/apis/*', function(req, res, next) {
  if (!req.is('application/json')) {
    return res.send('Expected application/json Content-Type');
  }

  const { authorization } = req.headers
  if (!authorization) {
    return res.status(401).send('Missing authorization header')
  }

  const [authType, token] = authorization.trim().split(' ')
  if (authType !== 'Bearer') {
    return res.status(401).send('Expected a Bearer token')
  }

  if (token != global.config.apiToken) {
    return res.status(401).send('Wrong token')
  }

  next();
});

app.post('/apis/*', function(req, res, next) {
  let l = '/apis/'.length;
  let apiName = req.originalUrl.substring(l);
  let data = req.body;
  if (global.debug) console.log('Got a request', apiName, data);
  if (apiName === 'addBuild') {
    apiAddBuild(data, function end(err) {
      if (err) {
        err.status = 400;
        return res.send(err);
      }
      return res.send('addBuild successfull\n');
    });
    return;
  }
  if (apiName === 'addSerie') {
    apiAddSerie(data, function end(err) {
      if (err) {
        err.status = 400;
        return res.send(err);
      }
      return res.send('addSerie successfull\n');
    });
    return;
  }
  if (apiName === 'addSample') {
    apiAddSample(data, function end(err) {
      if (err) {
        err.status = 400;
        return res.send(err);
      }
      return res.send('addSample successfull\n');
    });
    return;
  }

  err = 'Invalid API request';
  err.status = 400;
  res.send(err);
});

app.get('/apis/getBuild', function(req, res, next) {
  let data = req.body;
  if (global.debug) console.log('Got a request', 'getBuild', data);
  apiGetBuild(data, function end(results, err) {
    if (err) {
      err.status = 400;
      return res.send(err);
    }
    return res.json(results);
  });
});

app.get('/*',
  function(req, res) {
    let r = req.originalUrl.substring(1);
    if (fs.existsSync('www/views/projects/' + r + '.ejs')) {
      res.render('projects/' + r, {
        user: req.user,
        global: global,
      });
    } else {
      appError(req, res, 'Page ' + req.originalUrl + ' doesnt exist !');
    }
  });

// error handlers
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('common/error', {
    user: req.user,
    message: err.message,
    error: err,
    global: global,
  });
});

function appError(req, res, message) {
  res.render('common/error', {
    user: req.user,
    message: message,
    error: undefined,
    global: global,
  });
}

server.listen(global.config.server.port, function() {
  console.log('Dana web server listening at port %d',
    global.config.server.port);
});


const io = require('socket.io')(server);

const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

// Set socket.io listeners from the web clients
io.on('connection', function(socket) {
  console.log('New web connection');

  socket.on('disconnect', function(err) {
    console.log('One web is disconnected');
  });

  // getFileInfo (projectId,fileId)
  // -> receiveFileInfo (projectId,fileId,file)
  socket.on('getFileInfo', function(req) {
    if (global.debug) console.log('getFileInfo', req);
    let projectId = req.projectId;
    let fileId = req.fileId;
    if (projectId === undefined) {
      let e = 'socket getFileInfo projectId undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (fileId === undefined) {
      let e = 'socket getFileInfo fileId undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    req.file = {};
    if (projectId !== 'admin') {
      if (global.projects[projectId] === undefined) {
        let e = 'socket getFileInfo projectId not in projects';
        console.error(e, projectId);
        socket.emit('serverError', e);
        return;
      }
      if (global.projects[projectId].infos === undefined) {
        let e = 'socket getFileInfo projectId infos undefined';
        console.error(e, projectId);
        socket.emit('serverError', e);
        return;
      }
      if (global.projects[projectId].infos.existsSync(req.fileId)) {
        req.file = global.projects[projectId].infos.readSync(req.fileId);
      }
    } else {
      if (global.admin.existsSync(req.fileId)) {
        req.file = global.admin.readSync(req.fileId);
      }
    }
    socket.emit('receiveFileInfo', req);
  });

  // getOneSerie(projectId,serieId)
  // -> receiveOneSerie(projectId,serieId,serie)
  socket.on('getOneSerie', function(req) {
    if (global.debug) console.log('getOneSerie', req);
    let projectId = req.projectId;
    let serieId = req.serieId;
    if (projectId === undefined) {
      let e = 'socket getOneSerie projectId undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId] === undefined) {
      let e = 'socket getOneSerie projectId not in projects';
      console.error(e, projectId);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId].series === undefined) {
      let e = 'socket getOneSerie projectId series undefined';
      console.error(e, projectId);
      socket.emit('serverError', e);
      return;
    }
    if (!global.projects[projectId].series.existsSync(serieId)) {
      socket.emit('receiveOneSerie', req);
      return;
    }
    req.serie = global.projects[projectId].series.readSync(serieId);
    if (global.debug) console.log('getOneSerie query', serieId, 'result', req.serie)

    req.serie.comments = global.projects[projectId].comments.readSync(serieId);
    socket.emit('receiveOneSerie', req);
  });

  // serieUpdateAnalyse (projectId, serieId, analyse)
  // -> receiveUpdateAnalyseDone (projectId, serieId, analyse)
  socket.on('serieUpdateAnalyse', function(req) {
    if (global.debug) console.log('serieUpdateAnalyse', req);

    let projectId = req.projectId;
    let serieId = req.serieId;

    if (!socket.request.user) {
      let e = 'socket serieUpdateAnalyse requires admin login';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }

    let analyse = req.analyse;
    let comment = req.comment;
    if (comment === undefined) {
      let e = 'socket serieUpdateAnalyse comment undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (analyse === undefined) {
      let e = 'socket serieUpdateAnalyse analyse undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (projectId === undefined) {
      let e = 'socket serieUpdateAnalyse projectId undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId] === undefined) {
      let e = 'socket serieUpdateAnalyse projectId not in projects';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId].series === undefined) {
      let e = 'socket serieUpdateAnalyse projectId series undefined';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (!global.projects[projectId].series.existsSync(serieId)) {
      let e = 'socket serieUpdateAnalyse serieId doesnt exist';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    let serie = global.projects[projectId].series.readSync(serieId);

    let ct = '';
    if (serie.analyse.base !== analyse.base) {
      ct += '<i>Analyse base ' + serie.analyse.base + ' -> ' + analyse.base +
        '</i><br>';
    }
    if (serie.analyse.benchmark) {
      if (serie.analyse.benchmark.range !== analyse.benchmark.range) {
        ct += '<i>Analyse range updated ' +
          serie.analyse.benchmark.range + ' -> ' +
          analyse.benchmark.range + '</i><br>';
      }
      if (serie.analyse.benchmark.trend !== analyse.benchmark.trend) {
        ct += '<i>Analyse trend updated ' +
          serie.analyse.benchmark.trend + ' -> ' +
          analyse.benchmark.trend + '</i><br>';
      }
      if (serie.analyse.benchmark.required !== analyse.benchmark.required) {
        ct += '<i>Analyse required updated ' +
          serie.analyse.benchmark.required + ' -> ' +
          analyse.benchmark.required + '</i><br>';
      }
    }
    if (serie.analyse.test) {
      if (serie.analyse.test.propagate !== analyse.test.propagate) {
        ct += '<i>Analyse propagate updated ' +
          serie.analyse.test.propagate + ' -> ' +
          analyse.test.propagate + '</i><br>';
      }
    }
    if (ct !== '') {
      comment.text = ct + comment.text;
    }
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
        // TODO: noise analysis to get back to normal
      }

      // series management
      let series = global.projects[projectId].infos
        .readSync('benchmarks.series');
      if (series[serieId] === undefined) {
        let e = 'socket serieUpdateAnalyse series[serieId] undefined';
        console.error(e, projectId, serieId);
        socket.emit('serverError', e);
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
        if (cp.filter)
          if (serieId.indexOf(cp.filter) === -1) continue;
        let cpSerie;
        let cpSerieId = serieId;
        if (cp.compareWith.replace)
          cpSerieId = cpSerieId.replace(cp.compareWith.replace.substr, cp.compareWith.replace.newSubStr);
        let cpProjectId = cp.compareWith.projectId;
        if ((cpProjectId === projectId) && (cpSerieId === serieId)) {
          cpSerie = serie;
        } else {
          if (global.projects[cpProjectId]) {
            if (global.projects[cpProjectId].series.existsSync(cpSerieId)) {
              cpSerie = global.projects[cpProjectId].series.readSync(cpSerieId);
              if (cpSerie === undefined) console.log('cpSerie undefined');
            }
          }
        }
        if (cpSerie === undefined) continue;

        let result = moduleAnalyse.benchmarkCompare(cp, serie, cpSerie);
        if (result !== undefined) {
          let st = serie.state.compares[compareId];

          // convert an existing database
          if (st === 'none') st = undefined;
          if (st === 'assigned') st = 'lowerAssigned';
          if (st === 'new') st = 'lowerNeedstriage';
          if (st === 'wontfix') st = 'lowerIntended';

          if (result.status === 'lower') {
            if (st === undefined)
              serie.state.compares[compareId] = 'lowerNeedstriage';
            else if (st.indexOf('lower') === -1)
              serie.state.compares[compareId] = 'lowerNeedstriage';
          } else {
            serie.assignee.compares[compareId] = undefined;
            if (result.status === 'better') {
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
            let e = 'socket serieUpdateAnalyse compare[serieId] undefin';
            console.error(e, projectId, serieId);
            socket.emit('serverError', e);
            return;
          }
          compare[serieId].result = result;
          compare[serieId].state = serie.state.compares[compareId];

          global.projects[projectId].infos
            .writeSync('benchmarks.compare_' + compareId, compare);
        }
      }
    }
    if (serie.analyse.test) {
      // analysis
      moduleAnalyse.analyse(serie);

      // convert an existing database
      if (serie.state.analyse === 'failing')
        serie.state.analyse = 'failingNeedstriage';
      else
        serie.state.analyse = 'passing';

      if (serie.analyseResult.isPassing) {
        serie.state.analyse = 'passing';
      } else {
        if (serie.state.analyse.indexOf('failing') === -1)
          serie.state.analyse = 'failingNeedstriage';
      }

      // series management
      let series = global.projects[projectId].infos.readSync('tests.series');
      if (series[serieId] === undefined) {
        let e = 'socket serieUpdateAnalyse series[serieId] undefined';
        console.error(e, projectId, serieId);
        socket.emit('serverError', e);
        return;
      }
      series[serieId].status = serie.analyseResult;
      series[serieId].state = serie.state.analyse;

      global.projects[projectId].infos.writeSync('tests.series', series);
    }
    let serieComments = global.projects[projectId].comments.readSync(serieId);
    if (serieComments === undefined) {
      serieComments = [];
    }
    comment.date = Date.now();
    serieComments.push(comment);
    global.projects[projectId].comments.writeSync(serieId, serieComments);

    global.projects[projectId].series.writeSync(serieId, serie);
    socket.emit('receiveUpdateAnalyseDone', req);
  });

  // serieAddComment (projectId, serieId, comment.text, comment.ldap)
  // -> receiveAddCommentDone (projectId, serieId)
  socket.on('serieAddComment', function(req) {
    let projectId = req.projectId;
    let serieId = req.serieId;

    if (!socket.request.user) {
      let e = 'socket serieAddComment requires admin login';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }

    let comment = req.comment;
    if (global.debug) console.log('serieAddComment', req);
    if (comment === undefined) {
      let e = 'socket serieAddComment comment undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (comment.text === undefined) {
      let e = 'socket serieAddComment comment.text undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (projectId === undefined) {
      let e = 'socket serieAddComment projectId undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId] === undefined) {
      let e = 'socket serieAddComment projectId not in projects';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId].series === undefined) {
      let e = 'socket serieAddComment projectId series undefined';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (!global.projects[projectId].series.existsSync(serieId)) {
      let e = 'socket serieAddComment serieId doesnt exist';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    let serieComments = global.projects[projectId].comments.readSync(serieId);
    if (serieComments === undefined) {
      serieComments = [];
    }
    comment.date = Date.now();
    serieComments.push(comment);
    global.projects[projectId].comments.writeSync(serieId, serieComments);
    socket.emit('serieAddCommentDone', req);
  });

  // serieUpdateAssignee
  // (projectId, serieId, comment.text, assignee, compareId)
  // -> serieUpdateSeriesStateDone (projectId, serieId)
  socket.on('serieUpdateAssignee', function(req) {
    let projectId = req.projectId;
    let serieId = req.serieId;

    if (!socket.request.user) {
      let e = 'socket serieUpdateAssignee requires admin login';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }

    let comment = {};
    let compareId = req.compareId;
    let assignee = req.assignee;
    if (assignee === '') assignee = undefined;
    if (global.debug) console.log('serieUpdateAssignee', req);
    if (projectId === undefined) {
      let e = 'socket serieUpdateAssignee projectId undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId] === undefined) {
      let e = 'socket serieUpdateAssignee projectId not in projects';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId].series === undefined) {
      let e = 'socket serieUpdateAssignee projectId series undefined';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (!global.projects[projectId].series.existsSync(serieId)) {
      let e = 'socket serieUpdateAssignee serieId doesnt exist';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    let serie = global.projects[projectId].series.readSync(serieId);

    if (serie.assignee === undefined) {
      serie.assignee = {};
      if (serie.analyse.benchmark) {
        serie.assignee.compares = {};
      }
    }
    if (compareId === undefined) {
      let t = '';
      if (serie.assignee.analyse !== assignee) {
        t += '<i>Regression analysis assignee updated ';
        if (serie.assignee.analyse)
          t += serie.assignee.analyse;
        else
          t += 'None';
        t += ' -> ';
        if (assignee)
          t += assignee;
        else
          t += 'None';
        t += '</i><br>';
        serie.assignee.analyse = assignee;
      }
      comment.text = t;

      if (serie.analyse.benchmark) {
        let series = global.projects[projectId].infos
          .readSync('benchmarks.series');
        if (series[serieId] === undefined) {
          let e = 'socket serieUpdateAssignee series[serieId] undefined';
          console.error(e, projectId, serieId);
          socket.emit('serverError', e);
          return;
        }
        series[serieId].assignee = serie.assignee.analyse;
        global.projects[projectId].infos.writeSync('benchmarks.series', series);
      }
      if (serie.analyse.test) {
        let series = global.projects[projectId].infos.readSync('tests.series');
        if (series[serieId] === undefined) {
          let e = 'socket serieUpdateAssignee series[serieId] undefined';
          console.error(e, projectId, serieId);
          socket.emit('serverError', e);
          return;
        }
        series[serieId].assignee = serie.assignee.analyse;
        global.projects[projectId].infos.writeSync('tests.series', series);
      }
    } else {
      if (!global.comparesConfig[compareId]) {
        let e = 'socket serieUpdateAssignee compareId compares doesnt exist ' +
          compareId;
        console.error(e, projectId, serieId);
        socket.emit('serverError', e);
        return;
      }
      let t = '';
      if (serie.assignee.compares[compareId] !== assignee) {
        t += '<i>Assignee for ' + compares[compareId].description +
          ' updated ';
        if (serie.assignee.compares[compareId])
          t += serie.assignee.compares[compareId];
        else
          t += 'None';
        t += ' -> ';
        if (assignee)
          t += assignee;
        else
          t += 'None';
        t += '</i><br>';
        serie.assignee.compares[compareId] = assignee;
      }
      comment.text = t;
      let compare = global.projects[projectId].infos
        .readSync('benchmarks.compare_' + compareId);
      if (compare[serieId] === undefined) {
        let e = 'socket serieUpdateAssignee compare[serieId] undefined';
        console.error(e, projectId, serieId);
        socket.emit('serverError', e);
        return;
      }
      compare[serieId].assignee = serie.assignee.compares[compareId];
      global.projects[projectId].infos
        .writeSync('benchmarks.compare_' + compareId, compare);
    }

    let serieComments = global.projects[projectId].comments.readSync(serieId);
    if (serieComments === undefined) {
      serieComments = [];
    }
    comment.date = Date.now();
    serieComments.push(comment);
    global.projects[projectId].comments.writeSync(serieId, serieComments);
    global.projects[projectId].series.writeSync(serieId, serie);
    socket.emit('serieUpdateAssigneeDone', req);
  });

  socket.on('serieUpdateSeriesState', function(req) {
    let projectId = req.projectId;
    let serieId = req.serieId;

    if (!socket.request.user) {
      let e = 'socket serieupdateSeriesState requires admin login';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }

    let comment = {
      text: ''
    };
    let state = req.state;
    console.log('serieUpdateSeriesState', req);
    if (state === undefined) {
      let e = 'socket serieUpdateSeriesState state undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (projectId === undefined) {
      let e = 'socket serieUpdateSeriesState projectId undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId] === undefined) {
      let e = 'socket serieUpdateSeriesState projectId not in projects';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId].series === undefined) {
      let e = 'socket serieUpdateSeriesState projectId series undefined';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (!global.projects[projectId].series.existsSync(serieId)) {
      let e = 'socket serieUpdateSeriesState serieId doesnt exist';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    let serie = global.projects[projectId].series.readSync(serieId);
    let compareId = req.compareId;

    if (!compareId) {
      let t = '';
      if (serie.state.analyse !== state) {
        t += '<i>Regression analysis state updated ' +
          serie.state.analyse + ' -> ' +
          state + '</i><br>';
        if (serie.analyse.benchmark) {
          if (state === 'regressionNoisy')
            state = 'similarNoisy';
          if (state === 'improvementNoisy')
            state = 'similarNoisy';
        }
        serie.state.analyse = state;
      }

      comment.text = t + comment.text;

      if (serie.analyse.benchmark) {
        let series = global.projects[projectId].infos
          .readSync('benchmarks.series');
        if (series[serieId] === undefined) {
          let e = 'socket serieUpdateSeriesState series[serieId] undefined';
          console.error(e, projectId, serieId);
          socket.emit('serverError', e);
          return;
        }
        series[serieId].state = serie.state.analyse;
        global.projects[projectId].infos.writeSync('benchmarks.series', series);
      }
      if (serie.analyse.test) {
        let series = global.projects[projectId].infos.readSync('tests.series');
        if (series[serieId] === undefined) {
          let e = 'socket serieUpdateSeriesState series[serieId] undefined';
          console.error(e, projectId, serieId);
          socket.emit('serverError', e);
          return;
        }
        series[serieId].state = serie.state.analyse;
        global.projects[projectId].infos.writeSync('tests.series', series);
      }
    } else {

      if (!global.comparesConfig[compareId]) {
        let e = 'socket serieUpdateState compareId compares doesnt exist ' +
          compareId;
        console.error(e, projectId, serieId);
        socket.emit('serverError', e);
        return;
      }
      let t = '';
      if (serie.state.compares[compareId] !== state) {
        t += '<i>State for ' + compares[compareId].description +
          ' updated ' +
          serie.state.compares[compareId] + ' -> ' +
          state + '</i><br>';
        serie.state.compares[compareId] = state;
      }

      comment.text = t + comment.text;
      let compare = global.projects[projectId].infos
        .readSync('benchmarks.compare_' + compareId);
      if (compare[serieId] === undefined) {
        let e = 'socket serieUpdateState compare[serieId] undefined';
        console.error(e, projectId, serieId);
        socket.emit('serverError', e);
        return;
      }
      compare[serieId].state = serie.state.compares[compareId];
      global.projects[projectId].infos
        .writeSync('benchmarks.compare_' + compareId, compare);
    }

    let serieComments = global.projects[projectId].comments.readSync(serieId);
    if (serieComments === undefined) {
      serieComments = [];
    }
    comment.date = Date.now();
    serieComments.push(comment);
    global.projects[projectId].comments.writeSync(serieId, serieComments);
    global.projects[projectId].series.writeSync(serieId, serie);
    socket.emit('serieUpdateSeriesStateDone', req);
  });

  // serieUpdateBugLink projectId, serieId, bugLink
  socket.on('serieUpdateBugLink', function(req) {
    let projectId = req.projectId;
    let serieId = req.serieId;

    if (!socket.request.user) {
      let e = 'socket serieUpdateBugLink requires admin login';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }

    let comment = {
      text: ''
    };
    let bugLink = req.bugLink;
    console.log('serieUpdateBugLink', req);
    if (bugLink === undefined) {
      let e = 'socket serieUpdateBugLink bugLink undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (projectId === undefined) {
      let e = 'socket serieUpdateBugLink projectId undefined';
      console.error(e);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId] === undefined) {
      let e = 'socket serieUpdateBugLink projectId not in projects';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (global.projects[projectId].series === undefined) {
      let e = 'socket serieUpdateBugLink projectId series undefined';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    if (!global.projects[projectId].series.existsSync(serieId)) {
      let e = 'socket serieUpdateBugLink serieId doesnt exist';
      console.error(e, projectId, serieId);
      socket.emit('serverError', e);
      return;
    }
    let serie = global.projects[projectId].series.readSync(serieId);
    let compareId = req.compareId;

    if (serie.bugLink === undefined) {
      serie.bugLink = {};
      if (serie.analyse.benchmark) {
        serie.bugLink.compares = {};
      }
    }
    if (!compareId) {
      let t = '';
      t += '<i>BugLink updated to ' + bugLink + '</i><br>';
      serie.bugLink.series = bugLink;
      comment.text = t + comment.text;
      if (serie.analyse.benchmark) {
        let series = global.projects[projectId].infos
          .readSync('benchmarks.series');
        if (series[serieId] === undefined) {
          let e = 'socket serieUpdateBugLink series[serieId] undefined';
          console.error(e, projectId, serieId);
          socket.emit('serverError', e);
          return;
        }
        series[serieId].bugLink = bugLink;
        global.projects[projectId].infos.writeSync('benchmarks.series', series);
      }
      if (serie.analyse.test) {
        let series = global.projects[projectId].infos.readSync('tests.series');
        if (series[serieId] === undefined) {
          let e = 'socket serieUpdateBugLink series[serieId] undefined';
          console.error(e, projectId, serieId);
          socket.emit('serverError', e);
          return;
        }
        series[serieId].bugLink = bugLink;
        global.projects[projectId].infos.writeSync('tests.series', series);
      }
    } else {
      if (!global.comparesConfig[compareId]) {
        let e = 'socket serieUpdateBugLink compareId compares doesnt exist ' +
          compareId;
        console.error(e, projectId, serieId);
        socket.emit('serverError', e);
        return;
      }
      let t = '';
      t += '<i>BugLink for ' + compares[compareId].description +
        ' updated to ' + bugLink + '</i><br>';
      serie.bugLink.compares[compareId] = bugLink;
      comment.text = t + comment.text;
      let compare = global.projects[projectId].infos
        .readSync('benchmarks.compare_' + compareId);
      if (compare[serieId] === undefined) {
        let e = 'socket serieUpdateBugLink compare[serieId] undefined';
        console.error(e, projectId, serieId);
        socket.emit('serverError', e);
        return;
      }
      compare[serieId].bugLink = bugLink;
      global.projects[projectId].infos
        .writeSync('benchmarks.compare_' + compareId, compare);
    }

    let serieComments = global.projects[projectId].comments.readSync(serieId);
    if (serieComments === undefined) {
      serieComments = [];
    }
    comment.date = Date.now();
    serieComments.push(comment);
    global.projects[projectId].comments.writeSync(serieId, serieComments);
    global.projects[projectId].series.writeSync(serieId, serie);
    socket.emit('serieUpdateBugLinkDone', req);
  });
});

/*
// for other webservices via direct connection
const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({
  port: global.config.server.port + 1,
});

console.log('Dana system server listening at port %d',
  global.config.server.port + 1);

wss.on('connection', function connection(ws) {
  console.log('One external system just connect');
  ws.on('message', function(msg, flags) {
    let req = JSON.parse(msg);
    if (req.api === 'addBuild') {
      apiAddBuild(req, function end(err) {
        if (err) {
          return ws.send(err);
        }
        return ws.send('done');
      });
      return;
    }
    if (req.api === 'addSerie') {
      apiAddSerie(req, function end(err) {
        if (err) {
          return ws.send(err);
        }
        return ws.send('done');
      });
      return;
    }
    if (req.api === 'addSample') {
      apiAddSample(req, function end(err) {
        if (err) {
          return ws.send(err);
        }
        return ws.send('done');
      });
      return;
    }
    ws.send('Invalid API');
  });
  ws.on('error', function error(err) {
    console.log('Dana server ws error', err);
  });
  ws.on('close', function close() {
    console.log('Dana server ws close');
  });
});
*/

periodicSnapshot();
snapshotAtMidnight();
