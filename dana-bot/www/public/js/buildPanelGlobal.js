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

var currentBuildsInView = {};
var localSystems;

function getBuildBadge(system, build) {
  console.log('BUILD', build);
  var h = '';
  var i;
  var url = 'http://' + systems[system].ip + ':' + (systems[system].port);
  h += '<div target="_blank" class="btn-group mybadge" role="group" style="margin: 0px 0px 10px 0px;">';
  h += '<a target="_blank" class="btn btn-default" style="border-color: #545455; background-color: #545455; color:yellow" ';
  h += 'href="' + url;
  if (build.state.running === true)
    h += '/sponge/' + build.spongeTag + '">';
  else
    //h += '/bot/build?' + build.spongeTag + '?all">';
    h += '/bot/build?' + build.task + '?' + build.buildId + '?all">';
  if (build.state.running === true)
    h += '<i class="fa fa-refresh fa-spin fa-1x fa-fw"></i>&nbsp;'
  h += build.task;
  h += '</a>';

  if (build.state.numSuccess !== 0) {
    if (build.state.running === true)
      h += '<button disabled type="button" class="btn btn-success">' + build.state.numSuccess + '</button>';
    else {
      h += '<a target="_blank" class="btn btn-success" href="' + url + '/bot/build?' + build.task + '?' + build.buildId + '?success">';
      h += build.state.numSuccess;
      h += '</a>';
    }
  }

  if (build.state.numFailing !== 0) {
    if (build.state.running === true)
      h += '<button disabled type="button" class="btn btn-danger">' + build.state.numFailing + '</button>';
    else {
      h += '<a target="_blank" class="btn btn-danger" href="' + url + '/bot/build?' + build.task + '?' + build.buildId + '?failed">';
      h += build.state.numFailing;
      h += '</a>';
    }
  }

  h += '</div>&nbsp;<br>';
  return h;
}

function getBuildPanel(url, build) {
  var h = '';
  h += '<div id="buildPanel_' + build.buildId + '_color" class="panel panel-default">';
  h += '<div class="panel-heading">';
  h += '<h3 class="panel-title">';
  h += '<a href="' + url + '/+/' + build.infos.hash + '">';
  h += '<b>Build ' + build.buildId + '</b>&nbsp;-&nbsp;';
  h += build.infos.abbrevHash;
  h += '&nbsp;-&nbsp;';
  h += build.infos.authorName + '&nbsp;-&nbsp;';
  h += build.infos.subject;
  h += '</a>';
  h += '<span id="buildPanel_' + build.buildId + '_icon" class="pull-right">';
  h += '<span>';
  h += '</h3>';
  h += '</div>';
  h += '<div class="panel-body" id="buildBadges_' + build.buildId + '"">';

  var k = Object.keys(localSystems);
  var width = 100 / k.length;
  if (k.length > 1) {
    h += '<table class="table"><thead>';
    for (var ii = 0; ii < k.length; ii++) {
      h += '<th width="' + width + '%">' + k[ii] + '</th>';
    }
    h += '</thead><tbody>';
    for (var ii = 0; ii < k.length; ii++) {
      h += '<td>';
      h += '<span id="buildBadgesSystem_' + k[ii] + '_' + build.buildId + '">';
      h += '</span>'
      h += '</td>'
    }
    h += '</tbody></table>'
  }

  h += '</div>';
  h += '</div>';
  return h;
}

function setSystems(systems) {
  localSystems = systems;
}

function clearBuild() {
  var builds = document.getElementById("builds");
  builds.innerHTML = "";
  currentBuildsInView = {};

  // if (runningBuild !== undefined)
  // 	if (currentTasks[runningBuild.task] !== undefined)
  // 		updateBuild(build);
};

function updateSystemBuild(repositories, system, build) {
  function insertAfter(el, referenceNode) {
    referenceNode.parentNode.insertBefore(el, referenceNode.nextSibling);
  }
  var eltBuildPanel = document.getElementById('build_' + build.buildId);
  if (!eltBuildPanel) {

    currentBuildsInView[build.buildId] = {};
    var keysCurrentBuildsInView = Object.keys(currentBuildsInView);

    function compare(x, y) {
      return y * 1 - x * 1;
    }
    keysCurrentBuildsInView.sort(compare);
    var index;
    for (var ii = 0; ii < keysCurrentBuildsInView.length; ii++) {
      if (keysCurrentBuildsInView[ii] * 1 === build.buildId) {
        index = ii;
        break;
      }
    }

    var eltBuildPanelBefore = undefined;
    if (index !== 0)
      eltBuildPanelBefore = document.getElementById('build_' + keysCurrentBuildsInView[index - 1]);

    eltBuildPanel = document.createElement('span');
    eltBuildPanel.id = 'build_' + build.buildId;
    var builds = document.getElementById("builds");
    if (index === 0)
      builds.insertBefore(eltBuildPanel, builds.firstChild);
    else
      insertAfter(eltBuildPanel, eltBuildPanelBefore);

    eltBuildPanel.innerHTML = getBuildPanel(repositories[system][build.repository].git.url, build);
    // TODO:50 do a better management here
    var numBuilds = builds.childNodes.length;
    if (numBuilds > 20) builds.removeChild(builds.lastChild);
  }
  var eltBuildPanelBadge;
  var k = Object.keys(localSystems);
  if (k.length > 1) {
    eltBuildPanelBadge =
      document.getElementById('buildBadgesSystem_' + system + '_' + build.buildId);
  } else
    eltBuildPanelBadge = document.getElementById('buildBadges_' + build.buildId);
  var eltBuildBadge = document.getElementById('build_' + system + '_' + build.buildId + '_' + build.task);
  if (!eltBuildBadge) {
    eltBuildBadge = document.createElement('span');
    eltBuildBadge.id = 'build_' + system + '_' + build.buildId + '_' + build.task;
    eltBuildPanelBadge.insertBefore(eltBuildBadge, eltBuildPanelBadge.firstChild);
  }
  eltBuildBadge.innerHTML = getBuildBadge(system, build);
}

function dumpBuilds(system, buildList) {
  var keysSorted = Object.keys(buildList).sort(function(a, b) {
    var v = buildList[a].buildId * 1 - buildList[b].buildId * 1;
    if (v === 0) {
      v = buildList[b].task.localeCompare(buildList[a].task);
    }
    return v;
  });
  for (var ii = 0; ii < keysSorted.length; ii++) {
    updateSystemBuild(system, buildList[keysSorted[ii]]);
  }
}
