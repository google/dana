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

var fs = require('fs');
var GoogleAuth = require('google-auth-library');
var google = require('googleapis');
var moduleBtoa = require('btoa');

var cwd = process.cwd();

function getOAuth2Client(cb) {
  // Load client secrets
  fs.readFile(cwd + '/configs/client_secret.json', function(err, data) {
    if (err) {
      return cb(err);
    }
    var credentials = JSON.parse(data);
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new GoogleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Load credentials
    fs.readFile(cwd + '/configs/gmail-credentials.json', function(err, token) {
      if (err) {
        return cb(err);
      }
      oauth2Client.credentials = JSON.parse(token);
      return cb(null, oauth2Client);
    });
  });
}

function doSendMail(auth, to, cc, subject, userbody, cb) {
  var gmailClass = google.gmail('v1');

  var email = '';
  email += 'To:' + to + '\r\n';
  if (cc !== undefined)
    email += 'Cc:' + cc + '\r\n';

  email += 'Subject:' + subject + '\r\n';
  email += 'Content-type:text/html;charset=utf-8\r\n';

  email = email + '\r\n' + userbody;

  var btoa = new Buffer(email).toString('base64');
  btoa = btoa.replace(/\+/g, '-').replace(/\//g, '_');

  gmailClass.users.messages.send({
    auth: auth,
    userId: 'me',
    resource: {
      raw: btoa
    }
  }, cb);
}

function sendMail(to, cc, subject, userbody) {
  if (to === undefined) {
    console.log('sendMail -- missing to');
    return;
  }
  if (subject === undefined) {
    console.log('sendMail -- missing subject');
    return;
  }
  if (userbody === undefined) {
    console.log('sendMail -- missing body');
    return;
  }
  getOAuth2Client(function(err, oauth2Client) {
    if (err) {
      console.log('err:', err);
    } else {
      doSendMail(oauth2Client, to, cc, subject, userbody,
        function(err, results) {
          if (err) {
            console.log('err:', err);
          } else {
            console.log(results);
          }
        });
    }
  });
}

module.exports.sendMail = sendMail;
