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

var cwd = process.cwd();
var fs = require('fs');
var util = require('util');
var sendMail = require(cwd + '/src/sendMail');
var gitForBot = require('./gitForBot');

var WWW_KILL = 1;
var WWW_KILL_AND_UPDATE = 2;

var globalWWW = {
  config: undefined,
  users: undefined
}

// Configure the local strategy for use by Passport.
var passport = require('passport');
var Strategy = require('passport-local').Strategy;

function findById(id, cb) {
  var records = globalWWW.config.globalBot.config.configBot.users;
  process.nextTick(function() {
    var idx = id - 1;
    if (records[idx]) {
      cb(null, records[idx]);
    } else {
      cb(new Error('User ' + id + ' does not exist'));
    }
  });
}

function findByUsername(username, cb) {
  var records = globalWWW.config.globalBot.config.configBot.users;
  process.nextTick(function() {
    for (var i = 0, len = records.length; i < len; i++) {
      var record = records[i];
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
        return cb(null, false);
      }
      if (user.password !== password) {
        return cb(null, false);
      }
      return cb(null, user);
    });
  }));

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  findById(id, function(err, user) {
    if (err) {
      return cb(err);
    }
    cb(null, user);
  });
});

// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 8080;
var adminSocket;

app.locals.fs = fs;
app.locals.cwd = cwd;

// Set socket.io listeners.
io.on('connection', function(socket) {
  console.log('User is connected');
  socket.emit('updateRepositories', globalWWW.config.globalBot.repositories);
  socket.emit('updateTasks', globalWWW.config.globalBot.tasks);
  socket.emit("updateQueue", globalWWW.config.globalBot.Q);

  if (globalWWW.config.globalBot.running !== undefined) {
    if (globalWWW.config.globalBot.currentRun === undefined) {
      startingBuild();
    } else {
      updatingBuild();
    }
  }
  socket.on('disconnect', function(err) {
    console.log('User is disconnected');
  });

  socket.on('getTaskBuilds', function(taskName) {
    console.log('getTaskBuilds', taskName);
    var f = globalWWW.config.globalBot.buildPath + '/' + taskName + '.json';
    if (fs.existsSync(f)) {
      var d = fs.readFileSync(f);
      var e = JSON.parse(d);
      socket.emit('taskBuilds', {
        taskName: taskName,
        builds: e
      })
    } else {
      socket.emit('taskBuilds', {
        taskName: taskName,
        builds: {}
      })
    }
  });
});

app.use(express.static(cwd + '/www/public'));
app.set('views', cwd + '/www/views');
app.set('view engine', 'ejs');

app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({
  extended: true
}));
app.use(require('express-session')({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// LOGIN / LOGOUT
app.get('/',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    res.redirect('/bot/status');
  });

app.get('/login',
  function(req, res) {
    res.render('login/login', {
      globalBot: globalWWW.config.globalBot,
      title: 'Login',
      user: req.user
    });
  });

app.post('/login',
  passport.authenticate('local', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    res.redirect('/bot/status');
  });

app.get('/logout',
  function(req, res) {
    req.logout();
    res.redirect('/');
  });


app.get('/bot/status',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    res.render('bot/status', {
      user: req.user,
      globalBot: globalWWW.config.globalBot
    });
  });

app.get('/bot/builds',
  function(req, res) {
    res.render('bot/builds', {
      user: req.user,
      globalBot: globalWWW.config.globalBot
    });
  });

app.get('/bot/build',
  function(req, res) {
    var l = "/bot/build?".length;
    var r = req.originalUrl.substring(l);
    r = r.split('?');
    console.log('/bot/build', r);

    var f = globalWWW.config.globalBot.buildPath + '/' + r[0] + '.json';
    if (!fs.existsSync(f)) {
      appError(req, res, '/bot/build, build file doesnt exist');
      return;
    }
    var d = fs.readFileSync(f);
    var e = JSON.parse(d);
    var build = e[r[1]];
    if (build === undefined) {
      appError(req, res, '/bot/build, build undefined');
      return;
    }

    var f = globalWWW.config.globalBot.buildPath + '/' +
      r[0] + '/' + r[1] + '.json';
    var tests = [];
    if (fs.existsSync(f)) {
      var d = fs.readFileSync(f);
      var alltests = JSON.parse(d);
      if (r[2] === 'all')
        tests = alltests;
      if (r[2] === 'failed')
        for (var ii = 0; ii < alltests.length; ii++) {
          if (!alltests[ii].state.passing)
            tests.push(alltests[ii]);
        }
      if (r[2] === 'success')
        for (var ii = 0; ii < alltests.length; ii++) {
          if (alltests[ii].state.passing)
            tests.push(alltests[ii]);
        }
    }

    res.render('bot/build', {
      mode: r[2],
      build: build,
      tests: tests,
      user: req.user,
      globalBot: globalWWW.config.globalBot
    });
  });

app.get('/bot/buildcsv',
  function(req, res) {
    var l = "/bot/buildcsv?".length;
    var r = req.originalUrl.substring(l);
    r = r.split('?');

    console.log('/bot/build', r);

    var f = globalWWW.config.globalBot.buildPath + '/' + r[0] + '.json';
    if (!fs.existsSync(f)) {
      appError(req, res, '/bot/build, build file doesnt exist');
      return;
    }
    var d = fs.readFileSync(f);
    var e = JSON.parse(d);
    var build = e[r[1]];
    if (build === undefined) {
      appError(req, res, '/bot/build, build undefined');
      return;
    }

    var f = globalWWW.config.globalBot.buildPath + '/' +
      r[0] + '/' + r[1] + '.json';
    var tests = [];
    if (fs.existsSync(f)) {
      var d = fs.readFileSync(f);
      var alltests = JSON.parse(d);
      if (r[2] === 'all')
        tests = alltests;
      if (r[2] === 'failed')
        for (var ii = 0; ii < alltests.length; ii++) {
          if (!alltests[ii].state.passing)
            tests.push(alltests[ii]);
        }
      if (r[2] === 'success')
        for (var ii = 0; ii < alltests.length; ii++) {
          if (alltests[ii].state.passing)
            tests.push(alltests[ii]);
        }
    }

    res.render('bot/buildcsv', {
      mode: r[2],
      build: build,
      tests: tests,
      user: req.user,
      globalBot: globalWWW.config.globalBot
    });
  });

app.get('/bot/kill',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/kill, You must be an administrator');
      return;
    }
    process.exit(WWW_KILL);
  });

app.get('/bot/killAndUpdate',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/killAndUpdate, You must be an administrator');
      return;
    }
    process.exit(WWW_KILL_AND_UPDATE);
  });

app.get('/bot/botStart',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/botStart, You must be an administrator');
      return;
    }
    globalWWW.config.botStart();
    res.redirect('/bot/status');
  });

app.get('/bot/botStop',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/botStop, You must be an administrator');
      return;
    }
    globalWWW.config.botStop();
    res.redirect('/bot/status');
  });

app.get('/bot/addRepository',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/addRepository, You must be an administrator');
      return;
    }
    res.render('bot/addRepository', {
      user: req.user,
      globalBot: globalWWW.config.globalBot,
    });
  });

app.get('/bot/editRepository',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    var l = "/bot/editRepository?".length;
    var r = req.originalUrl.substring(l);
    r = r.split('?');
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/editRepository, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.repositories === undefined) {
      appError(req, res, '/bot/editRepository, repositories undefined');
      return;
    }
    if (globalWWW.config.globalBot.repositories[r[0]] === undefined) {
      appError(req, res, '/bot/editRepository, repositories of ' + r[0] + ' undefined');
      return;
    }
    res.render('bot/editRepository', {
      user: req.user,
      repository: globalWWW.config.globalBot.repositories[r[0]],
      globalBot: globalWWW.config.globalBot,
    });
  });


function fetchRepo(req, res, repoName, serviceName) {
    gitForBot.setRepoPath(globalWWW.config.globalBot.repoPath);
    gitForBot.setRepo(globalWWW.config.globalBot.repositories[repoName]);

    if (!fs.existsSync(globalWWW.config.globalBot.repoPath + '/' + repoName)) {
        console.log('/bot/' + serviceName + ' -- Cloning repo ' + repoName + ' in ' + globalWWW.config.globalBot.repoPath);
        var cloneOut = gitForBot.clone();
        if (cloneOut.err) {
          console.log('/bot/' + serviceName + ' -- error while cloning ' + repoName + ': ' + JSON.stringify(cloneOut, null, 2));
          appError(req, res, '/bot/' + serviceName + ', repository of ' + repoName + ' could not be cloned');
          return;
        }
      } else {
        console.log('/bot/' + serviceName + ' -- Fetching repo ' + repoName + ' in ' + globalWWW.config.globalBot.repoPath);
        var fetchOut = gitForBot.fetch();
        if (fetchOut.err) {
          console.log('/bot/' + serviceName + ' -- error while fetching ' + repoName + ': ' + JSON.stringify(fetchOut, null, 2));
          appError(req, res, '/bot/' + serviceName + ', repository of ' + repoName + ' could not be fetched');
          return;
        }
      }
}

app.post('/bot/addRepository',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/addRepository, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.repositories === undefined) {
      appError(req, res, '/bot/addRepository, repositories undefined');
      return;
    }
    if (globalWWW.config.globalBot.repositories[req.body.repoName] !== undefined) {
      appError(req, res, '/bot/addRepository, repository of ' + req.body.repoName + ' already exist');
      return;
    }

    globalWWW.config.globalBot.repositories[req.body.repoName] = repository;
    fs.writeFileSync(cwd + '/configs/repositories.js', JSON.stringify(globalWWW.config.globalBot.repositories));
    updateRepositories();
    res.redirect('/bot/status');
  });

app.post('/bot/saveRepository',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    console.log(req.body);
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/saveRepository, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.repositories === undefined) {
      appError(req, res, '/bot/saveRepository, repositories undefined');
      return;
    }
    if (globalWWW.config.globalBot.repositories[req.body.repoName] === undefined) {
      appError(req, res, '/bot/saveRepository, repository for ' + req.body.repoName + ' undefined');
      return;
    }
    if (req.body.giturl === '') {
      appError(req, res, '/bot/saveRepository, gitrul undefined');
      return;
    }

    globalWWW.config.globalBot.repositories[req.body.repoName].git.url = req.body.giturl;
    fs.writeFileSync(cwd + '/configs/repositories.js', JSON.stringify(globalWWW.config.globalBot.repositories));
    updateRepositories();
    res.redirect('/bot/status');
  });

app.get('/bot/deleteRepository',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    var l = "/bot/deleteRepository?".length;
    var r = req.originalUrl.substring(l);
    r = r.split('?');
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/deleteRepository, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.repositories === undefined) {
      appError(req, res, '/bot/deleteRepository, repositories undefined');
      return;
    }
    if (globalWWW.config.globalBot.repositories[r[0]] === undefined) {
      appError(req, res, '/bot/deleteRepository, repositories of ' + r[0] + ' undefined');
      return;
    }
    delete globalWWW.config.globalBot.repositories[r[0]];
    fs.writeFileSync(cwd + '/configs/repositories.js', JSON.stringify(globalWWW.config.globalBot.repositories));
    updateRepositories();
    res.redirect('/bot/status');
  });

app.get('/bot/addTask',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/addTask, You must be an administrator');
      return;
    }
    res.render('bot/addTask', {
      user: req.user,
      globalBot: globalWWW.config.globalBot
    });
  });

app.get('/bot/addCommandToQueue',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/addCommandToQueue, You must be an administrator');
      return;
    }
    res.render('bot/addCommandToQueue', {
      user: req.user,
      globalBot: globalWWW.config.globalBot
    });
  });

app.post('/bot/addTask',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/addTask, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.tasks === undefined) {
      appError(req, res, '/bot/addTask, tasks undefined');
      return;
    }
    if (globalWWW.config.globalBot.tasks[req.body.taskName] !== undefined) {
      appError(req, res, '/bot/addTask, task of ' + req.body.taskName + ' already exist');
      return;
    }

    fetchRepo(req, res, req.body.repository, 'addTask')

    if (!gitForBot.checkRemoteBranchExists(req.body.branch, req.body.repository)) {
      appError(req, res, '/bot/addTask, branch \'' + req.body.branch + '\' does not exist');
      return;
    }

    if (!gitForBot.checkCommitExists(req.body.branch, req.body.base, req.body.repository)) {
      appError(req, res, '/bot/addTask, commit \'' + req.body.base + '\' does not exist in branch \'' + req.body.branch + '\'');
      return;
    }

    var active;
    if (req.body.active === 'Yes') active = true;
    if (req.body.active === 'No') active = false;

    var mode;
    if (req.body.monitoringMode === 'Patch level') mode = 'patch';
    if (req.body.monitoringMode === 'Patch set level') mode = 'patchSet';

    var period;
    if (req.body.periodMode === 'Tick')
      period = {
        tick: Number(req.body.periodValue)
      };
    if (req.body.periodMode === 'FixedTime')
      period = {
        fixedTime: req.body.fixedTimeValue
      };

    globalWWW.config.globalBot.tasks[req.body.taskName] = {
      name: req.body.taskName,
      repository: req.body.repository,
      branch: req.body.branch,
      command: req.body.command,
      active: active,
      priority: Number(req.body.priority),
      mode: mode,
      period: period,
      base: req.body.base,
      notify: req.body.notify
    }
    fs.writeFileSync(cwd + '/configs/tasks.js', JSON.stringify(globalWWW.config.globalBot.tasks));
    updateTasks();
    res.redirect('/bot/status');
  });

app.post('/bot/saveTask',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/saveTask, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.tasks === undefined) {
      appError(req, res, '/bot/saveTask, tasks undefined');
      return;
    }
    if (globalWWW.config.globalBot.tasks[req.body.taskName] === undefined) {
      appError(req, res, '/bot/saveTask, task of ' + req.body.taskName + ' undefined');
      return;
    }

    fetchRepo(req, res, req.body.repository, 'saveTask')

    if (!gitForBot.checkRemoteBranchExists(req.body.branch, req.body.repository)) {
      appError(req, res, '/bot/saveTask, branch \'' + req.body.branch + '\' does not exist');
      return;
    }

    if (!gitForBot.checkCommitExists(req.body.branch, req.body.base, req.body.repository)) {
      appError(req, res, '/bot/saveTask, commit \'' + req.body.base + '\' does not exist in branch \'' + req.body.branch + '\'');
      return;
    }

    var active;
    if (req.body.active === 'Yes') active = true;
    if (req.body.active === 'No') active = false;

    var mode;
    if (req.body.monitoringMode === 'Patch level') mode = 'patch';
    if (req.body.monitoringMode === 'Patch set level') mode = 'patchSet';

    var period;
    if (req.body.periodMode === 'Tick')
      period = {
        tick: Number(req.body.periodValue)
      };
    if (req.body.periodMode === 'FixedTime')
      period = {
        fixedTime: req.body.fixedTimeValue
      };

    globalWWW.config.globalBot.tasks[req.body.taskName] = {
      name: req.body.taskName,
      repository: req.body.repository,
      branch: req.body.branch,
      command: req.body.command,
      active: active,
      priority: Number(req.body.priority),
      mode: mode,
      period: period,
      base: req.body.base,
      notify: req.body.notify
    }
    fs.writeFileSync(cwd + '/configs/tasks.js', JSON.stringify(globalWWW.config.globalBot.tasks));
    updateTasks();
    res.redirect('/bot/status');
  });

app.get('/bot/editTask',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    var l = "/bot/editTask?".length;
    var r = req.originalUrl.substring(l);
    r = r.split('?');
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/editTask, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.tasks === undefined) {
      appError(req, res, '/bot/editTask, tasks undefined');
      return;
    }
    if (globalWWW.config.globalBot.tasks[r[0]] === undefined) {
      appError(req, res, '/bot/editTask, task of ' + r[0] + ' undefined');
      return;
    }
    res.render('bot/editTask', {
      user: req.user,
      task: globalWWW.config.globalBot.tasks[r[0]],
      repositories: globalWWW.config.globalBot.repositories,
      globalBot: globalWWW.config.globalBot,
    });
  });

app.get('/bot/deleteTask',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    var l = "/bot/deleteTask?".length;
    var r = req.originalUrl.substring(l);
    r = r.split('?');
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/deleteTask, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.tasks === undefined) {
      appError(req, res, '/bot/deleteTask, tasks undefined');
      return;
    }
    if (globalWWW.config.globalBot.tasks[r[0]] === undefined) {
      appError(req, res, '/bot/deleteTask, task of ' + r[0] + ' undefined');
      return;
    }
    delete globalWWW.config.globalBot.tasks[r[0]];
    fs.writeFileSync(cwd + '/configs/tasks.js', JSON.stringify(globalWWW.config.globalBot.tasks));
    //updateTasks();
    res.redirect('/bot/status');
  });

app.get('/bot/addToQueue',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/addToQueue, You must be an administrator');
      return;
    }
    res.render('bot/addToQueue', {
      user: req.user,
      globalBot: globalWWW.config.globalBot
    });
  });

app.post('/bot/addToQueue',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/addToQueue, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.Q === undefined) {
      appError(req, res, '/bot/addToQueue, Q undefined');
      return;
    }
    globalWWW.config.botQAdd(req.body.taskName, req.body.hashId);
    res.redirect('/bot/status');
  });

app.get('/bot/removeFromQ',
  // require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    var l = "/bot/removeFromQ?".length;
    var r = req.originalUrl.substring(l);
    r = r.split('?');

    if (req.user.username !== 'admin') {
      appError(req, res, '/bot/removeFromQ, You must be an administrator');
      return;
    }
    if (globalWWW.config.globalBot.Q === undefined) {
      appError(req, res, '/bot/removeFromQ, Q undefined');
      return;
    }

    globalWWW.config.botQDelete(r[0]);
    res.redirect('/bot/status');
  });


app.get('/sponge/*', function(req, res) {
  console.log('/sponge/*');
  // all files in public are ok to download to everybody
  // if files exist, it's already managed by express
  // so only manage directories
  var fullPathDirectory = cwd + '/www/public' + req.originalUrl;
  console.log('fullPathDirectory=', fullPathDirectory);
  if (!fs.existsSync(fullPathDirectory)) {
    res.redirect('/');
    return;
  }

  if (req.originalUrl.indexOf('sponge') === -1) {
    res.redirect('/');
    return;
  }

  var list = [];
  var files = fs.readdirSync(fullPathDirectory);
  for (var i in files) {
    if (fs.existsSync(fullPathDirectory + '/' + files[i])) {
      var name = fullPathDirectory + '/' + files[i];
      if (fs.existsSync(name)) {
        if (fs.statSync(name).isDirectory()) {
          list.push({
            isDirectory: true,
            name: files[i]
          });
        } else {
          list.push({
            isDirectory: false,
            name: files[i]
          });
        }
      }
    }
  }
  console.log(list);
  res.render('file/directory', {
    user: req.user,
    cwd: cwd,
    directory: req.originalUrl,
    list: list,
    globalBot: globalWWW.config.globalBot
  });
});

// error handlers
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
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
    globalBot: globalWWW.config.globalBot
  });
});

function appError(req, res, message) {
  res.render('common/error', {
    user: req.user,
    message: message,
    error: undefined,
    globalBot: globalWWW.config.globalBot
  });
}

var globalSocket;
var wsActions = {};

function register(action, handler) {
  wsActions[action] = handler;
}

register('getTaskBuilds', function(taskName) {
  var b;
  var f = globalWWW.config.globalBot.buildPath + '/' + taskName + '.json';
  if (fs.existsSync(f)) {
    var d = fs.readFileSync(f);
    b = JSON.parse(d);
  } else
    b = {};

  // load build
  wsSend('sendBuilds', {
    taskName: taskName,
    builds: b
  });
});

function wsSend(action, params) {
  if (globalSocket !== undefined)
    globalSocket.send(JSON.stringify({
      action: action,
      params: params
    }));
}

function setConfig(config) {

  if (config === undefined)
    return 'nodeCiBot config undefined';

  if (config.globalBot === undefined)
    return 'nodeCiBot globalBot missing';

  if (config.botStart === undefined)
    return 'nodeCiBot botStart missing';

  if (config.botStop === undefined)
    return 'nodeCiBot botStop missing';

  if (config.botQAdd === undefined)
    return 'nodeCiBot botQAdd missing';

  if (config.botQDelete === undefined)
    return 'nodeCiBot botQDelete missing';

  globalWWW.config = config;

  server.listen(config.globalBot.config.configBot.port, function() {
    console.log('WWW Server listening at port %d',
      config.globalBot.config.configBot.port);
  });

  var WebSocketServer = require('ws').Server;
  var wss = new WebSocketServer({
    port: config.globalBot.config.configBot.port + 1
  });
  console.log('Global server listening at port %d', config.globalBot.config.configBot.port + 1);

  wss.on('connection', function connection(ws) {
    globalSocket = ws;
    console.log('Global connection received');
    wsSend('updateRepositories', globalWWW.config.globalBot.repositories);
    wsSend('updateTasks', globalWWW.config.globalBot.tasks);
    wsSend("updateQueue", globalWWW.config.globalBot.Q);
    wsSend("updateState", globalWWW.config.globalBot.state);

    if (globalWWW.config.globalBot.running !== undefined) {
      if (globalWWW.config.globalBot.currentRun === undefined) {
        startingBuild();
      } else {
        updatingBuild();
      }
    }
    ws.on('message', function(msg, flags) {
      var data = JSON.parse(msg);
      if (wsActions[data.action] === undefined) {
        console.log('received ', data, ' unknown action');
        return;
      }
      wsActions[data.action](data.params);
    });
    ws.on('error', function error(err) {
      // if there is an error, will be followed by a close event
      console.log('Global communication ERROR', err);
    });
    ws.on('close', function close() {
      // TODO send an email to administrator if a glocal comm is lost
      globalSocket = undefined;
      var t = '[ACTION REQUIRED] Global disconnected from System ' + config.globalBot.config.configBot.system + '!';
      sendMail.sendMail(config.globalBot.config.configBot.admin.email, '', t, t);
    });
  });

  return undefined;
}

function startingBuild() {
  var g = globalWWW.config.globalBot;
  if (g.running === undefined) {
    console.log('startingBuild ERROR running undefined');
    return;
  }
  var b;
  b = {
    system: g.system,
    task: g.running.task,
    buildId: g.running.buildId,
    repository: g.tasks[g.running.task].repository,
    branch: g.tasks[g.running.task].branch,
    spongeTag: g.QTimeTag,
    infos: {
      hash: g.running.infos[0].hash,
      abbrevHash: g.running.infos[0].abbrevHash,
      authorName: g.running.infos[0].authorName,
      authorEmail: g.running.infos[0].authorEmail,
      subject: g.running.infos[0].subject
    },
    state: {
      running: true,
      numTests: 0,
      numFailing: 0,
      numSuccess: 0
    }
  };

  io.sockets.emit("updatingBuild", b);
  wsSend("updateRunningBuild", b);
}

function stoppingBuild() {
  var g = globalWWW.config.globalBot;
  var b = {
    system: g.system,
    task: g.running.task,
    buildId: g.running.buildId,
    repository: g.tasks[g.running.task].repository,
    branch: g.tasks[g.running.task].branch,
    spongeTag: g.QTimeTag,
    infos: {
      hash: g.running.infos[0].hash,
      abbrevHash: g.running.infos[0].abbrevHash,
      authorName: g.running.infos[0].authorName,
      authorEmail: g.running.infos[0].authorEmail,
      subject: g.running.infos[0].subject
    },
    state: {
      running: false,
      numTests: g.currentRun.numSeries,
      numFailing: g.currentRun.numFailing,
      numSuccess: g.currentRun.numSeries - g.currentRun.numFailing
    }
  };
  io.sockets.emit("updatingBuild", b);
  wsSend("updateRunningBuild", b);
}

function updatingBuild() {
  var g = globalWWW.config.globalBot;
  var b = {
    system: g.system,
    task: g.running.task,
    buildId: g.running.buildId,
    repository: g.tasks[g.running.task].repository,
    branch: g.tasks[g.running.task].branch,
    spongeTag: g.QTimeTag,
    infos: {
      hash: g.running.infos[0].hash,
      abbrevHash: g.running.infos[0].abbrevHash,
      authorName: g.running.infos[0].authorName,
      authorEmail: g.running.infos[0].authorEmail,
      subject: g.running.infos[0].subject
    },
    state: {
      running: true,
      numTests: g.currentRun.numSeries,
      numFailing: g.currentRun.numFailing,
      numSuccess: g.currentRun.numSeries - g.currentRun.numFailing
    }
  };

  io.sockets.emit("updatingBuild", b);
  wsSend("updateRunningBuild", b);
}

function updateQueue() {
  io.sockets.emit("updateQueue", globalWWW.config.globalBot.Q);
  wsSend("updateQueue", globalWWW.config.globalBot.Q);
}

function updateRepositories() {
  io.sockets.emit("updateRepositories",
    globalWWW.config.globalBot.repositories
  );
  wsSend("updateRepositories", globalWWW.config.globalBot.repositories);
}

function updateTasks() {
  io.sockets.emit("updateTasks",
    globalWWW.config.globalBot.tasks
  );
  wsSend("updateTasks", globalWWW.config.globalBot.tasks);
}


function updateState() {
  wsSend("updateState", globalWWW.config.globalBot.state);
  if (globalWWW.config.globalBot.state === 'inactive')
    io.sockets.emit("botIsStopped", {});
}
module.exports.setConfig = setConfig;
module.exports.updateState = updateState;
module.exports.startingBuild = startingBuild;
module.exports.updatingBuild = updatingBuild;
module.exports.stoppingBuild = stoppingBuild;
module.exports.updateQueue = updateQueue;
module.exports.updateTasks = updateTasks;
