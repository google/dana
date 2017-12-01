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
/* eslint require-jsdoc: "off" */
/* eslint-env es6 */

const global = {
  debug: false,
};

function setDebug() {
  global.debug = true;
}
// serie
// serie.samples -> set of { buildid:value }
// serie.analysis
//    base -> start of buildId
//    type -> other infos
// serie.description

//
// Common functions
//

// returns aRange of analysis (used by analysis)
function getARange(range) {
  let aRange = {
    up: 0,
    upIsValue: true,
    down: 0,
    downIsValue: true,
  };
  if (range != undefined) {
    if (Object.prototype.toString.call(range) === '[object Array]') {
      aRange.down = range[0] + '';
      if (aRange.down.indexOf('%') != -1) {
        aRange.downIsValue = false;
        aRange.down = aRange.down.substr(0, aRange.down.indexOf('%'));
      }
      aRange.down = aRange.down * 1;

      aRange.up = range[1] + '';
      if (aRange.up.indexOf('%') != -1) {
        aRange.upIsValue = false;
        aRange.up = aRange.up.substr(0, aRange.up.indexOf('%'));
      }
      aRange.up = aRange.up * 1;
    } else {
      aRange.down = range + '';
      if (aRange.down.indexOf('%') != -1) {
        aRange.downIsValue = false;
        aRange.down = aRange.down.substr(0, aRange.down.indexOf('%'));
      }
      aRange.up = aRange.down * 1;
      aRange.upIsValue = aRange.downIsValue;
      aRange.down = -aRange.up;
    }
  }
  return aRange;
}

//
// ANALYSIS
//
// Each analyse type provides a fn and is called by
// fn(serie, sortedBuildIds, indexStart, indexStop)
// serie has a valid samples and analyse
// sortedBuilds is ready to use
// range between indexStart and indexStop exist

//
// Benchmark analysis
//
// analyse.test.propagate
//
// serie.analyseResult
// {
//  isPassing
//  lastPassing,
//  failingSince,
//  lastExecuted
// }
function testAnalyse(serie, sortedBuildIds, indexStart, indexStop) {
  if (global.debug) {
    console.log('testAnalyse -- ', serie, sortedBuildIds, indexStart,
      indexStop);
  }
  let samples = serie.samples;
  let analyse = serie.analyse;

  if (analyse.test.propagate) {
    for (let cIndex = indexStart; cIndex <= indexStop; cIndex++) {
      let s = samples[sortedBuildIds[cIndex]];
      if (!s) {
        let lp;
        if (cIndex > indexStart) lp = sortedBuildIds[cIndex - 1];
        serie.analyseResult = {
          isPassing: false,
          lastPassing: lp,
          failingSince: sortedBuildIds[cIndex],
          lastExecuted: sortedBuildIds[indexStop],
        };
        return;
      }
    }
    serie.analyseResult = {
      isPassing: true,
      lastPassing: sortedBuildIds[indexStop],
      failingSince: undefined,
      lastExecuted: sortedBuildIds[indexStop],
    };
    return;
  }

  // serie is passing
  if (samples[sortedBuildIds[indexStop]]) {
    serie.analyseResult = {
      isPassing: true,
      lastPassing: sortedBuildIds[indexStop],
      failingSince: undefined,
      lastExecuted: sortedBuildIds[indexStop],
    };
    return;
  }

  // serie is faling rewind to find last passing
  for (let cIndex = indexStop; cIndex >= indexStart; cIndex--) {
    let s = samples[sortedBuildIds[cIndex]];
    if (s) {
      let fs;
      if (cIndex < indexStop) fs = sortedBuildIds[cIndex + 1];
      serie.analyseResult = {
        isPassing: false,
        lastPassing: sortedBuildIds[cIndex],
        failingSince: fs,
        lastExecuted: sortedBuildIds[indexStop],
      };
      return;
    }
  }
  serie.analyseResult = {
    isPassing: false,
    lastPassing: undefined,
    failingSince: sortedBuildIds[indexStart],
    lastExecuted: sortedBuildIds[indexStop],
  };
}

//
// Benchmark analysis
//
// analyse.benchmark.range
// analyse.benchmark.required
// analyse.benchmark.trend
function benchmarkAnalyse(serie, sortedBuildIds, indexStart, indexStop) {
  if (global.debug) {
    console.log('benchmarkAnalyse -- ', serie, sortedBuildIds, indexStart,
      indexStop);
  }
  let samples = serie.samples;
  let analyse = serie.analyse;

  let aRange = getARange(analyse.benchmark.range);
  if (global.debug) {
    console.log('benchmarkAnalyse -- aRange', aRange);
  }
  let startIndex;
  let average;
  let sum;
  let numberSamples;
  let firstIsDetected = false;
  let theRegressions = [];
  let cIndex;
  for (cIndex = indexStart; cIndex <= indexStop; cIndex++) {
    if (global.debug) {
      console.log('benchmarkAnalyse', sortedBuildIds[cIndex],
        samples[sortedBuildIds[cIndex]]);
    }
    if (!firstIsDetected) {
      if (newAverageIsValid(cIndex)) {
        if (global.debug) console.log('benchmarkAnalyse -- FIRST IS DETECTED');
        startIndex = cIndex;
        sum = samples[sortedBuildIds[cIndex]];
        average = samples[sortedBuildIds[cIndex]];
        numberSamples = 1;
        firstIsDetected = true;
      }
      continue;
    }
    let value = samples[sortedBuildIds[cIndex]];
    let diff = value - average;
    let ratio = diff * 100 / average;
    let breaks = false;
    if (ratio > 0) {
      if (aRange.upIsValue) {
        if (diff > aRange.up) {
          breaks = true;
        }
      } else {
        if (ratio > aRange.up) {
          breaks = true;
        }
      }
    }
    if (ratio < 0) {
      if (aRange.downIsValue) {
        if (diff < aRange.down) {
          breaks = true;
        }
      } else
      if (ratio < aRange.down) {
        breaks = true;
      }
    }
    if (breaks) {
      if (newAverageIsValid(cIndex)) {
        if (global.debug) {
          console.log('benchmarkAnalyse --',
            ' THIS IS A NEW VALID BREAK USE NEW ONE');
        }
        if (global.debug) {
          console.log('benchmarkAnalyse --',
            ' CREATE A NEW AVERAGE from:', startIndex, 'length:',
            (cIndex - startIndex), 'average:', average);
        }
        theRegressions.push({
          start: startIndex,
          end: cIndex - 1,
          length: cIndex - startIndex,
          average: average.toFixed(2) * 1,
        });
        sum = value;
        average = value;
        numberSamples = 1;
        startIndex = cIndex;
      }
    } else {
      sum += value;
      numberSamples++;
      average = sum / numberSamples;
    }
  }
  if (!firstIsDetected) {
    serie.analyseResult = {
      summary: {
        error: 'Unable to find first average',
        lastBuildId: sortedBuildIds[indexStop],
      },
    };
    return;
  }
  if (global.debug) {
    console.log('benchmarkAnalyse -- EXIT CREATE A NEW AVERAGE from:',
      startIndex, 'length:', (cIndex - startIndex), 'average:', average);
  }
  theRegressions.push({
    start: startIndex,
    end: cIndex - 1,
    length: cIndex - startIndex,
    average: average.toFixed(2) * 1,
  });

  function newAverageIsValid(indexStart) {
    if ((indexStart + analyse.benchmark.required) > sortedBuildIds.length) {
      return false;
    }
    let average = samples[sortedBuildIds[indexStart]];
    let sum = samples[sortedBuildIds[indexStart]];
    let numberSamples = 1;

    for (let cIndex = 0; cIndex < analyse.benchmark.required; cIndex++) {
      let value = samples[sortedBuildIds[cIndex + indexStart]];
      let diff = value - average;
      let ratio = diff * 100 / average;
      let breaks = false;
      if (ratio > 0) {
        if (aRange.upIsValue) {
          if (diff > aRange.up) {
            breaks = true;
          }
        } else {
          if (ratio > aRange.up) {
            breaks = true;
          }
        }
      }
      if (ratio < 0) {
        if (aRange.downIsValue) {
          if (diff < aRange.down) {
            breaks = true;
          }
        } else
        if (ratio < aRange.down) {
          breaks = true;
        }
      }
      if (breaks) {
        if (global.debug) {
          console.log('newAverageIsValid breaks', cIndex, ratio, diff);
        }
        return (false);
      }
      sum += value;
      numberSamples++;
      average = sum / numberSamples;
    }
    return true;
  }

  if (global.debug) {
    console.log('theRegressions', JSON.stringify(theRegressions, null, 4));
  }

  let first = undefined;

  for (let ii = 0; ii < theRegressions.length; ii++) {
    let r = theRegressions[ii];
    if (r.length < analyse.benchmark.required) {
      console.log('WARNING one length is below required',
        JSON.stringify(serie, null, 4),
        JSON.stringify(theRegressions, null, 4));
    }
    if (first === undefined) {
      if (r.length >= analyse.benchmark.required) {
        first = ii;
        r.ratio = 0;
        r.diff = 0;
        r.status = 'similar';
      }
    } else {
      let tdiff = r.average - theRegressions[first].average;
      let tratio = tdiff * 100 / theRegressions[first].average;
      r.ratio = tratio.toFixed(2) * 1;
      r.diff = tdiff.toFixed(2) * 1;

      // if tratio is in range, ok
      let outOfRange = false;
      if (tratio > 0) {
        if (aRange.upIsValue) {
          if (tdiff > aRange.up) {
            outOfRange = true;
          }
        } else
        if (tratio > aRange.up) {
          outOfRange = true;
        }
      }
      if (tratio < 0) {
        if (aRange.downIsValue) {
          if (tdiff < aRange.down) {
            outOfRange = true;
          }
        } else
        if (tratio < aRange.down) {
          outOfRange = true;
        }
      }
      let status = 'similar';
      if (outOfRange) {
        if (tratio > 0) {
          if (analyse.benchmark.trend === 'higher') {
            status = 'improvement';
          } else {
            status = 'regression';
          }
        } else {
          if (analyse.benchmark.trend === 'smaller') {
            status = 'improvement';
          } else {
            status = 'regression';
          }
        }
      }
      r.status = status;
    }
  }

  serie.analyseResult = {
    details: {
      analyse: analyse,
      aRange: aRange,
      indexStart: indexStart,
      first: first,
    },
    summary: {
      lastBuildId: sortedBuildIds[indexStop],
      status: theRegressions[theRegressions.length - 1].status,
      current: {
        average: theRegressions[theRegressions.length - 1].average,
        ratio: theRegressions[theRegressions.length - 1].ratio,
        diff: theRegressions[theRegressions.length - 1].diff,
      },
      base: {
        average: theRegressions[first].average,
      },
    },
    averages: theRegressions,
  };

  let reduceBaseTo;
  if (serie.analyseResult.summary.status === 'similar') {
    if (serie.analyseResult.averages.length === 1) {
      if (sortedBuildIds.length > 50) {
        reduceBaseTo = sortedBuildIds[sortedBuildIds.length - 50];
      }
    }
  }
  serie.analyseResult.summary.reduceBaseTo = reduceBaseTo;
}

function analyse(serie) {
  if (global.debug) {
    console.log('analyse -- ', serie);
  }
  if (serie.analyse === undefined) {
    console.log('analyse -- ERROR serie.analyse not defined');
    return;
  }
  if (serie.samples == undefined) {
    console.log('analyse -- ERROR  no samples in serie');
    return;
  }

  let samples = serie.samples;
  let sortedBuildIds = Object.keys(samples);
  for (let ii = 0; ii < sortedBuildIds.length; ii++) {
    sortedBuildIds[ii] = sortedBuildIds[ii] * 1;
    if (samples[sortedBuildIds[ii]] == undefined) {
      console.log('analyse -- ERROR samples undefined', ii, sortedBuildIds[ii]);
      return;
    }
  }

  sortedBuildIds.sort(function(a, b) {
    return a * 1 - b * 1;
  });

  // default options
  let indexStart = 0;
  let indexStop = sortedBuildIds.length - 1;

  // adjust indexStart according to base
  let analyse = serie.analyse;
  if (analyse.base != undefined) {
    if (global.debug) console.log('analyse.base found to', analyse.base, serie)
    // set new indexStart
    let youngerBuildId = sortedBuildIds[sortedBuildIds.length - 1] * 1;
    let startBuildId;
    startBuildId = analyse.base * 1;
    if (startBuildId > youngerBuildId) {
      console.log('analyse -- - ERROR - startBuildId > youngerBuildId');
      return;
    }
    for (let ii = 0; ii < sortedBuildIds.length; ii++) {
      if (sortedBuildIds[ii] * 1 >= startBuildId * 1) {
        indexStart = ii;
        break;
      }
    }
  }

  if (indexStop < indexStart) {
    console.log('analyse -- - ERROR -- indexStop < indexStart');
    return;
  }

  if (analyse.benchmark) {
    benchmarkAnalyse(serie, sortedBuildIds, indexStart, indexStop);
  }
  if (analyse.test) {
    testAnalyse(serie, sortedBuildIds, indexStart, indexStop);
  }
}

// cp.useBuildId -- optional
// cp.useAverage -- optional
function benchmarkCompare(cp, serie, cpSerie) {
  let value;
  let cpValue;

  if (cp.useAverage) {
    if (serie.analyseResult) {
      if (serie.analyseResult.summary) {
        if (!serie.analyseResult.summary.error) {
          value = serie.analyseResult.summary.current.average;
        }
      }
    }
  } else {
    value = serie.samples[serie.lastBuildId];
  }
  if (value === undefined) {
    return undefined;
  }

  if (cp.compareWith.useAverage) {
    if (cpSerie.analyseResult) {
      if (cpSerie.analyseResult.summary) {
        if (!cpSerie.analyseResult.summary.error) {
          if (cp.compareWith.useBuildId) {
            // find in wich average is located the BuildId
            // and use its valueinfo
            let samples = serie.samples;
            let sortedBuildIds = Object.keys(samples);
            for (let ii = 0; ii < sortedBuildIds.length; ii++) {
              sortedBuildIds[ii] = sortedBuildIds[ii] * 1;
              if (samples[sortedBuildIds[ii]] == undefined) {
                console.log('analyse -- ERROR samples undefined', ii, sortedBuildIds[ii]);
                return;
              }
            }
            sortedBuildIds.sort(function(a, b) {
              return a * 1 - b * 1;
            });

            let myIndex;
            for (let ii = 0; ii < sortedBuildIds.length; ii++) {
              if (sortedBuildIds[ii] === cp.compareWith.useBuildId * 1) {
                myIndex = ii;
                break;
              }
            }
            if (myIndex !== undefined) {
              for (let ii = 0; ii < sortedBuildIds.length; ii++) {
                if (myIndex <= cpSerie.analyseResult.averages[ii].end) {
                  cpValue = cpSerie.analyseResult.averages[ii].average;
                  break;
                }
              }
            }
          } else {
            cpValue = cpSerie.analyseResult.summary.current.average;
          }
        }
      }
    }
  } else {
    if (cp.compareWith.useBuildId) {
      cpValue = cpSerie.samples[cp.compareWith.useBuildId];
    } else {
      cpValue = cpSerie.samples[cpSerie.lastBuildId];
    }
  }

  if (cpValue === undefined) {
    return undefined;
  }

  if (serie.analyse === undefined) return undefined;
  let analyse = serie.analyse;

  if (analyse.benchmark) {
    let aRange = getARange(analyse.benchmark.range);
    let diff = value - cpValue;
    let ratio = diff * 100 / cpValue;

    // if ratio is in range, ok
    let outOfRange = false;
    if (ratio > 0) {
      if (aRange.upIsValue) {
        if (diff > aRange.up) {
          outOfRange = true;
        }
      } else
      if (ratio > aRange.up) {
        outOfRange = true;
      }
    }
    if (ratio < 0) {
      if (aRange.downIsValue) {
        if (diff < aRange.down) {
          outOfRange = true;
        }
      } else
      if (ratio < aRange.down) {
        outOfRange = true;
      }
    }
    let status = 'similar';
    if (outOfRange) {
      if (ratio > 0) {
        if (analyse.benchmark.trend === 'higher') {
          status = 'better';
        } else {
          status = 'lower';
        }
      } else {
        if (analyse.benchmark.trend === 'smaller') {
          status = 'better';
        } else {
          status = 'lower';
        }
      }
    }

    return ({
      status: status,
      diff: diff.toFixed(2) * 1,
      myValue: value,
      compareValue: cpValue,
    });
  }
}

module.exports.analyse = analyse;
module.exports.setDebug = setDebug;
module.exports.benchmarkCompare = benchmarkCompare;
