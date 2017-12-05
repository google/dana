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

function getBuildBadge(build) {
  var h = '';
  var i;

  h += '<div class="btn-group mybadge" role="group">';
  h += '<a target="_blank" class="btn btn-default" style="border-color: #545455; background-color: #545455; color:yellow" ';
  h += 'href="';
  if (build.state.running === true)
    h += '/sponge/' + build.spongeTag + '">';
  else
    h += '/bot/build?' + build.task + '?' + build.buildId + '?all">';
  if (build.state.running === true)
    h += '<i class="fa fa-refresh fa-spin fa-1x fa-fw"></i>&nbsp;'
  h += build.task;
  h += '</a>';

  if (build.state.numSuccess !== 0) {
    if (build.state.running === true)
      h += '<button disabled type="button" class="btn btn-success">' + build.state.numSuccess + '</button>';
    else {
      h += '<a target="_blank" class="btn btn-success" href="/bot/build?' + build.task + '?' + build.buildId + '?success">';
      h += build.state.numSuccess;
      h += '</a>';
    }
  }

  if (build.state.numFailing !== 0) {
    if (build.state.running === true)
      h += '<button disabled type="button" class="btn btn-danger">' + build.state.numFailing + '</button>';
    else {
      h += '<a target="_blank" class="btn btn-danger" href="/bot/build?' + build.task + '?' + build.buildId + '?failed">';
      h += build.state.numFailing;
      h += '</a>';
    }
  }

  h += '</div>&nbsp;';
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
  h += '</div>';
  h += '</div>';
  return h;
}

function clearBuild() {
  var builds = document.getElementById("builds");
  builds.innerHTML = "";
  currentBuildsInView = {};

  // if (runningBuild !== undefined)
  // 	if (currentTasks[runningBuild.task] !== undefined)
  // 		updateBuild(build);
};

function updateBuild(repositories, build) {
  console.log(repositories, build);

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
    var index = 124;
    for (var ii = 0; ii < keysCurrentBuildsInView.length; ii++) {
      if (keysCurrentBuildsInView[ii] * 1 === build.buildId) {
        index = ii;
        break;
      }
    }
    var eltBuildPanelBefore = undefined;
    if (index != 0) eltBuildPanelBefore = document.getElementById('build_' + keysCurrentBuildsInView[index - 1]);

    eltBuildPanel = document.createElement('span');
    eltBuildPanel.id = 'build_' + build.buildId;
    var builds = document.getElementById("builds");

    if (eltBuildPanelBefore == undefined)
      builds.insertBefore(eltBuildPanel, builds.firstChild);
    else
      insertAfter(eltBuildPanel, eltBuildPanelBefore);
    eltBuildPanel.innerHTML = getBuildPanel(repositories[build.repository].git.url, build);

    var numBuilds = builds.childNodes.length;
    if (numBuilds > 20) builds.removeChild(builds.lastChild);
  }

  var eltBuildPanelBadge = document.getElementById('buildBadges_' + build.buildId);
  var eltBuildBadge = document.getElementById('build_' + build.buildId + '_' + build.task);
  if (!eltBuildBadge) {
    eltBuildBadge = document.createElement('span');
    eltBuildBadge.id = 'build_' + build.buildId + '_' + build.task;
    eltBuildPanelBadge.insertBefore(eltBuildBadge, eltBuildPanelBadge.firstChild);
  }
  eltBuildBadge.innerHTML = getBuildBadge(build);
}
