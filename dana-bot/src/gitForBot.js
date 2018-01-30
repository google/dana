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
var run = require(cwd + '/src/run');
var logger = require(cwd + '/src/logger').getLogger();

var repoPath;
var currentRepo;
var currentRepoPath;

var gitPrettyConfig = [{
  c: '%H',
  p: 'hash'
}, {
  c: '%h',
  p: 'abbrevHash'
}, {
  c: '%t',
  p: 'abbrevTreeHash'
}, {
  c: '%P',
  p: 'parentHashes'
}, {
  c: '%an',
  p: 'authorName'
}, {
  c: '%ae',
  p: 'authorEmail'
}, {
  c: '%ai',
  p: 'authorDate'
}, {
  c: '%ar',
  p: 'authorDateRel'
}, {
  c: '%cn',
  p: 'committerName'
}, {
  c: '%ce',
  p: 'committerEmail'
}, {
  c: '%cd',
  p: 'committerDate'
}, {
  c: '%cr',
  p: 'committerDateRel'
}, {
  c: '%s',
  p: 'subject'
}];

function splitSpaces(data) {
  return data.split(" ").filter(function(s) {
    return s.length > 0;
  });
}

module.exports = {
  setRepoPath: function(path) {
    repoPath = path;
  },
  setRepo: function(repo) {
    currentRepo = repo;
    currentRepoPath = repoPath + '/' + currentRepo.name;
  },
  clone: function() {
    if (currentRepoPath === undefined) {
      logger.error('clone repository not set');
      return;
    }
    var args = ['clone', currentRepo.git.url, currentRepoPath];
    var cmdout = run.execSync('git', args, null);
    return cmdout;
  },
  fetch: function() {
    if (currentRepoPath === undefined) {
      logger.error('fetch repository not set');
      return;
    }
    var cmdout = run.execSync('git', ['fetch'], currentRepoPath);
    if (cmdout.err) {
      logger.error('cannot do git fetch', currentRepoPath);
      return;
    }
  },
  pull: function() {
    if (currentRepoPath === undefined) {
      logger.error('pull repository not set');
      return;
    }
    var cmdout = run.execSync('git', ['pull'], currentRepoPath);
    if (cmdout.err) {
      logger.error('cannot do git pull', currentRepoPath);
      return;
    }
  },
  repoResetHard: function(hash) {
    if (currentRepoPath === undefined) {
      logger.error('repoResetHard repository not set');
      return;
    }
    var cmdout = run.execSync('git', ['reset', '--hard', hash],
      currentRepoPath);

    if (cmdout.err) {
      logger.error('cannot do git reset --hard ', currentRepoPath, hash);
      return;
    }

    cmdout = run.execSync('git', ['log', '-n1', '--pretty=format:%H'],
      currentRepoPath);
    if (cmdout.err) {
      logger.error('cannot do git log -n1', currentRepoPath);
      return;
    }
    var topHash = cmdout.stdout;
    if (topHash !== hash) {
      logger.error('Error after syncing ', hash, topHash);
      return;
    }
    return;
  },
  repoResetHardPrevious: function(hash) {
    if (currentRepoPath === undefined) {
      logger.error('repoResetHardPrevious repository not set');
      return;
    }
    var cmdout = run.execSync('git', ['reset', '--hard', 'HEAD^'],
      currentRepoPath);
    if (cmdout.err) {
      logger.error('cannot do git reset --hard ', currentRepoPath, hash);
      return;
    }
    cmdout = run.execSync('git', ['log', '-n1', '--pretty=format:%H'],
      currentRepoPath);
    if (cmdout.err) {
      logger.error('cannot do git log -n1', currentRepoPath);
      return;
    }
    return cmdout.stdout;
  },
  getRemoteToT: function(branch) {
    if (currentRepoPath === undefined) {
      logger.error('getRemoteToT repository not set');
      return;
    }
    var cmdout = run.execSync('git', ['log', branch, '-n1',
      '--pretty=format:%H'
    ], currentRepoPath);

    if (cmdout.err) {
      logger.error('cannot do git log branch -n1 ', currentRepoPath, branch);
      return;
    }
    var tot = cmdout.stdout;
    return tot;
  },
  getRepoToT: function() {
    if (currentRepoPath === undefined) {
      logger.error('getRepoToT repository not set');
      return;
    }
    var cmdout = run.execSync('git', ['log', '-n1', '--pretty=format:%H'],
      currentRepoPath);

    if (cmdout.err) {
      logger.error('cannot do git log -n1 ', currentRepoPath);
      return;
    }
    var tot = cmdout.stdout;
    return tot;
  },
  getBuildId: function(patch) {
    if (currentRepoPath === undefined) {
      logger.error('getBuildId repository not set');
      return;
    }
    var cmdout = run.execSync('git', [
      'log', '--oneline', '--pretty=format:%h', patch
    ], currentRepoPath);
    var t = cmdout.stdout.split('\n');
    var buildId = t.length;
    return buildId;
  },
  getPatchInfo: function(patch) {
    if (currentRepoPath === undefined) {
      logger.error('getPatchInfo repository not set');
      return;
    }

    var l = [];

    var targ = '--pretty=@tagStart@';

    var ii;
    for (ii = 0; ii < gitPrettyConfig.length; ii++)
      targ += '@tagDelimiter@' + gitPrettyConfig[ii].c;
    targ += '@tagEnd@';

    var cmdout = run.execSync('git', ['log', patch, '-n1', targ],
      currentRepoPath);

    if (cmdout.err) {
      console.log('ERR', cmdout.code);
      return;
    }
    var stdout = cmdout.stdout;
    logger.debug('commits stdout', stdout);

    // get everything after tagt start
    var commits = stdout.split('@tagStart@');

    //
    if (commits.length === 1 && commits[0] === '') {
      commits.shift();
    }
    commits.shift();
    logger.debug('commits commits', commits);

    for (ii = 0; ii < commits.length; ii++) {
      var commit = commits[ii];
      logger.debug('onecommit', ii, commits.length, commit);

      // get everything beofre tag end everything before tag end
      var parts = commit.split('@tagEnd@\n');
      commit = parts[0].split('@tagDelimiter@');

      // delete first
      commit.shift();

      logger.debug('onecommit', commit);

      var entry = {};
      for (var jj = 0; jj < gitPrettyConfig.length; jj++) {
        if (gitPrettyConfig[jj].p === 'parentHashes') {
          var tsplit = splitSpaces(commit[jj]);
          entry[gitPrettyConfig[jj].p] = tsplit;
        } else
          entry[gitPrettyConfig[jj].p] = commit[jj];
      }

      // add buildId
      logger.debug('entry', entry);

      l.push(entry);
    }
    // console.log(l);
    return l;
  },
  getLog: function(branch, startCommit, endCommit) {
    if (currentRepoPath === undefined) {
      logger.error('getLog repository not set');
      return;
    }

    // get num of patchs to compute buildIds
    var cmdout = run.execSync('git', ['log', branch, '--oneline',
      '--pretty=format:%h'
    ], currentRepoPath);

    var t = cmdout.stdout.split('\n');
    var numPatches = t.length;
    logger.debug(cmdout, numPatches);

    var l = [];

    // Start constructing arguments
    var args = [];
    args.push('log');
    args.push(branch);

    if (endCommit !== undefined) {
      args.push(endCommit + '..' + startCommit);
    }

    var targ = '--pretty="@tagStart@';
    var ii;
    for (ii = 0; ii < gitPrettyConfig.length; ii++)
      targ += '@tagDelimiter@' + gitPrettyConfig[ii].c;

    targ += '@tagEnd@"';
    args.push(targ);

    cmdout = run.execSync('git', args, currentRepoPath);
    if (cmdout.err) {
      console.log('ERR', cmdout.code);
      return;
    }
    var stdout = cmdout.stdout;
    logger.debug('commits stdout', stdout);

    // get everything after tagt start
    var commits = stdout.split('@tagStart@');
    //
    if (commits.length === 1 && commits[0] === '') {
      commits.shift();
    }
    commits.shift();
    logger.debug('commits commits', commits);

    for (ii = 0; ii < commits.length; ii++) {
      var commit = commits[ii];
      logger.debug('onecommit', ii, commits.length, commit);

      // get everything beofre tag end everything before tag end
      var parts = commit.split('@tagEnd@\n');
      commit = parts[0].split('@tagDelimiter@');

      // delete first
      commit.shift();

      logger.debug('onecommit', commit);

      var entry = {};
      for (var jj = 0; jj < gitPrettyConfig.length; jj++) {
        if (gitPrettyConfig[jj].p === 'parentHashes') {
          var tsplit = splitSpaces(commit[jj]);
          entry[gitPrettyConfig[jj].p] = tsplit;
        } else
          entry[gitPrettyConfig[jj].p] = commit[jj];
      }

      // add buildId
      entry.buildId = numPatches - ii;
      logger.debug('entry', entry);

      l.push(entry);
    }
    return l;
  },
  checkRemoteBranchExists: function (branchName, repoName) {
    var args = ['branch', '-r', '--list', branchName]
    var cmdout = run.execSync('git', args, repoPath + '/' + repoName);
    if (cmdout.err) {
      console.log('ERR', cmdout.code);
      return false;
    }

    var result = cmdout.stdout.trim().length !== 0;
    if (!result) {
      logger.error("Couldn't find remote branch '" + branchName + "'");
    }

    return result;
  },
  checkCommitExists: function (branchName, commit, repoName) {
    var args = ['branch', '-r', '--contains', commit];
    var cmdout = run.execSync('git', args, repoPath + '/' + repoName);
    if (cmdout.err) {
      console.log('ERR', cmdout.code);
      return false;
    }

    var lines = cmdout.stdout.split('\n');
    for(var i = 0;i < lines.length;i++){
      if (lines[i].trim() === branchName) {
        return true;
      }
    }
    return false;
  }
};
