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

// LOGs
var log4js;
var logger;

module.exports.createLogger = function(type, filelog, level) {
  if (logger === undefined) {
    if (type === 'console') {
      log4js = require('log4js');
      log4js.configure({
        appenders: [{
          type: 'console'
        }, {
          type: 'file',
          filename: filelog,
          maxLogSize: 1024 * 1024 * 10,
          backups: 10,
          category: 'server'
        }]
      });
      logger = log4js.getLogger('server');
    }
    if (type === 'noconsole') {
      log4js = require('log4js');
      log4js.configure({
        appenders: [{
          type: 'file',
          filename: filelog,
          maxLogSize: 1024 * 1024 * 10,
          backups: 10,
          category: 'server'
        }]
      });
      logger = log4js.getLogger('server');
    }
    logger.setLevel(level);
  }
  return logger;
};

module.exports.getLogger = function() {
  return logger;
};

module.exports.getLog4Js = function() {
  return log4js;
};

/*
logger.trace('Trace.');
logger.debug('Debug.');
logger.info('Info.');
logger.warn('Warn.');
logger.error('Error.');
logger.fatal('Fatal.');
*/
