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
/* eslint require-jsdoc: 'off' */
/* eslint-env es6 */
const a = require('./analyse');

const serie1 = {
  'samples': {
    '287': 300,
    '289': 300,
    '290': 200,
    '299': 250,
    '309': 400,
    '316': 400,
  },
  'analyse': {
    'benchmark': {
      range: '5%',
      required: 2,
      trend: 'higher',
    },
  },
};

let s = serie1;
a.setDebug();
a.analyse(s);
console.log(JSON.stringify(s, null, 4));
console.dir(s, {
  depth: null,
  colors: true,
});
