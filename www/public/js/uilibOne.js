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

var debug = false;

var serie;
var serieData;
var serieBuilds;
var testsBuilds;
var savedAnalyse;
var dataTableObject;
var modalBugLinkCompareId;

var builds;
var buildsSorted;
var compares;
var eltg;
var tpageType;
var serieId;
var projectId;
var stateTarget;
var loaded = false;
var projects;

socket = io();

// pageType can be
// showOneSerie that shows all, tbuilds undefined
// statusSeries that shows only graph, tbuilds defined
// statusCompares that shows only compares, tbuilds defined
function uiShowSerie(tpageType, tprojectId, tserieId) {
  serieId = tserieId;
  projectId = tprojectId;
  //builds = tbuilds;
  //compares = tcompares;
  pageType = tpageType;

  $('#modalBtnOpen').click(function() {
    window.open("/serie?" + projectId + "?" + serieId, "_blank");
  });
  socket.on('receiveOneSerie', function(req) {
    if (debug)
      console.log('receiveOneSerie', req);
    NProgress.inc();

    if (req.serie === undefined)
      return alert('receiveOneSerie undefined for ', serieId);
    if (req.serie === 'dontexist')
      return alert('receiveOneSerie dontexist for ', serieId);
    serie = req.serie;

    if (pageType === 'showOneSerie')
      if (loaded) {
        uiLibOneReadyToProcessData();
        return;
      }

    if ((pageType === 'showOneSerie') || (pageType === 'statusSeries'))
      if (serie.samples) {
        var k = Object.keys(serie.samples);
        k.sort(function(a, b) {
          return a * 1 - b * 1
        });
        var a = [];
        var b = [];
        for (var ii in k) {
          a.push(serie.samples[k[ii]])
          b.push(k[ii])
        }
        serieData = a;
        serieBuilds = b;
        savedAnalyse = serie.analyse;
      }

    if (pageType === 'showOneSerie') {
      testsBuilds = [];
      if (serie.failedBuilds) {
        var k = Object.keys(serie.failedBuilds);
        k.sort(function(a, b) {
          return b * 1 - a * 1
        });
        for (var ii in k)
          testsBuilds.push(k[ii])
      }
      if (serie.samples) {
        var k = Object.keys(serie.samples);
        k.sort(function(a, b) {
          return b * 1 - a * 1
        });
        for (var ii in k) {
          if (ii > 10) break;
          testsBuilds.push(k[ii])
        }
      } else {
        if (serie.lastPassingBuildId) {
          testsBuilds.push(serie.lastPassingBuildId)
        }
      }
    }
    if (pageType === 'showOneSerie') {
      socket.emit('getFileInfo', {
        projectId: projectId,
        fileId: 'builds'
      });
      socket.emit('getFileInfo', {
        projectId: 'admin',
        fileId: 'compares'
      });
      socket.emit('getFileInfo', {
        projectId: 'admin',
        fileId: 'projects'
      });
    } else
      processBuilds();
  });

  if (pageType === 'showOneSerie') {
    socket.on('receiveFileInfo', function(req) {
      if (debug)
        console.log('receiveFileInfo', req);
      NProgress.inc();
      if (req.fileId === 'projects')
        projects = req.file;
      if (req.fileId === 'builds')
        builds = req.file;
      if (req.fileId === 'compares')
        compares = req.file;
      if ((builds !== undefined) && (compares !== undefined) && (projects !== undefined)) {
        processBuilds();
      }
    });

    socket.on('receiveUpdateAnalyseDone', function(req) {
      if (debug)
        console.log('receiveUpdateAnalyseDone', req);
      NProgress.start();
      socket.emit('getOneSerie', {
        projectId: projectId,
        serieId: serieId
      });
    });

    socket.on('serieAddCommentDone', function(req) {
      if (debug)
        console.log('serieAddCommentDone', req);
      NProgress.start();
      socket.emit('getOneSerie', {
        projectId: projectId,
        serieId: serieId
      });
    });

    socket.on('serieUpdateSeriesStateDone', function(req) {
      if (debug)
        console.log('serieUpdateSeriesStateDone', req);
      NProgress.start();
      socket.emit('getOneSerie', {
        projectId: projectId,
        serieId: serieId
      });
    });
  }
  socket.emit('getOneSerie', {
    projectId: projectId,
    serieId: serieId
  });

  socket.on('serverError', function(req) {
    if (debug)
      console.log('serverError', req);
    alert(req)
  });

  function processBuilds() {
    if (pageType !== 'statusCompares') {
      var k = Object.keys(builds);
      k.sort(function(a, b) {
        return a * 1 - b * 1
      });
      var a = [];
      for (var ii in k) {
        a.push(builds[k[ii]])
      }
      buildsSorted = a;

      if (pageType === 'showOneSerie')
        loaded = true;
    }
    uiLibOneReadyToProcessData();
  };

  if ((pageType === 'showOneSerie') || (pageType === 'statusSeries')) {
    $('#btnSeries').click(function() {
      $('#btnSeries').addClass('active')
      $('#btnRaw').removeClass('active')
      drawAnalyseGraph();
    });
    $('#btnRaw').click(function() {
      $('#btnRaw').addClass('active')
      $('#btnSeries').removeClass('active')
      drawRawGraph();
    });
  }

  if (debug) console.log('socket.emit ', 'getOneSerie');
  NProgress.start();

}

function drawRawGraph() {
  function dataConvert(data) {
    var d = [];
    var e;
    for (var ii = 0; ii < data.length; ii++) {
      if (serie.analyse.benchmark)
        e = [ii, data[ii]];
      if (serie.analyse.test) {
        if (data[ii])
          e = [ii, 3];
        else
          e = [ii, 2];
      }
      d.push(e);
    }
    return d;
  };
  var stackedGraph = true;
  if (serie.analyse.test) stackedGraph = false;

  var colors = ['#3557B2'];

  var e = document.getElementById('elt_dygraph');
  var d = dataConvert(serieData);
  eltg = new Dygraph(e, d, {
    axes: {
      x: {
        drawGrid: false,
        drawAxis: true,
        axisLabelFormatter: function(d, gran, opts) {
          if (serieBuilds[d] !== undefined)
            if (builds[serieBuilds[d]] !== undefined)
              return builds[serieBuilds[d]].buildId;
        }
      },
      y: {
        drawGrid: false,
        drawAxis: true,
        axisLabelFormatter: function(d, gran, opts) {
          if (serie.analyse.benchmark) return d;
          if (d === 2)
            return 'Failing'
          if (d === 3)
            return 'Passing';
          return '';
        }
      }
    },
    strokeWidth: 1.0,
    labelsDiv: '',
    labels: [
      '', 'raw'
    ],
    drawPoints: true,
    pointSize: 4,
    highlightCircleSize: 6,
    legend: '',
    legendFormatter: legendFormatter,
    stackedGraph: stackedGraph,
    connectSeparatedPoints: true,
    colors: colors,
    highlightCallback: function(e, x, pts, row) {
      globalSetSelectionRaw(row);
    },
    unhighlightCallback: function(e) {}
  });

  globalSetSelectionRaw(serieData.length - 1);

  $(document).ready(function() {
    if (debug) console.log('graph is ready');
    eltg.resize();
  });
  window.onresize = function(event) {
    if (debug) console.log('onresize');
    eltg.resize();
  };

  function globalSetSelectionRaw(idx) {
    eltg.setSelection(idx);
    var v = serieData[idx];
    var e = document.getElementById('valueinfo');
    var h = '<center>Value = <b>'
    if (serie.analyse.test) {
      if (v === null)
        h += '--- ---';
      else
      if (v)
        h += 'Passing';
      else
        h += 'Failing'
      h += '</b></center>';
      e.innerHTML = h;
      globalShowBuildInfo(idx)
      return;
    }

    if (idx === 0) {
      if (v === null)
        h += '--- ---';
      else
        h += v;
    } else {
      var previousV = serieData[idx - 1];

      if (v === null)
        h += '--- ---';
      else {
        if (previousV === null)
          h += v + ' ---';
        else {
          var diff = (v - previousV);
          var p = 0;
          if (diff !== 0)
            p = diff / previousV * 100;
          if (p > 0)
            h += v + ' (+' + diff.toFixed(2) + ' +' + p.toFixed(2) + '%)';
          else
            h += v + ' (' + diff.toFixed(2) + ' ' + p.toFixed(2) + '%)';
        }
      }
    }
    h += '</b></center>';
    e.innerHTML = h;
    globalShowBuildInfo(idx)
  }
}

function drawBenchmarkGraph() {

  if (!serie.analyse.benchmark) return;

  var regArray = [];
  //var annotationArray = [];

  function createRegressionArray() {
    if (serie.analyseResult.summary.error) {
      for (var ii = 0; ii < serieData.length; ii++)
        regArray.push(undefined);
    } else {
      var a = serie.analyseResult.averages;
      var currentIndex = 0;
      for (var ii = 0; ii < serieData.length; ii++) {
        if (ii < a[currentIndex].start)
          regArray.push(undefined);
        else {
          if (ii > a[currentIndex].end) currentIndex++;
          regArray.push(a[currentIndex]);
        }
      }
    }
    if (debug) console.log('regArray', regArray);
  };

  // function createAnnotationArray() {
  //   if (serie.analyseResult.summary.error) return;
  //
  //   var a = serie.analyseResult.averages;
  //   var currentIndex = 0;
  //   var firstShown = false;
  //   for (var ii = 0; ii < a.length; ii++) {
  //     if (ii === serie.analyseResult.details.first) {
  //       s = 'base';
  //       firstShown = true;
  //     } else {
  //       if (a[ii].status == 'similar')
  //         s = 'similar';
  //       else
  //       if (a[ii].status == 'regression')
  //         s = 'regression';
  //       else
  //       if (a[ii].status == 'improvement')
  //         s = 'improvement';
  //     }
  //     if (firstShown)
  //       if (a[ii].length >= serie.analyse.benchmark.required) {
  //         annotationArray.push({
  //           series: s,
  //           x: a[ii].start,
  //           shortText: currentIndex,
  //           text: "",
  //           tickHeight: 10,
  //           width: 23,
  //           height: 23
  //         }, {
  //           series: s,
  //           x: a[ii].end,
  //           shortText: currentIndex,
  //           text: "",
  //           tickHeight: 10,
  //           width: 23,
  //           height: 23
  //         });
  //         currentIndex++;
  //       }
  //   }
  //   if (debug) console.log('annotationArray', annotationArray);
  // }

  function dataConvert() {
    createRegressionArray();
    //    createAnnotationArray();
    var d = [];
    for (var ii = 0; ii < serieData.length; ii++) {
      var e;
      if (regArray[ii] === undefined)
        e = [ii, serieData[ii], null, null, null]
      else {
        if (regArray[ii].success)
          e = [ii, serieData[ii], serie.analyseResult.averages[serie.analyseResult.details.first].average, regArray[ii].average, null];
        else
          e = [ii, serieData[ii], serie.analyseResult.averages[serie.analyseResult.details.first].average, null, regArray[ii].average];
        d.push(e);
      }
    }

    var d = [];
    if (serie.analyseResult.summary.error) {
      for (var ii = 0; ii < serieData.length; ii++) {
        d.push([ii, serieData[ii], null, null, null, null]);
      }
    } else {
      var a = serie.analyseResult.averages;
      var baseValue = serie.analyseResult.averages[serie.analyseResult.details.first].average;
      var currentIndex = 0;
      var firstShown = false;
      var s = serie.analyseResult.averages[0].start;
      if (s != 0)
        for (var ii = 0; ii < s; ii++) {
          d.push([currentIndex, serieData[currentIndex], null, null, null, null]);
          currentIndex++;
        }
      for (var indexAverage = 0; indexAverage < a.length; indexAverage++) {
        if (debug) console.log('averages index', indexAverage);
        var avg = serie.analyseResult.averages[indexAverage];
        for (var jj = avg.start; jj <= avg.end; jj++) {
          if (debug) console.log('averages index start end', avg.start, avg.end);
          if (serie.analyseResult.details.first === indexAverage) {
            firstShown = true;
            e = [currentIndex, serieData[currentIndex], avg.average, null, null, null];
          } else {
            if (!firstShown) {
              e = [currentIndex, serieData[currentIndex], null, null, null, null];
            } else {
              if (avg.status == 'similar')
                e = [currentIndex, serieData[currentIndex], baseValue, avg.average, null, null];
              else
              if (avg.status == 'regression')
                e = [currentIndex, serieData[currentIndex], baseValue, null, avg.average, null];
              else
              if (avg.status == 'improvement')
                e = [currentIndex, serieData[currentIndex], baseValue, null, null, avg.average];
            }
          }
          d.push(e);
          currentIndex++;
        }
      }
    }
    if (debug) console.log('Array for graph', d);

    return d;
  };

  function checkState(s) {
    if (s.analyseResult.averages[s.analyseResult.averages.length - 1].success)
      return true;
    else {
      if (debug) console.log(s)
      return false;
    }
  }
  var colorSets = [
    '#3557B2', // raw
    '#B16EE4', // base
    '#8AE234', // success
    '#EE1111', // regression
    '#8AE234' // improvement
  ]

  var e = document.getElementById('elt_dygraph');
  var d = dataConvert();

  eltg = new Dygraph(e, d, {
    axes: {
      x: {
        drawGrid: false,
        drawAxis: true,
        axisLabelFormatter: function(d, gran, opts) {
          if (serieBuilds[d] !== undefined)
            if (builds[serieBuilds[d]] !== undefined)
              return builds[serieBuilds[d]].buildId;
        }
      },
      y: {
        drawGrid: false,
        drawAxis: true
      }
    },
    series: {
      'raw': {
        strokeWidth: 2,
        drawPoints: true,
        pointSize: 4,
        highlightCircleSize: 5
      },
      'base': {
        strokeWidth: 2,
        drawPoints: false,
        pointSize: 2,
        highlightCircleSize: 4
      },
      'similar': {
        strokeWidth: 2,
        drawPoints: false,
        pointSize: 2,
        highlightCircleSize: 4
      },
      'regression': {
        strokeWidth: 2,
        drawPoints: false,
        pointSize: 2,
        highlightCircleSize: 4
      },
      'improvement': {
        strokeWidth: 2,
        drawPoints: false,
        pointSize: 2,
        highlightCircleSize: 4
      },
    },
    labelsDiv: '',
    labels: [
      'builds', 'raw', 'base', 'similar', 'regression', 'improvement'
    ],
    legend: '',
    legendFormatter: legendFormatter,
    stackedGraph: false,
    connectSeparatedPoints: false,
    colors: colorSets,
    highlightCallback: function(e, x, pts, row) {
      globalSetSelectionRegression(row);
    },
    unhighlightCallback: function(e) {},
    underlayCallback: function(canvas, area, g) {
      if (!serie.analyseResult.summary.error) {
        var aRange = serie.analyseResult.details.aRange;
        var v;
        if (aRange.upIsValue) {
          v = aRange.up;
        } else {
          v = aRange.up * serie.analyseResult.averages[0].average / 100;
        }
        var xl = g.toDomCoords(serie.analyseResult.averages[0].start, serie.analyseResult.averages[0].average + v);
        //console.log(v, xl)
        if (aRange.downIsValue) {
          v = aRange.down;
        } else {
          v = aRange.down * serie.analyseResult.averages[0].average / 100;
        }
        var xy = g.toDomCoords(serie.analyseResult.averages[serie.analyseResult.averages.length - 1].end, serie.analyseResult.averages[0].average + v);
        //console.log(v, xy)

        canvas.fillStyle = "rgba(255, 255, 102, 1.0)";
        canvas.fillRect(xl[0], xl[1], area.w, xy[1] - xl[1]);
      }
    },
  });

  //  eltg.setAnnotations(annotationArray);

  globalSetSelectionRegression(serieData.length - 1);
  $(document).ready(function() {
    if (debug) console.log('document ready');
    eltg.resize();
  });
  window.onresize = function(event) {
    if (debug) console.log('onresize');
    eltg.resize();
  };
}

function showHeader() {
  if (serie.analyse === undefined) return;

  // samples
  $('#topBanner_numSamples').html(Object.keys(serie.samples).length);
  $('#topBanner_samples').show();

  if (serie.analyse.test) {
    $('#topBanner_statusTest').show();

    // status
    if (serie.analyseResult.isPassing) {
      $('#topBanner_statusPassing').html('Passing')
      $('#topBanner_statusPassing').addClass('green');
      $('#topBanner_statusPassing').removeClass('red');
    } else {
      $('#topBanner_statusPassing').html('Failed')
      $('#topBanner_statusPassing').addClass('red');
      $('#topBanner_statusPassing').removeClass('green');
      $('#topBanner_statusPassingSince').html('Since buildId ' + serie.analyseResult.failingSince)
    }
    $('#topBanner_status').show();
  }

  if (serie.analyse.benchmark) {
    $('#topBanner_benchmark').show();

    if (Object.keys(serie.samples).length > 1) {
      // build n-1
      var v = serieData[serieData.length - 1];
      if ((serieData.length - 2) >= 0) {
        var previousV = serieData[serieData.length - 2];
        var diff = (v - previousV).toFixed(2);
        var p = diff / previousV * 100;
        if (diff > 0) diff = '+' + diff;
        if (p > 0)
          $('#topBanner_lastBuildPourcent').html('+' + p.toFixed(2) + '%');
        else
          $('#topBanner_lastBuildPourcent').html(p.toFixed(2) + '%');

        $('#topBanner_lastBuildDiff').html('Diff ' + diff);
        $('#topBanner_lastBuild').show();
      }
    }

    // regression
    if (!serie.analyseResult.summary.error) {
      var p = serie.analyseResult.summary.current.ratio;
      if (p > 0)
        $('#topBanner_analysisMain').html('+' + p.toFixed(2) + '%');
      else
        $('#topBanner_analysisMain').html(p.toFixed(2) + '%');

      if (serie.analyseResult.summary.status === 'similar') {
        $('#topBanner_analysisBottom').html('Similar');
        $('#topBanner_analysisBottom').addClass('green');
        $('#topBanner_analysisBottom').removeClass('red');
        $('#topBanner_analysisMain').removeClass('red')
        $('#topBanner_analysisMain').addClass('green')
      }
      if (serie.analyseResult.summary.status === 'regression') {
        $('#topBanner_analysisMain').removeClass('green')
        $('#topBanner_analysisMain').addClass('red')
        $('#topBanner_analysisBottom').html('Regression');
        $('#topBanner_analysisBottom').addClass('red');
        $('#topBanner_analysisBottom').removeClass('green');
      }
      if (serie.analyseResult.summary.status === 'improvement') {
        $('#topBanner_analysisBottom').html('Improved');
        $('#topBanner_analysisBottom').addClass('green');
        $('#topBanner_analysisBottom').removeClass('red');
        $('#topBanner_analysisMain').removeClass('red')
        $('#topBanner_analysisMain').addClass('green')
      }
    }
    $('#topBanner_analysis').show();
  }
}

function drawTestGraph() {
  drawRawGraph();
}

function drawAnalyseGraph() {
  if (serie.analyse.benchmark)
    drawBenchmarkGraph();
  if (serie.analyse.test)
    drawTestGraph();
}

function uiLibOneReadyToProcessData() {

  if (debug) console.log('uiLibOneReadyToProcessData');
  NProgress.done();

  if (serie.analyse.test)
    $('#modalSerieType').html('Show test from ' + serie.projectId + ' project');
  else
    $('#modalSerieType').html('Show benchmark from ' + serie.projectId + ' project');

  var h = serieId + '<small>';
  if (serie.description)
    h += '<br>' + serie.description;
  if (serie.infos)
    h += '<br>' + JSON.stringify(serie.infos);
  h += '</small>'

  $('#modalSerieId').html(h);

  if (pageType === 'showOneSerie') {
    showHeader();
  }

  $('#rowForSampleSerie').show();
  $('#btnSeries').show()
  $('#btnRaw').show()
  $('#btnSeries').addClass('active')
  $('#btnRaw').removeClass('active')
  drawAnalyseGraph();

  if (pageType === 'showOneSerie') {
    initAnalysePanel();
    setAnalysePanel();
    $('#analyseFormRestore').click(function() {
      unselectAnalysePanel();
      serie.analyse = savedAnalyse;
      setAnalysePanel();
      analyse(serie);
      drawAnalyseGraph();
      $('#analyseChanged').hide();
    });
  }

  dumpRegressionTable();
  dumpComparesTable();

  if (pageType === 'showOneSerie') {
    if (dataTableObject === undefined)
      if (serie.url) {
        var h = '';
        var k = Object.keys(serie.url);
        k.sort(function(a, b) {
          return b * 1 - a * 1
        });
        if (k.length > 0) {
          for (var ii in k) {
            var c = serie.url[k[ii]];
            h += '<tr>';
            h += '<td>';
            b = builds[k[ii]];
            h += b.buildId + ' - ' + b.infos.abbrevHash + ' - ' + b.infos.authorName + ' - ' + b.infos.subject;
            h + '</td>';
            h += '<td><center>';
            h += '<div class="btn-group">';
            h += '<button type="button" onclick="showOpenSpongelinkBuild(' + k[ii] + ')" class="btn btn-primary btn-xs"><i class="fa fa-external-link" aria-hidden="true"></i></button>';
            h + '</div></center></td>';
            h += '</tr>';
          }
          $('#table_sponge').html(h);
          dataTableObject = $('#datatable_sponge').DataTable({
            "language": {
              "decimal": "."
            },
            paging: true, // paging: true if > to 10 entries
            info: true,
            "bFilter": true,
            "columnDefs": [{
              "targets": 'no-sort',
              "orderable": false
            }],
            "order": [
              [1, "desc"]
            ]
          });
          $('#spongeLinks').show();
        }
      }
  }

  var h = '';
  if (serie.comments) {
    for (var ii = serie.comments.length - 1; ii >= 0; ii--) {
      var c = serie.comments[ii];
      var d = new Date(c.date);
      h += '<b>';
      h += '#' + ii;
      if (c.ldap)
        if (c.ldap !== '')
          h += ' - ' + c.ldap;
      if (c.buildId)
        if (c.buildId !== '')
          h += ' - BuildId ' + c.buildId;
      h += ' - ' + d.toLocaleString();
      h += '</b>';
      h += '<br>';
      var s = '';
      for (var jj in c.text) {
        if (c.text[jj] === '\n') s += '<br />'
        else
        if (c.text[jj] === '\r') s += '<br />'
        else s += c.text[jj]
      }
      h += s;
      h += '<br>';
    }
  } else
    h += 'No comments';

  $('#commentsArea').html(h);
  $('#commentsArea').linkify({
    target: "_blank"
  });
}

function serieGetMinRange() {
  let min, max, currentRange;
  let k = Object.keys(serie.samples);
  for (let ii in k) {
    let sa = serie.samples[k[ii]];
    if (!min) min = max = sa;
    if (sa < min) min = sa;
    if (sa > max) max = sa;
  }
  /* OLD Version decrement until the first one works */
  /*
  currentRange = max - min;
  console.log('min=', min, 'max=', max, 'maxrange=', currentRange);
  while (true) {
    serie.analyse.benchmark.range = currentRange;
    analyse(serie);
    console.log(serie.analyseResult.averages.length)
    if (serie.analyseResult.averages.length !== 1) break;
    else currentRange--;
  }
  let preciseRange = currentRange + 1;
  console.log('PRECISE', 'min=', min, 'max=', max, 'minRange=', currentRange);
  */
  let maxit = 0;
  max = (max - min);
  min = 0;
  currentRange = Math.floor((max - min) / 2);
  while (maxit < 100000) {
    maxit++;
    serie.analyse.benchmark.range = currentRange;
    analyse(serie);
    if (serie.analyseResult.averages.length === 1) {
      max = currentRange;
      currentRange -= Math.floor((max - min) / 2);
      if (currentRange === max) {
        break;
      }
    } else {
      min = currentRange;
      currentRange += Math.floor((max - min) / 2);
      if (currentRange === min) {
        break;
      }
    }
  }
  if (debug) console.log('DICHOTOMIC', 'min=', min, 'max=', max, 'minRange=', currentRange);
  serie.analyse.benchmark.range = max;

  //if (preciseRange !== max) alert('New range is different PRECISE:' + preciseRange + ', new:' + max);
  socket.emit('serieUpdateAnalyse', {
    projectId: projectId,
    serieId: serieId,
    analyse: serie.analyse,
    comment: {
      text: 'Computing range to ' + serie.analyse.benchmark.range + ' to manage noise'
    }
  });
}

function serieChangeState(sel) {
  console.log('serieChangeState', sel)

  function setBaseLast(textComment) {
    console.log('serieChangeState', sel)
    var newBase = serieBuilds[serie.analyseResult.averages[serie.analyseResult.averages.length - 1].start];
    serie.analyse.base = newBase;
    analyse(serie);
    showHeader();
    drawAnalyseGraph();
    socket.emit('serieUpdateAnalyse', {
      projectId: projectId,
      serieId: serieId,
      analyse: serie.analyse,
      comment: {
        text: textComment
      }
    });
  }
  if (sel.value === 'regressionIntended') {
    console.log('serieChangeState', sel.value)
    setBaseLast('Regression Intended behavior, changing base');
  } else
  if (sel.value === 'improvementConfirmed') {
    setBaseLast('Improvement Confirmed, changing base');
  } else if (sel.value === 'regressionNoisy') {
    serieGetMinRange();
  } else if (sel.value === 'improvementNoisy') {
    serieGetMinRange();
  } else if (sel.value === 'similarNoisy') {
    serieGetMinRange();
  } else {
    socket.emit('serieUpdateSeriesState', {
      projectId: projectId,
      serieId: serieId,
      state: sel.value,
    });
    serie.state.analyse = sel.value;
  }
}

function serieChangeStateCompare(sel, compareId) {
  socket.emit('serieUpdateSeriesState', {
    projectId: projectId,
    serieId: serieId,
    state: sel.value,
    compareId: compareId
  });
  serie.state.compares[compareId] = sel.value;
}

function changeAssignee(sel, compareId) {

  socket.emit('serieUpdateAssignee', {
    projectId: projectId,
    serieId: serieId,
    assignee: sel.value,
    compareId: compareId
  });
  if (compareId) {
    serie.assignee.compares[compareId] = sel.value;
  } else {
    serie.assignee.analyse = sel.value;
  }
}

function getAssigneeTd(assignee, compareId) {
  let h = '';
  h = '<td data-order="' + assignee + '" data-filter="' + assignee + '">';
  if (compareId)
    h += '<select name="assignee" onchange="changeAssignee(this,\'' + compareId + '\');">';
  else
    h += '<select name="assignee" onchange="changeAssignee(this);">';
  h += '<option value="">None</option>';
  var k = projects[projectId].users.split(',');
  for (var ii = 0; ii < k.length; ii++) {
    h += '<option ';
    if (assignee === k[ii])
      h += 'selected ';
    h += 'value="' + k[ii] + '">' + k[ii] + '</option>';
  }
  h += '</select></td>';
  return (h);
}

function testsGetStateTdDesc(state) {
  let h = '';
  h = '<td data-order="' + state + '" data-filter="' + state + '">';
  h += '<select name="state" onchange="serieChangeState(this);">';

  if (state.indexOf('failing') !== -1) {
    h += '<option ';
    if (state === 'failingNeedstriage')
      h += 'selected ';
    h += 'value="failingNeedstriage">Needs Triage</option>'

    h += '<option ';
    if (state === 'failingConfirmed')
      h += 'selected ';
    h += 'value="failingConfirmed">Confirmed</option>'

    if (!projects[projectId].useBugTracker) {
      h += '<option ';
      if (state === 'failingAssigned')
        h += 'selected ';
      h += 'value="failingAssigned">Assigned</option>'

      h += '<option ';
      if (state === 'failingFixed')
        h += 'selected ';
      h += 'value="failingFixed">Fixed</option>'
    }
  } else {
    h += '<option ';
    if (state === 'passing')
      h += 'selected ';
    h += 'value="passing">Passing</option>'
  }

  h += '</select></td>';

  return (h);
}

function seriesGetStateTdDesc(state) {
  let h = '';
  h = '<td data-order="' + state + '" data-filter="' + state + '">';
  h += '<select name="state" onchange="serieChangeState(this);">';

  if (state.indexOf('regression') !== -1) {
    h += '<option ';
    if (state === 'regressionNeedstriage')
      h += 'selected ';
    h += 'value="regressionNeedstriage">Needs Triage</option>'

    h += '<option ';
    if (state === 'regressionNoisy')
      h += 'selected ';
    h += 'value="regressionNoisy">Noisy similar</option>'

    h += '<option ';
    if (state === 'regressionConfirmed')
      h += 'selected ';
    h += 'value="regressionConfirmed">Regression confirmed</option>'

    if (!projects[projectId].useBugTracker) {
      h += '<option ';
      if (state === 'regressionAssigned')
        h += 'selected ';
      h += 'value="regressionAssigned">Assigned</option>'

      h += '<option ';
      if (state === 'regressionFixed')
        h += 'selected ';
      h += 'value="regressionFixed">Fixed</option>'
    }

    h += '<option ';
    if (state === 'regressionIntended')
      h += 'selected ';
    h += 'value="regressionIntended">Intended behavior</option>'
  }

  if (state.indexOf('improvement') !== -1) {
    h += '<option ';
    if (state === 'improvementNeedstriage')
      h += 'selected ';
    h += 'value="improvementNeedstriage">Needs Triage</option>'

    h += '<option ';
    if (state === 'improvementNoisy')
      h += 'selected ';
    h += 'value="improvementNoisy">Noisy similar</option>'

    h += '<option ';
    if (state === 'improvementConfirmed')
      h += 'selected ';
    h += 'value="improvementConfirmed">Improvement confirmed</option>'
  }

  if (state.indexOf('similar') !== -1) {
    h += '<option ';
    if (state === 'similarNeedstriage')
      h += 'selected ';
    h += 'value="similarNeedstriage">Needs Triage</option>'

    h += '<option ';
    if (state === 'similarNoisy')
      h += 'selected ';
    h += 'value="similarNoisy">Noisy similar</option>'

    h += '<option ';
    if (state === 'similarConfirmed')
      h += 'selected ';
    h += 'value="similarConfirmed">Similar confirmed</option>'
  }
  h += '</select></td>';

  return (h);
}

function comparesGetStateTdDesc(state, compareId) {
  let h = '';
  h = '<td data-order="' + state + '" data-filter="' + state + '">';
  h += '<select name="state" onchange="serieChangeStateCompare(this,\'' + compareId + '\');">';

  if (state.indexOf('lower') !== -1) {
    h += '<option ';
    if (state === 'lowerNeedstriage')
      h += 'selected ';
    h += 'value="lowerNeedstriage">Needs Triage</option>'

    h += '<option ';
    if (state === 'lowerConfirmed')
      h += 'selected ';
    h += 'value="lowerConfirmed">Lower confirmed</option>'

    if (!projects[projectId].useBugTracker) {
      h += '<option ';
      if (state === 'lowerAssigned')
        h += 'selected ';
      h += 'value="lowerAssigned">Assigned</option>'

      h += '<option ';
      if (state === 'lowerFixed')
        h += 'selected ';
      h += 'value="lowerFixed">Fixed</option>'
    }

    h += '<option ';
    if (state === 'lowerIntended')
      h += 'selected ';
    h += 'value="lowerIntended">Intended behavior</option>'
  }

  if (state.indexOf('better') !== -1) {
    h += '<option ';
    if (state === 'betterNeedstriage')
      h += 'selected ';
    h += 'value="betterNeedstriage">Needs Triage</option>'

    h += '<option ';
    if (state === 'betterConfirmed')
      h += 'selected ';
    h += 'value="betterConfirmed">Better confirmed</option>'
  }

  if (state.indexOf('similar') !== -1) {
    h += '<option ';
    if (state === 'similarNeedstriage')
      h += 'selected ';
    h += 'value="similarNeedstriage">Needs Triage</option>'

    h += '<option ';
    if (state === 'similarConfirmed')
      h += 'selected ';
    h += 'value="similarConfirmed">Similar confirmed</option>'
  }
  h += '</select></td>';

  return (h);
}

function dumpRegressionTable() {
  var h = ''
  if (serie.analyse.benchmark) {
    h += '<thead>';
    h += '<tr>';
    //h += '<th>Regression analysis</th>';
    h += '<th style="width: 90px">State</th>'
    if (!projects[projectId].useBugTracker) {
      h += '<th>Assignee</th>';
    }
    h += '<th>Analysis</th>';
    h += '<th>BuildId</th>';
    h += '<th>Base</th>';
    h += '<th>Current</th>';
    h += '<th>Diff</th>';
    h += '<th>Ratio</th>';
    h += '<th style="width: 90px"></th>';
    h += '</tr>';
    h += '</thead>';
    h += '<tbody>';
    var s = serie.analyseResult.summary;
    h += '<tr>';

    if (s.error) {
      h += '<td></td>';
      if (!projects[projectId].useBugTracker) {
        h += '<td></td>';
      }
      h += '<td class="orange"><b>Not available</b></td>';
      h += '<td><a target="_blank" href="' + builds[s.lastBuildId].infos.url + '"' + builds[s.lastBuildId].infos.hash + '">' + s.lastBuildId + '</a></td>';
      h += '<td></td>';
      h += '<td></td>';
      h += '<td></td>';
      h += '<td></td>';
    } else {
      // convert an existing database
      if (serie.state.analyse === 'none') {
        if (serie.analyseResult.summary.status === "improvement")
          serie.state.analyse = 'improvementNeedstriage';
        else
          serie.state.analyse = 'similarNeedstriage';
      }
      if (serie.state.analyse === 'assigned') serie.state.analyse = 'regressionAssigned';
      if (serie.state.analyse === 'new') serie.state.analyse = 'regressionNeedstriage';
      if (serie.state.analyse === 'wontfix') serie.state.analyse = 'regressionIntended';

      h += seriesGetStateTdDesc(serie.state.analyse);
      var ass;
      if (serie.assignee)
        if (serie.assignee.analyse)
          ass = serie.assignee.analyse
      if (!projects[projectId].useBugTracker) {
        h += getAssigneeTd(ass);
      }

      if (serie.state.analyse.indexOf('similar') !== -1)
        h += '<td class="green"><b>Similar</b></td>';
      else if (serie.state.analyse.indexOf('regression') !== -1)
        h += '<td class="red"><b>Regression</b></td>';
      else if (serie.state.analyse.indexOf('improvement') !== -1)
        h += '<td class="green"><b>Improved</b></td>';
      h += '<td><a target="_blank" href="' + builds[s.lastBuildId].infos.url + '"' + builds[s.lastBuildId].infos.hash + '">' + s.lastBuildId + '</a></td>';
      h += '<td>' + s.base.average * 1 + '</td>';
      h += '<td>' + s.current.average * 1 + '</td>';
      h += '<td>' + s.current.diff * 1 + '</td>';
      h += '<td><b>' + s.current.ratio * 1 + '</b></td>';
    }
    h += '<td><center>';
    h += '<div class="btn-group">';
    if (serie.url) {
      if (serie.url[s.lastBuildId])
        h += '<button type="button" onclick="showOpenSpongelink()" class="btn btn-primary btn-xs"><i class="fa fa-external-link" aria-hidden="true"></i></button>';
      else
        h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-external-link" aria-hidden="true"></i></button>';
    } else
      h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-external-link" aria-hidden="true"></i></button>';
    h += '<button type="button" onclick="addBugLink()" class="btn btn-danger btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
    if (serie.bugLink) {
      if (serie.bugLink.series) {
        h += '<button type="button" onclick="showOpenBugLink()" class="btn btn-primary btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
      } else {
        h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
      }
    } else {
      h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
    }
    h += '</div>';
    h += '</center></td>';
    h += '</tr>';
    h += '</tbody>';
  }
  if (serie.analyse.test) {
    var s = serie.analyseResult;

    // convert an existing database
    if (s.isPassing)
      serie.state.analyse = 'passing';
    else {
      if (serie.state.analyse === 'assigned')
        serie.state.analyse = 'failingAssigned';
      else
        serie.state.analyse = 'failingNeedstriage';
    }
    h += '<thead>';
    h += '<tr>';
    h += '<th style="width: 90px">State</th>';
    if (!projects[projectId].useBugTracker) {
      h += '<th>Assignee</th>';
    }
    h += '<th >Analysis</th>';
    h += '<th >Last passing buildId</th>';
    h += '<th >Failing since buildId</th>';
    h += '<th >Last executed buildId</th>';
    h += '<th style="width: 90px" class="no-sort"></th>';
    h += '</tr>';
    h += '</thead>';
    h += '<tbody>';
    h += '<tr>';
    //h += '<td>Test</td>';
    h += testsGetStateTdDesc(serie.state.analyse);
    var ass;
    if (serie.assignee)
      if (serie.assignee.analyse)
        ass = serie.assignee.analyse
    if (!projects[projectId].useBugTracker) {
      h += getAssigneeTd(ass);
    }

    if (s.isPassing)
      h += '<td class="green"><b>Passing</b></td>';
    else
      h += '<td class="red"><b>Failed</b></td>';

    if (s.lastPassing)
      h += '<td><a target="_blank" href="' + builds[s.lastPassing].infos.url + '"' + builds[s.lastPassing].infos.hash + '">' + s.lastPassing + '</a></td>';
    else
      h += '<td>---</td>';

    if (s.isPassing)
      h += '<td>--</td>';
    else
      h += '<td><a target="_blank" href="' + builds[s.failingSince].infos.url + '"' + builds[s.failingSince].infos.hash + '">' + s.failingSince + '</a></td>';

    h += '<td><a target="_blank" href="' + builds[s.lastExecuted].infos.url + '"' + builds[s.lastExecuted].infos.hash + '">' + s.lastExecuted + '</a></td>';
    h += '<td><center>';
    h += '<div class="btn-group">';
    if (serie.url) {
      if (serie.url[serie.lastBuildId])
        h += '<button type="button" onclick="showOpenSpongelink()" class="btn btn-primary btn-xs"><i class="fa fa-external-link" aria-hidden="true"></i></button>';
      else
        h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-external-link" aria-hidden="true"></i></button>';
    } else
      h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-external-link" aria-hidden="true"></i></button>';
    h += '<button type="button" onclick="addBugLink()" class="btn btn-danger btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
    if (serie.bugLink) {
      if (serie.bugLink.series) {
        h += '<button type="button" onclick="showOpenBugLink()" class="btn btn-primary btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
      } else {
        h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
      }
    } else {
      h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
    }
    h += '</div>';
    h += '</center></td>';
    h += '</tr>';
    h += '</tbody>';
  }

  $('#table_uilibone_regression').html(h);
}

function showOpenSpongelink() {
  if (debug) console.log('showOpenSpongelink')
  window.open(serie.url[serie.lastBuildId], "_blank");
}

function showOpenSpongelinkBuild(buildId) {
  console.log('showOpenSpongelinkBuild', buildId, serie.url[buildId]);
  window.open(serie.url[buildId], "_blank");
}

function dumpComparesTable() {
  var h = '';
  if (serie.compares === undefined) return;

  h += '<thead>';
  h += '<tr>';
  h += '<th >Comparator</th>';
  h += '<th style="width: 90px">State</th>';
  if (!projects[projectId].useBugTracker) {
    h += '<th >Assignee</th>';
  }
  h += '<th >Analysis</th>';
  h += '<th >My value</th>';
  h += '<th >Compare value</th>';
  h += '<th >Diff</th>';
  h += '<th >Ratio</th>';
  h += '<th style="width: 90px"></th>';
  h += '</tr>';
  h += '</thead><tbody>';

  var k = Object.keys(serie.compares);
  for (var ii = 0; ii < k.length; ii++) {
    var sc = serie.compares[k[ii]];
    let stateCompare = serie.state.compares[k[ii]];

    // convert an existing database
    if (stateCompare === 'none') {
      if (serie.compares[k[ii]].result.status === "improvement")
        stateCompare = 'improvementNeedstriage';
      else
        stateCompare = 'similarNeedstriage';
    }
    if (stateCompare === 'assigned') stateCompare = 'lowerAssigned';
    if (stateCompare === 'new') stateCompare = 'lowerNeedstriage';
    if (stateCompare === 'wontfix') stateCompare = 'lowerIntended';
    serie.state.compares[k[ii]] = stateCompare;

    h += '<tr>';
    h += '<td>' + sc.description + '</td>';

    h += comparesGetStateTdDesc(stateCompare, k[ii]);
    var ass;
    if (serie.assignee)
      if (serie.assignee.compares)
        if (serie.assignee.compares[k[ii]])
          ass = serie.assignee.compares[k[ii]]
    if (!projects[projectId].useBugTracker) {
      h += getAssigneeTd(ass, k[ii]);
    }
    if (stateCompare.indexOf('better') !== -1)
      h += '<td class="green"><b>Better</b></td>'
    if (stateCompare.indexOf('similar') !== -1)
      h += '<td class="green"><b>Similar</b></td>'
    if (stateCompare.indexOf('lower') !== -1)
      h += '<td class="red"><b>Lower</b></td>'
    h += '<td>' + sc.result.myValue + '</td>';
    h += '<td>' + sc.result.compareValue + '</td>';
    var p = sc.result.diff / sc.result.compareValue * 100;
    if (sc.result.diff > 0) {
      h += '<td>+' + sc.result.diff.toFixed(2) + '</td>';
      h += '<td><b>+' + p.toFixed(2) + '%</b></td>';
    } else {
      h += '<td>' + sc.result.diff.toFixed(2) + '</td>';
      h += '<td><b>' + p.toFixed(2) + '%</b></td>';
    }
    h += '<td><center>';
    h += '<div class="btn-group">';

    h += '<button type="button" onclick="openEditCompareSerie(\'' + k[ii] + '\')" class="btn btn-danger btn-xs"><i class="fa fa-pencil" aria-hidden="true"></i></button>';

    h += '<button type="button" onclick="addBugLinkCompare(\'' + k[ii] + '\')" class="btn btn-danger btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
    if (serie.bugLink) {
      if (serie.bugLink.compares[k[ii]]) {
        h += '<button type="button" onclick="showOpenBugLink(\'' + k[ii] + '\')" class="btn btn-primary btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
      } else {
        h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
      }
    } else {
      h += '<button type="button" disabled class="btn btn-primary btn-xs"><i class="fa fa-bug" aria-hidden="true"></i></button>';
    }

    h += '</div>';
    h += '</center></td>';
    h += '</tr>';
  }
  h += '</tbody>';
  $('#table_uilibone_compares').html(h);
  $('#compares').show();
}

function openEditCompareSerie(compareId) {
  window.open('/serie?' + compares[compareId].compareWith.projectId + '?' + serieId);
}

function showOpenBugLink(compareId) {
  if (compareId)
    window.open(serie.bugLink.compares[compareId], "_blank");
  else
    window.open(serie.bugLink.series, "_blank");
}

function legendFormatter(data) {
  return '';
}

function globalShowBuildInfo(idx) {
  var b = builds[serieBuilds[idx]];
  var i = b.buildId + ' - ' + b.infos.abbrevHash + ' - ' + b.infos.authorName + ' - ' + b.infos.subject;
  i = i.substring(0, 90);
  document.getElementById('buildInfo').innerHTML = '<a href="' + b.infos.url + '"><b style="color:grey;">' + i + '</b > </a>';
}

function globalSetSelectionRegression(idx) {
  var h = '';
  var e = document.getElementById('valueinfo');
  eltg.setSelection(idx);
  if (serie.analyseResult.summary.error) {
    h = 'Analysis not available';
  } else {
    var idxAvg;
    for (var ii = 0; ii < serie.analyseResult.averages.length; ii++) {
      if ((serie.analyseResult.averages[ii].start <= idx) && (idx <= serie.analyseResult.averages[ii].end)) {
        idxAvg = ii;
        break;
      }
    }
    if (debug) console.log(idxAvg);

    if (idxAvg === undefined) {
      e.innerHTML = 'Analysis not available';
      globalShowBuildInfo(idx);
      return;
    }

    var v = serie.analyseResult.averages[idxAvg].average;
    var status = serie.analyseResult.averages[idxAvg].status;

    if (idxAvg === undefined) alert('idxAvg NOT FOUND');
    var previousV = serie.analyseResult.averages[serie.analyseResult.details.first].average;

    //h +='<center>';
    h += 'Base average = <b>' + previousV + '</b> ';
    h += 'Current average = <b>'

    if (v === null)
      h += '--- ---';
    else {
      if (previousV === null)
        h += v + ' ---';
      else {
        var diff = (v - previousV);
        var p = diff / previousV * 100;
        if (diff === 0) {
          h += "<span style='color:green'>";
          h += v;
          h += "</span>";
        } else {
          if (status === 'regression')
            h += "<span style='color:red'>";
          else
            h += "<span style='color:green'>";

          if (p > 0) {
            h += v + ' (+' + diff.toFixed(2) + ' +' + p.toFixed(2) + '%)';
            h += "</span>";
          } else {
            h += v + ' (' + diff.toFixed(2) + ' ' + p.toFixed(2) + '%)';
            h += "</span>";
          }
        }
      }
    }
    h += '</b><br>';

    var v = serieData[idx];
    h += 'Value = <b>';
    h += v;
    h += '</b> ';
    h += 'Diff current average = <b>';
    var ca = Math.floor(serie.analyseResult.averages[idxAvg].average);
    var diff = (v - ca);
    var p = diff / ca * 100;
    if (diff === 0)
      h += '(0)';
    if (diff > 0)
      h += '(+' + diff.toFixed(2) + ' +' + p.toFixed(2) + '%)';
    if (diff < 0)
      h += '(' + diff.toFixed(2) + ' ' + p.toFixed(2) + '%)';
    h += '</b> ';

    if ((idxAvg - 1) > 0) {
      h += 'Diff previous average = <b>';
      var ca = Math.floor(serie.analyseResult.averages[idxAvg - 1].average);
      var diff = (v - ca);
      var p = diff / ca * 100;
      if (diff === 0)
        h += '(0)';
      if (diff > 0)
        h += '(+' + diff.toFixed(2) + ' +' + p.toFixed(2) + '%)';
      if (diff < 0)
        h += '(' + diff.toFixed(2) + ' ' + p.toFixed(2) + '%)';
      h += '</b> ';
    }
    //h += '</center>';
  }
  e.innerHTML = h;
  globalShowBuildInfo(idx);
}

function uiShowSerieClean() {
  document.getElementById('buildInfo').innerHTML = "";
  document.getElementById('valueinfo').innerHTML = "";
  document.getElementById('elt_dygraph').innerHTML = "";
}

function unselectAnalysePanel() {
  var a = serie.analyse;

  if (a.base !== undefined) {
    $('#analyseBase' + a.base).prop("selected", false)
  }

  if (a.benchmark !== undefined) {
    $('#analyseTypeBenchmark').prop("selected", false)
    if (a.benchmark.trend !== undefined) {
      if (a.benchmark.trend === 'higher') {
        $('#analyseBenchmarkTrendHigher').prop("selected", false)
      } else {
        $('#analyseBenchmarkTrendSmaller').prop("selected", false)
      }
    } else $('#analyseBenchmarkTrendSmaller').prop("selected", false)
  }

  if (a.test !== undefined) {
    $('#analyseTypeTest').prop("selected", false)
    if (a.test.propagate !== undefined) {
      if (a.test.propagate === true)
        $('#analyseTestPropagateTrue').prop("selected", false)
      else
        $('#analyseTestPropagateFalse').prop("selected", false)
    } else $('#analyseTestPropagateFalse').prop("selected", false)
  }
}

function initAnalysePanel() {

  $(document).ready(function() {
    $("#analyseBase").select2({
      placeholder: "Base is first buildId",
      allowClear: true
    });
    $("#stateAssignee").select2({
      placeholder: "Enter username",
      allowClear: true
    });
    for (var ii = 0; ii < serieBuilds.length; ii++) {
      $('#analyseBase').append($('<option>', {
        value: serieBuilds[ii],
        text: 'Use build ' + serieBuilds[ii] + ' - ' + builds[serieBuilds[ii]].infos.authorName + ' - ' + builds[serieBuilds[ii]].infos.subject,
        id: 'analyseBase' + serieBuilds[ii]
      }));
    }
    var k = projects[projectId].users.split(',');
    for (var ii = 0; ii < k.length; ii++) {
      $('#stateAssignee').append($('<option>', {
        value: k[ii],
        text: k[ii],
        id: 'stateAssignee' + k[ii]
      }));
    }
  });
}

function setAnalysePanel() {
  var a = serie.analyse;
  if (a.base !== undefined) {
    $('#analyseBase' + a.base).prop("selected", true);
    $('#analyseBase').val(a.base).trigger("change")
  }

  if (a.benchmark !== undefined) {
    $('#analyseBenchmarkForm').show();
    $('#analyseTypeBenchmark').prop("selected", true)
    if (a.benchmark.range !== undefined) {
      $('#analyseBenchmarkRange').val(a.benchmark.range);
    }
    if (a.benchmark.trend !== undefined) {
      if (a.benchmark.trend === 'higher') {
        $('#analyseBenchmarkTrendHigher').prop("selected", true)
      } else {
        $('#analyseBenchmarkTrendSmaller').prop("selected", true)
      }
    } else $('#analyseBenchmarkTrendSmaller').prop("selected", true)

    if (a.benchmark.required !== undefined) {
      $('#analyseBenchmarkRequired').val(a.benchmark.required);
    }
  }
  if (a.test !== undefined) {
    $('#analyseTestForm').show();
    if (a.test.propagate !== undefined) {
      if (a.test.propagate === true)
        $('#analyseTestPropagateTrue').prop("selected", true)
      else
        $('#analyseTestPropagateFalse').prop("selected", true)
    } else $('#analyseTestPropagateFalse').prop("selected", true)
  }
}

function addNewComment() {
  var comment = {};
  comment.text = $('#commentText').val();
  if (comment.text === "") {
    alert('Need a Text to add comment');
    return;
  }
  socket.emit('serieAddComment', {
    projectId: projectId,
    serieId: serieId,
    comment: comment
  });
  $('#commentText').val('');
  clearSelect2s();

}

function applyAnalyse() {
  if (debug) console.log('applyAnalyse');
  console.log('applyAnalyse');
  // extract analyse from form
  var newAnalyse = {};
  if ($('#analyseBase').val() !== '')
    newAnalyse.base = $('#analyseBase').val() * 1;

  if (serie.analyse.benchmark) {
    newAnalyse.benchmark = {};
    if ($('#analyseBenchmarkRange').val() !== '')
      newAnalyse.benchmark.range = $('#analyseBenchmarkRange').val();
    if ($('#analyseBenchmarkTrend').val() === 'smaller')
      newAnalyse.benchmark.trend = 'smaller'
    else
      newAnalyse.benchmark.trend = 'higher'
    if ($('#analyseBenchmarkRequired').val() !== '')
      newAnalyse.benchmark.required = $('#analyseBenchmarkRequired').val() * 1;
  }
  if (serie.analyse.test) {
    newAnalyse.test = {};
    if ($('#analyseTestPropagate').val() === 'true')
      newAnalyse.test.propagate = true;
  }

  if (debug) console.log(newAnalyse)
  serie.analyse = newAnalyse;
  analyse(serie);
  showHeader();
  drawAnalyseGraph();

  $('#analyseText').val("");
  $('#analyseChanged').show();
}

function clearSelect2s() {
  $('#stateAssignee').val('').trigger("change")
}

function saveCurrentAnalyse() {
  if (debug) console.log('saveCurrentAnalyse');
  var comment = {};
  comment.text = $('#analyseText').val();
  socket.emit('serieUpdateAnalyse', {
    projectId: projectId,
    serieId: serieId,
    analyse: serie.analyse,
    comment: comment
  });
  $('#analyseChanged').hide();
  clearSelect2s();
}

function openSetAssigneeModal(target) {
  stateTarget = target;
  var state;
  var assignee;
  if (target) {
    $('#modal-target').html(compares[target].description);
    state = serie.state.compares[target];
    if (serie.assignee !== undefined)
      if (serie.assignee.compares !== undefined)
        assignee = serie.assignee.compares[target];
  } else {
    $('#modal-target').html('regression analysis');
    state = serie.state.analyse;
    if (serie.assignee !== undefined)
      assignee = serie.assignee.analyse
  }

  $('#stateText').val("");
  if (assignee === undefined)
    $('#stateAssignee').val('').trigger("change")
  else
    $('#stateAssignee').val(assignee).trigger("change")
  // clear changeState
  $('#modalChangeState').modal();
}

function modalSaveAssignee() {
  if (debug) console.log('modalSaveAssignee');

  var assignee = $('#stateAssignee').val();
  if (assignee === '') assignee = undefined;

  var comment = {};
  comment.text = $('#stateText').val();

  socket.emit('serieUpdateAssignee', {
    projectId: projectId,
    serieId: serieId,
    assignee: assignee,
    stateTarget: stateTarget,
    comment: comment
  });
  $('#modalChangeState').modal('hide');
  clearSelect2s();
}

function addBugLink() {
  modalBugLinkCompareId = undefined;
  if (serie.analyse.benchmark)
    addBugLinkBenchmark();
  else
    addBugLinkTest();
  $('#myModalAddBugLink').modal();
}

function addBugLinkTest() {
  var s = serie.analyseResult;
  $('#AddBugLink_Link').val('');
  if (serie.bugLink) {
    if (serie.bugLink.series) {
      $('#AddBugLink_Link').val(serie.bugLink.series);
    }
  }
  var report = '';
  if (s.isPassing) {
    report += 'Test passing';
    $('#proposalSubjectForBugReport').val(report);
    $('#proposalForBugReport').val('');
    return;
  }
  report += 'Test failing';
  $('#proposalSubjectForBugReport').val(report);
  report = '';
  report += 'Test: ' + serieId;
  report += '\r\n\r\n';
  if (serie.description)
    report += 'Description: ' + serie.description + '\r\n\r\n';
  report += 'Regression analysis details:';
  report += '\r\n';
  report += '- last passing buildId: ' + s.lastPassing;
  report += '\r\n';
  report += '- test failing since buildId: ' + s.failingSince;
  report += '\r\n';
  report += '- last executed buildId: : ' + s.lastExecuted;
  report += '\r\n\r\n';
  report += 'Links:';
  report += '\r\n';
  report += '- test: ' + danaUrl + '/serie?' + projectId + '?' + encodeURI(serieId);
  report += '\r\n';
  report += '- project tests status: ' + danaUrl + '/' + projectId + '/statusTests';
  report += '\r\n';
  report += '- dana instance: ' + danaUrl;
  $('#proposalForBugReport').val(report);
}

function addBugLinkBenchmark() {
  $('#AddBugLink_Link').val('');
  if (serie.bugLink) {
    if (serie.bugLink.series) {
      $('#AddBugLink_Link').val(serie.bugLink.series);
    }
  }
  var report = '';
  var s = serie.analyseResult.summary;
  if (s.error) {
    report += 'Regression status: undefined';
  } else {
    if (serie.state.analyse.indexOf('similar') !== -1)
      report += 'Regression status: similar';
    else if (serie.state.analyse.indexOf('regression') !== -1)
      report += 'Regression status: regression';
    else if (serie.state.analyse.indexOf('improvement') !== -1)
      report += 'Regression status: improvement';
    else
      report += 'Regression status: undefined';
  }
  report += ' ';
  if (s.current.ratio > 0)
    report += '+';
  report += s.current.ratio + '% confirmed';
  $('#proposalSubjectForBugReport').val(report);
  report = '';
  report += 'Benchmark: ' + serieId;
  report += '\r\n\r\n';
  if (serie.description)
    report += 'Description: ' + serie.description + '\r\n\r\n';
  report += 'Regression analysis details:';
  report += '\r\n';
  if (s.error) {
    report += '- status: undefined';
  } else {
    if (serie.state.analyse.indexOf('similar') !== -1)
      report += '- status: similar';
    else if (serie.state.analyse.indexOf('regression') !== -1)
      report += '- status: regression';
    else if (serie.state.analyse.indexOf('improvement') !== -1)
      report += '- status: improvement';
    else
      report += '- status: undefined';
  }
  report += '\r\n';
  report += '- last buildId run: ' + s.lastBuildId;
  report += '\r\n';
  report += '- computed base average for analysis computation: ' + s.base.average;
  report += '\r\n';
  report += '- last computed average: : ' + s.current.average;
  report += '\r\n';
  report += '- current difference with base: ';
  if (s.current.diff > 0)
    report += '+';
  report += s.current.diff;
  report += '\r\n';
  report += '- current ratio with base: ';
  if (s.current.ratio > 0)
    report += '+';
  report += s.current.ratio + '%';
  report += '\r\n\r\n';
  report += 'Links:';
  report += '\r\n';
  report += '- benchmark: ' + danaUrl + '/serie?' + projectId + '?' + encodeURI(serieId);
  report += '\r\n';
  report += '- project benchmark status: ' + danaUrl + '/' + projectId + '/statusSeries';
  report += '\r\n';
  report += '- dana instance: ' + danaUrl;
  $('#proposalForBugReport').val(report);
}

function addBugLinkCompare(compareId) {
  modalBugLinkCompareId = compareId;
  var c = serie.compares[compareId];
  var p = c.result.diff / c.result.compareValue * 100;

  if (serie.bugLink)
    if (serie.bugLink.compares[compareId]) {
      $('#AddBugLink_Link').val(serie.bugLink.compares[compareId]);
    } else $('#AddBugLink_Link').val('');
  var report = '';
  if (serie.state.compares[compareId].indexOf('similar') !== -1)
    report += 'Compare status: similar';
  else if (serie.state.compares[compareId].indexOf('lower') !== -1)
    report += 'Compare status: lower';
  else if (serie.state.compares[compareId].indexOf('better') !== -1)
    report += 'Compare status: better';
  report += ' ';
  if (c.result.diff == 0) {
    report += '0%';
  } else {
    if (c.result.diff > 0)
      report += '+';
    report += p.toFixed(2) + '%';
  }
  report += ' confirmed';
  $('#proposalSubjectForBugReport').val(report);
  report = '';
  report += 'Benchmark: ' + serieId;
  report += '\r\n\r\n';
  report += 'Compare: ' + compareId;
  report += '\r\n';
  if (c.description)
    report += 'Description: ' + c.description + '\r\n\r\n';
  report += 'Compare analysis details:';
  report += '\r\n';
  if (serie.state.compares[compareId].indexOf('similar') !== -1)
    report += '- status: similar';
  else if (serie.state.compares[compareId].indexOf('lower') !== -1)
    report += '- status: lower';
  else if (serie.state.compares[compareId].indexOf('better') !== -1)
    report += '- status: better';
  report += '\r\n';
  report += '- my value: ' + c.result.myValue;
  report += '\r\n';
  report += '- compare value: ' + c.result.compareValue;
  report += '\r\n';
  report += '- raw difference: ';
  if (c.result.diff > 0)
    report += '+';
  report += c.result.diff;
  report += '\r\n';
  report += '- ratio: '
  if (c.result.diff == 0) {
    report += '0%';
  } else {
    if (c.result.diff > 0)
      report += '+';
    report += p.toFixed(2) + '%';
  }
  report += '\r\n\r\n';
  report += 'Links:';
  report += '\r\n';
  report += '- benchmark: ' + danaUrl + '/serie?' + projectId + '?' + encodeURI(serieId);
  report += '\r\n';
  report += '- project compare status: ' + danaUrl + '/' + projectId + '/status' + compareId;
  report += '\r\n';
  report += '- dana instance: ' + danaUrl;
  $('#proposalForBugReport').val(report);
  $('#myModalAddBugLink').modal();
}

$('#modalSaveBugLink').click(function() {
  var bugLink = $('#AddBugLink_Link').val();
  alert('serieUpdateBugLink ' + projectId + ' ' + serieId + ' ' + bugLink + ' ' + modalBugLinkCompareId);
  socket.emit('serieUpdateBugLink', {
    projectId: projectId,
    serieId: serieId,
    bugLink: bugLink,
    compareId: modalBugLinkCompareId
  });
  if (serie.bugLink === undefined) {
    serie.bugLink = {};
    if (serie.analyse.benchmark) {
      serie.bugLink.compares = {};
    }
  }
  if (modalBugLinkCompareId === undefined)
    serie.bugLink.series = bugLink;
  else
    serie.bugLink.compares[modalBugLinkCompareId] = bugLink;
});
$('#modalCopySubjectClipboard').click(function() {
  var copyText = document.getElementById("proposalSubjectForBugReport");
  copyText.select();
  document.execCommand("Copy");
})
$('#modalCopyClipboard').click(function() {
  var copyText = document.getElementById("proposalForBugReport");
  copyText.select();
  document.execCommand("Copy");
})