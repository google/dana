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

var body;

function bodyReset() {
  body = '';
}

function bodyH1(txt) {
  body += '<h1 style="font-size:16px;font-family:arial,sans,sans-serif;">' +
    txt + '</h1>';
}

function bodyH2(txt) {
  body += '<h2 style="font-size:15px;font-family:arial,sans,sans-serif;">' +
    txt + '</h2>';
}

function bodyH3(txt) {
  body += '<h3 style="font-size:14px;font-family:arial,sans,sans-serif;">' +
    txt + '</h3>';
}

function bodyH4(txt) {
  body += '<h4 style="font-size:13px;font-family:arial,sans,sans-serif;">' +
    txt + '</h4>';
}

function bodyPar(txt) {
  body += '<p style="font-size:13px;font-family:arial,sans,sans-serif;">' +
    txt + '</p>';
}

function bodyAdd(txt) {
  body += txt;
}
var bodyTableBodyAdded = false;

function bodyTableStart(width) {
  bodyTableBodyAdded = false;
  if (width) {
    body += '<table cellspacing="1" cellpadding="1" dir="ltr" border="1" ' +
      'style="table-layout:fixed;font-size:13px;font-family:arial,sans,' +
      'sans-serif;border-collapse:collapse;border:1px solid rgb(204,204,204)">';
  } else
    body += '<table cellspacing="10" cellpadding="10" dir="ltr" border="1" ' +
    'style="table-layout:fixed;font-size:13px;font-family:arial,sans,' +
    'sans-serif;border-collapse:collapse;border:1px solid rgb(204,204,204)">';
}

function bodyTableTh(tth) {
  body += '<tr>';
  for (var ii = 0; ii < tth.length; ii++)
    body += '<th align="left" valign="top">' + tth[ii] + '</th>';
  body += '</tr>';
}

function bodyTableTd(ttd) {
  if (!bodyTableBodyAdded) body += '<tbody>';
  body += '<tr>';
  for (var ii = 0; ii < ttd.length; ii++)
    body += '<td align="left" valign="top"> ' + ttd[ii] + ' </td>';
  body += '</tr>';
}

function bodyTableTdStyle(ttd, style) {
  if (!bodyTableBodyAdded) body += '<tbody>';
  body += '<tr>';
  for (var ii = 0; ii < ttd.length; ii++)
    body += '<td align="left" valign="top" style="' + style + '"> ' +
    ttd[ii] + ' </td>';
  body += '</tr>';
}

function bodyTableTdStyleProp(ttd) {
  if (!bodyTableBodyAdded) body += '<tbody>';
  body += '<tr>';
  for (var ii = 0; ii < ttd.length; ii++)
    if (ttd[ii].style === undefined)
      body += '<td align="left" valign="top"> ' + ttd[ii].txt + ' </td>';
    else
      body += '<td align="left" valign="top" style="' +
      ttd[ii].style + '"> ' + ttd[ii].txt + ' </td>';
  body += '</tr>';
}

function bodyTableEnd() {
  body += '</tbody></table>';
}

function bodyGet() {
  return body;
}

module.exports.bodyReset = bodyReset;
module.exports.bodyH1 = bodyH1;
module.exports.bodyH2 = bodyH2;
module.exports.bodyH3 = bodyH3;
module.exports.bodyH4 = bodyH4;
module.exports.bodyPar = bodyPar;
module.exports.bodyAdd = bodyAdd;
module.exports.bodyTableStart = bodyTableStart;
module.exports.bodyTableTh = bodyTableTh;
module.exports.bodyTableTd = bodyTableTd;
module.exports.bodyTableTdStyle = bodyTableTdStyle;
module.exports.bodyTableTdStyleProp = bodyTableTdStyleProp;
module.exports.bodyTableEnd = bodyTableEnd;
module.exports.bodyGet = bodyGet;
