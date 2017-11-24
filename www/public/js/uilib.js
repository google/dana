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

//var socket;
var debug = false;
var repo = {};
var tables = {};
var globalG = [];
var minMax = {
  min: undefined,
  max: undefined
}
var useMinMax = true;

function globalSetSelection(idx) {
  if (useMinMax) idx = idx + minMax.min;
  for (var ii = 0; ii < globalG.length; ii++) {
    globalG[ii].eltg.setSelection(idx - minMax.min);
    if (debug) console.log('globalSetSelection', ii, globalG[ii].row, globalG[ii].serie, idx);
    if (debug) console.log('globalSetSelection', globalG[ii].tw.data[globalG[ii].row][globalG[ii].serie]);
    var v = globalG[ii].tw.data[globalG[ii].row][globalG[ii].serie][idx];
    if (debug) console.log(ii, idx, v)
    var e = document.getElementById(globalG[ii].tw.target + '_data_' + globalG[ii].row + '_' + globalG[ii].serie);

    if (globalG[ii].tw.showDiff) {
      if (debug) console.log('yo', ii, idx, v)
      if (idx === minMax.min) {
        if (v === null)
          e.innerHTML = '<center><b>---<br>---</b></center>';
        else
          e.innerHTML = '<center><b>' + v + '<br>---</b></center>';
      } else {
        var previousV = null;
        for (var jj = (idx - 1); jj >= minMax.min; jj--) {
          if (globalG[ii].tw.data[globalG[ii].row][globalG[ii].serie][jj] !== null) {
            previousV = globalG[ii].tw.data[globalG[ii].row][globalG[ii].serie][jj];
            break;
          }
        }
        if (debug) console.log('yo2', v, previousV)

        if (v === null)
          e.innerHTML = '<center><b>---<br>---</b></center>';
        else {
          if (previousV === null) {
            e.innerHTML = '<center><b>' + v + '<br>---</b></center>';
          } else {
            var diff = (v - previousV);
            if (diff > 0) {
              //e.innerHTML = '<center><b>' + v + ' ( +' + diff + ' )</b></center>';
              e.innerHTML = '<center><b>' + v + '<br>( +' + diff + ' )</b></center>';

              //$(e).css('background-color','#CCFFCC');
            } else {
              e.innerHTML = '<center><b>' + v + '<br>( ' + diff + ' )</b></center>';
              //$(e).css('background-color','#FFCCCC');
            }
          }
        }
      }
    } else {
      if (v === null)
        e.innerHTML = '<center><b>---</b></center>';
      else
        e.innerHTML = '<center><b>' + v + '</b></center>';
      //$(e).css('background-color','#CCFFFF');
    }

    if (globalG[ii].tw.ref !== undefined) {
      var e = document.getElementById(globalG[ii].tw.target + '_ref_' + globalG[ii].row + '_' + globalG[ii].serie);
      var r = globalG[ii].tw.dataRef[globalG[ii].row][globalG[ii].serie];
      var diff = (v - r);
      if (diff > 0) {
        e.innerHTML = '<center><b>' + r + ' ( +' + diff + ' )</b></center>';
        $(e).css('background-color', '#CCFFCC');
      } else {
        e.innerHTML = '<center><b>' + r + ' ( ' + diff + ' )</b></center>';
        $(e).css('background-color', '#FFCCCC');
      }
    }

    if (debug) console.log('IDX=', idx);
    var b = repo.builds[idx];
    var i = b.buildId + ' - ' + b.infos.abbrevHash + ' - ' + b.infos.authorName + ' - ' + b.infos.subject;
    i = i.substring(0, 80);
    if (debug) console.log(globalG[ii].tw.target + '_buildInfo', b.infos.url);
    if (b.infos.url)
      document.getElementById(globalG[ii].tw.target + '_buildInfo').innerHTML = '<a href="' + b.infos.url + '"><b style="color:grey;">' + i + '</b></a>';
    else
      document.getElementById(globalG[ii].tw.target + '_buildInfo').innerHTML = '<a><b>' + i + '</b></a>';
  }
}

function getColorRegression(s) {
  if (s.analyseResult.summary.error)
    return ["rgb(22,22,22)"];
  if (s.analyseResult.summary.status === 'similar') return ["rgb(20,20,250)"];
  if (s.analyseResult.summary.status === 'improvement') return ["rgb(20,140,20)"];
  if (s.analyseResult.summary.status === 'regression') return ["rgb(250,16,16)"];
}

function buildTableWidget(tw, option) {
  var lastBuild = Object.keys(repo.builds).length - 1;
  if (useMinMax) lastBuild = minMax.max * 1 - minMax.min * 1;
  if (debug) console.log('lastBuild', minMax.min, minMax.max, lastBuild)
  var h = '';
  h += '<div class="col-md-12 col-sm-12 col-xs-12">';
  h += '<div class="x_panel">';
  h += '<div class="x_title">';
  h += '<h2>' + tw.title.name + '<small>' + tw.title.subtitle + '</small></h2>';
  //h+= '<span class="pull-right"><p>Test</p></span>'; h+='<span class="label label-success pull-right">Coming Soon</span>'
  h += '<ul class="nav navbar-right panel_toolbox">';
  h += '<li id="' + tw.target + '_buildInfo"><a><b style="color:grey;">HashId #0009993 - Get locale things done in time - gavra@google.com</b></a>';
  h += '</li>';
  h += '<li><a id="' + tw.target + '_collapse-link" class="collapse-link"><i class="fa fa-chevron-up"></i></a>';
  h += '</li>';
  h += '<li><a id="' + tw.target + '_close-link" class="close-link"><i class="fa fa-close"></i></a>';
  h += '</li>';

  h += '</ul>';

  h += '<div class="clearfix"></div>';
  h += '</div>';
  h += '<div class="x_content">';
  h += '<table id="' + tw.target + '_table" class="table table-striped table-bordered">';
  h += '<thead>';
  h += '<tr>';
  var w1 = Math.floor(tw.widthGraph / tw.rows.length);
  var w2 = Math.floor(tw.widthData / tw.rows.length);
  var w3;
  if (tw.ref !== undefined)
    w3 = Math.floor(tw.widthRef / tw.rows.length);
  h += '<th width="' + tw.widthSerie + '%"></th>';
  for (var jj = 0; jj < tw.rows.length; jj++) {
    h += '<th class="no-sort" width="' + w1 + '%"><center>' + tw.rows[jj].name + '</center></th>';
    if (tw.rows[jj].desc === undefined)
      h += '<th class="no-sort" width="' + w2 + '%"><center>ms</center></th>';
    else
      h += '<th class="no-sort" width="' + w2 + '%"><center>' + tw.rows[jj].desc + '</center></th>';

    if (tw.ref !== undefined)
      h += '<th class="no-sort" width="' + w3 + '%"><center>ref</center></th>';
  }
  h += '</tr>';
  h += '</thead>';
  h += '<tbody>';
  for (var ii = 0; ii < tw.series.length; ii++) {
    //per serie
    h += '<tr>';
    if (tw.series[ii].href === undefined)
      h += '<td width="' + tw.widthSerie + '%">' + tw.series[ii].name + '</td>';
    else
      h += '<td width="' + tw.widthSerie + '%"><a href="' + tw.series[ii].href + '"><i class="fa fa-link" aria-hidden="true"></i> ' + tw.series[ii].name + ' </a></td>';

    for (var jj = 0; jj < tw.rows.length; jj++) {
      //per col
      h += '<td>';
      h += '<div width="' + w1 + '%" style="height: 16px;" id="' + tw.target + '_dygraph_' + jj + '_' + ii + '"></div>';
      h += '</td>';
      h += '<td width="' + w2 + '%" id="' + tw.target + '_data_' + jj + '_' + ii + '"></td>';
      if (tw.ref !== undefined) {
        h += '<td id="' + tw.target + '_ref_' + jj + '_' + ii + '"></td>';
      }
    }
    //end serie
    h += '</tr>';
  }
  h += '</tbody></table></div></div></div>';
  document.getElementById(tw.target).innerHTML = h;

  $(document).ready(function() {
    uiSetupPanelsEvents(tw.target);

    function dataConvert(data) {
      var d = [];
      for (var ii = 0; ii < data.length; ii++) {
        if (useMinMax) {
          if ((ii >= minMax.min) && (ii <= minMax.max)) {
            var e = [ii, data[ii]];
            d.push(e);
          }
        } else {
          var e = [ii, data[ii]];
          d.push(e);
        }
      }
      return d;
    };

    var colors;

    //now insert the graphs
    for (var ii = 0; ii < tw.series.length; ii++) {
      for (var jj = 0; jj < tw.rows.length; jj++) {
        var e = document.getElementById(tw.target + '_dygraph_' + jj + '_' + ii);
        if (tw.data[jj][ii] === undefined) {
          e.innerHTML = ('<center>---</center>');
          $(document).ready(function() {
            if (debug) console.log('ready');
            for (var ii in globalG)
              globalG[ii].eltg.resize();
          });
          continue;
        }
        var d = dataConvert(tw.data[jj][ii]);
        if (tw.s[jj][ii] === 'dontexist') {
          colors = ["rgb(40,40,204)"];
        } else {
          colors = getColorRegression(tw.s[jj][ii]);
        }
        //colors = ["rgb(40,40,204)"];

        var eltg;
        eltg = new Dygraph(e, d, {
          axes: {
            x: {
              drawGrid: false,
              drawAxis: false
            },
            y: {
              drawGrid: false,
              drawAxis: false
            }
          },
          strokeWidth: 1.0,
          //rollPeriod: 7,
          labelsDiv: '',
          labels: ['', ''],
          highlightCircleSize: 4,
          legend: '',
          legendFormatter: legendFormatter,
          stackedGraph: true,
          connectSeparatedPoints: true,
          colors: colors,
          highlightCallback: function(e, x, pts, row) {
            if (debug) console.log('highlightCallback', e, x, pts, row)
            globalSetSelection(row);
          },
          unhighlightCallback: function(e) {
            if (debug) console.log('unhighlightCallback', e);
          },
          clickCallback: function(e, x, pts) {
            if (debug) console.log("Click", this, e, x, pts);
            var el = globalG[this.globalGIndex];
            if (debug) console.log(el.tw);
            if (debug) console.log("/serie?" + repo.projectId + '?' + el.tw.serieId[el.row][el.serie]);
            window.open("/serie?" + repo.projectId + '?' + el.tw.serieId[el.row][el.serie], "_blank");
          }
        });
        tw.graphs[jj][ii] = eltg;
        eltg.globalGIndex = globalG.length;
        globalG.push({
          tw: tw,
          serie: ii,
          row: jj,
          eltg: eltg
        });
        $(document).ready(function() {
          if (debug) console.log('ready');
          for (var ii in globalG)
            globalG[ii].eltg.resize();
        });
        window.onresize = function(event) {
          if (debug) console.log('onresize');
          for (var ii in globalG)
            globalG[ii].eltg.resize();
        };
      }
    }
  });

  if (debug) console.log('globalSetSelection', lastBuild)
  globalSetSelection(lastBuild);

  /*$('#' + tw.target + '_table').DataTable({
    paging: false,
    info: false,
    "bFilter": false,
    "columnDefs": [{
      "targets": 'no-sort',
      "orderable": false
    }]
  });*/
  /*
  if (option !== 'global') {
    var sync = Dygraph.synchronize(g, {
      selection: true,
      zoom: true
    });
  }*/
}

function pageAddHtml(html) {
  var e = document.getElementById('page-body');
  e.insertAdjacentHTML('beforeend', html);
}

function pageAddTable(twName) {
  var tw = tables[twName];
  //var h = document.getElementById('page-body').innerHTML;
  //h += "<span id='" + tw.target + "'></span>";
  //document.getElementById('page-body').innerHTML = h;

  var e = document.getElementById('page-body');
  e.insertAdjacentHTML('beforeend', "<span id='" + tw.target + "'></span>");

  tw.numDataToLoad = tw.series.length * tw.rows.length;
  if (tw.ref !== undefined)
    tw.numDataRefToLoad = tw.series.length * tw.rows.length;
  else
    tw.numDataRefToLoad = 0;

  tw.data = {};
  tw.serieId = {};
  tw.graphs = {};
  tw.s = {};
  if (tw.ref !== undefined)
    tw.dataRef = {};
  for (var ii = 0; ii < tw.rows.length; ii++) {
    tw.data[ii] = {};
    tw.serieId[ii] = {};
    tw.graphs[ii] = {};
    tw.s[ii] = {};
    if (tw.ref !== undefined)
      tw.dataRef[ii] = {};
    for (var jj = 0; jj < tw.series.length; jj++) {
      tw.data[ii][jj] = {}
      tw.serieId[ii][jj] = {}
      tw.graphs[ii][jj] = {}
      tw.s[ii][jj] = {}
      getDataSample(twName, repo.projectId, tw.rows[ii], tw.series[jj], ii, jj)
    }
  }
}

function pageSetProject(r, h) {
  if (debug) console.log('pageSetRepo', r)
  //if (socket === undefined) {
  setSocketContext();
  //}
  repo = r;
  repo.handler = h;
  getBuilds(repo.projectId);
}

function pageSetTitle(title) {
  document.getElementById('page-title').innerHTML = title;
}

var gmin;

function setSocketContext() {
  NProgress.start();

  socket = io();
  socket.on('receiveOneSerie', function(req) {
    if (debug)
      console.log('receiveOneSerie', req);
    NProgress.inc();
    var min;
    var max;
    var a = [];
    if (req.serie === undefined) {
      a = undefined;
      //for (var ii in repo.builds) a.push(null)
    } else {
      for (var ii in repo.builds) {
        ii = ii * 1;
        if (req.serie.samples[repo.builds[ii].buildId] === undefined) {
          a.push(null)
        } else {
          if (useMinMax) {
            if (min === undefined) min = ii;
            max = ii;
          }
          a.push(req.serie.samples[repo.builds[ii].buildId]);
        }
      }
      if (debug) console.log('MIN', min, 'MAX', max);

      if (useMinMax) {
        if (min === undefined) minMax.min = undefined;
        else {
          if (minMax.min === undefined) minMax.min = min;
          else if (min < minMax.min) minMax.min = min;
        }
        if (minMax.max === undefined) minMax.max = max;
        else if (max > minMax.max) minMax.max = max;
        if (debug) console.log('minMax.min=', minMax.min, 'minMax.max', minMax.max);
      }
    }
    var tw = tables[req.twName];
    if (debug) console.log(req.indexRow, req.indexSerie);
    tw.data[req.indexRow][req.indexSerie] = a;
    tw.s[req.indexRow][req.indexSerie] = req.serie;
    tw.numDataToLoad--;
    tw.serieId[req.indexRow][req.indexSerie] = req.serieId;
    if (tw.numDataToLoad === 0) {
      NProgress.done();
      buildTableWidget(tw);
    }
  });
  socket.on('receiveFileInfo', function(req) {
    if (debug)
      console.log('receiveFileInfo', req);
    NProgress.inc();
    if (req.fileId === 'builds') {
      builds = req.file;
      var k = Object.keys(builds);
      if (k.length === 0) {
        $('#rowNoDataToShow').show();
        return;
      }
      $('#btnRow').show();
      k.sort(function(a, b) {
        return a * 1 - b * 1
      });
      var a = [];
      for (var ii in k) {
        a.push(builds[k[ii]])
      }
      repo.builds = a;
      repo.handler();
      return;
    }
    var k = Object.keys(builds);
    if (k.length === 0) {
      NProgress.done();
      return;
    }
    compares = req.file;
    var kcomp = Object.keys(compares);
    var h = '';
    h += '<button id="btnStatusRaw" class="btn btn-default btn-xs" type="button" hidden>Nocolor</button>';
    h += '<button id="btnStatusRegression" class="btn btn-default btn-xs active" type="button">Analysis</button>';
    for (var ii in kcomp) {
      if (compares[kcomp[ii]].projectId !== repo.projectId) continue;
      h += '<button id="btnStatusCompare_' + kcomp[ii] + '" class="btn btn-default btn-xs" type="button">' + compares[kcomp[ii]].description + '</button>';
    }
    $('#btnStatusChoices').html(h)
    $('#btnStatusRaw').click(function() {
      $('#btnStatusRaw').addClass('active')
      $('#btnStatusRegression').removeClass('active')
      for (var ii in kcomp) {
        if (compares[kcomp[ii]].projectId !== repo.projectId) continue;
        $("#btnStatusCompare_" + kcomp[ii]).removeClass('active');
      }
      var k = Object.keys(tables);
      for (var zz in k) {
        var tw = tables[k[zz]];
        for (var ii = 0; ii < tw.series.length; ii++) {
          for (var jj = 0; jj < tw.rows.length; jj++) {
            var g = tw.graphs[jj][ii];
            var s = tw.series[jj][ii];
            if (debug) console.log(g)
            if (Object.keys(g).length !== 0) {
              g.updateOptions({
                colors: ["#1122FF"]
              }, false);
            }
          }
        }
      }
    });
    $('#btnStatusRegression').click(function() {
      $('#btnStatusRaw').removeClass('active')
      $('#btnStatusRegression').addClass('active')
      for (var ii in kcomp)
        $("#btnStatusCompare_" + kcomp[ii]).removeClass('active')
      var k = Object.keys(tables);
      for (var zz in k) {
        var tw = tables[k[zz]];
        for (var ii = 0; ii < tw.series.length; ii++) {
          for (var jj = 0; jj < tw.rows.length; jj++) {
            var g = tw.graphs[jj][ii];
            var colors;
            var s = tw.s[jj][ii];
            if (Object.keys(g).length !== 0) {
              colors = getColorRegression(tw.s[jj][ii]);
              g.updateOptions({
                colors: colors
              }, false);
            }
          }
        }
      }
    });
    for (var tt in kcomp) {
      setClickForComp(kcomp[tt]);

      function setClickForComp(comparedId) {

        var elt = "#btnStatusCompare_" + comparedId;
        $(elt).click(function() {
          $('#btnStatusRaw').removeClass('active')
          $('#btnStatusRegression').removeClass('active')
          for (var ii in kcomp)
            $("#btnStatusCompare_" + kcomp[ii]).removeClass('active')
          $("#btnStatusCompare_" + comparedId).addClass('active')
          var k = Object.keys(tables);
          for (var zz in k) {
            var tw = tables[k[zz]];
            for (var ii = 0; ii < tw.series.length; ii++) {
              for (var jj = 0; jj < tw.rows.length; jj++) {
                var g = tw.graphs[jj][ii];
                var colors;
                var s = tw.s[jj][ii];
                if (Object.keys(g).length !== 0) {
                  if (debug) console.log(comparedId, s);
                  if (s.compares) {
                    if (s.compares[comparedId]) {
                      var status = s.compares[comparedId].result.status;
                      if (status === 'similar') {
                        colors = ["rgb(20,20,250)"];
                      }
                      if (status === 'lower') {
                        colors = ["rgb(250,16,16)"];
                      }
                      if (status === 'better') {
                        colors = ["rgb(20,140,20)"];
                      }
                    } else
                      colors = ["rgb(22,22,22)"];
                    g.updateOptions({
                      colors: colors
                    }, false);
                  }
                }
              }
            }
          }
        });
      }
    }
  });
}

function getBuilds(projectId) {
  if (debug)
    console.log('getBuilds', projectId);
  socket.emit('getFileInfo', {
    projectId: projectId,
    fileId: 'builds'
  });
  socket.emit('getFileInfo', {
    projectId: 'admin',
    fileId: 'compares'
  });
}

function getDataSample(twName, projectId, row, serie, indexRow, indexSerie) {
  if (debug)
    console.log('getDataSample', twName, projectId, row, serie, indexRow, indexSerie);

  var serieId = row + '.' + serie;
  if (tables[twName].getId !== undefined)
    serieId = tables[twName].getId(row, serie);

  socket.emit('getOneSerie', {
    projectId: projectId,
    serieId: serieId,
    twName: twName,
    indexRow: indexRow,
    indexSerie: indexSerie
  });
}
