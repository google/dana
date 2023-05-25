/*
 * Copyright 2022 Google Inc. All rights reserved.
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
/* eslint require-jsdoc: "off" */
/* eslint-env es6 */

const TIME_UNITS = {
  "ns": 1,
  "us": 10**3,
  "ms": 10**6,
};
const SIZE_UNITS = {
  "bytes": 1,
  "kbytes": 2**10,
  "mbytes": 2**20,
};

function convertValue(value, srcRatio, dstRatio) {
  if (srcRatio < dstRatio) {
    return value / (dstRatio / srcRatio);
  }
  return value * (srcRatio / dstRatio);
}

function unitConversion(value, srcUnit, dstUnit) {
  if (srcUnit === "number") {
    return value;
  }
  if (srcUnit in TIME_UNITS) {
    return convertValue(value, TIME_UNITS[srcUnit], TIME_UNITS[dstUnit]);
  }
  if (srcUnit in SIZE_UNITS) {
    return convertValue(value, SIZE_UNITS[srcUnit], SIZE_UNITS[dstUnit]);
  }
  return null;
}

function unitConversionFixedPoint(value, srcUnit, dstUnit, digits) {
  let result = unitConversion(value, srcUnit, dstUnit);
  if (result === null) {
    return null;
  }
  return Number.isInteger(result) ? result : parseFloat(result.toFixed(digits));
}

module.exports.unitConversion = unitConversion;
module.exports.unitConversionFixedPoint = unitConversionFixedPoint;
