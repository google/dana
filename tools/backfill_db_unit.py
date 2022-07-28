#!/usr/bin/env python3
# Copyright 2022 The IREE Authors
#
# Licensed under the Apache License v2.0 with LLVM Exceptions.
# See https://llvm.org/LICENSE.txt for license information.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, Tuple


def convert(value: float, ratio: float) -> float:
  return value * ratio


def convert_int(value: float, ratio: float) -> int:
  return int(round(convert(value, ratio)))


def update_analyse(analyse: Dict[str, Any], ratio: float):
  analyse = dict(analyse)
  average = analyse.get("average")
  diff = analyse.get("diff")
  if average:
    analyse["average"] = convert(average, ratio)
  if diff:
    analyse["diff"] = convert(diff, ratio)
  return analyse


def convert_series_info(series_info: Dict[str, Any], ratio: float):
  status = series_info["status"]
  current = status.get("current")
  if current:
    status["current"] = update_analyse(current, ratio)
  base = status.get("base")
  if base:
    status["base"] = update_analyse(base, ratio)


def convert_analyse_result(analyse_result: Dict[str, Any], ratio: float):
  summary = analyse_result["summary"]
  summary["current"] = update_analyse(summary["current"], ratio)
  summary["base"] = update_analyse(summary["base"], ratio)
  analyse_result["averages"] = [
      update_analyse(average, ratio) for average in analyse_result["averages"]
  ]
  aRange = analyse_result["details"]["aRange"]
  if aRange["downIsValue"] == True:
    aRange["up"] = convert_int(aRange["up"], ratio)
    aRange["down"] = convert_int(aRange["down"], ratio)

  benchmark = analyse_result["details"]["analyse"]["benchmark"]
  if not str(benchmark["range"]).endswith("%"):
    benchmark["range"] = convert_int(int(benchmark["range"]), ratio)


def getIREESeriesDefaultUnitAndRatio(series_id: str) -> Tuple[str, int]:
  # Do specific type conversion for IREE benchmarks.
  if 'compilation-time' in series_id:
    return ("ms", 1)
  elif 'total-dispatch-size' in series_id:
    return ("bytes", 1)
  else:
    return ("ns", 1000000)


def update_db(args: argparse.Namespace):
  db_root_dir = args.db_root_dir
  benchmarks_series_json = db_root_dir / "infos" / "benchmarks.series.json"
  with open(benchmarks_series_json) as f:
    series_infos = json.load(f)

  for series_id, series_info in series_infos.items():
    series_unit, convert_ratio = getIREESeriesDefaultUnitAndRatio(series_id)
    # Check if the backfill is needed.
    if "serieUnit" in series_info:
      continue

    series_info["serieUnit"] = series_unit
    convert_series_info(series_info, convert_ratio)

  if not args.dry_run:
    with open(benchmarks_series_json, "w") as f:
      json.dump(series_infos, f)

  for name in os.listdir(db_root_dir / "series"):
    if Path(name).suffix != ".json":
      continue

    series_json = db_root_dir / "series" / name
    with open(series_json) as f:
      series = json.load(f)

    series_unit, convert_ratio = getIREESeriesDefaultUnitAndRatio(name)
    # Check if the backfill is needed.
    if "serieUnit" in series:
      continue

    series["serieUnit"] = series_unit
    convert_analyse_result(series["analyseResult"], convert_ratio)
    samples = series["samples"]
    for build_id, sample_value in samples.items():
      samples[build_id] = convert_int(sample_value, convert_ratio)

    benchmark = series["analyse"]["benchmark"]
    if not str(benchmark["range"]).endswith("%"):
      benchmark["range"] = convert_int(int(benchmark["range"]), convert_ratio)

    if not args.dry_run:
      with open(series_json, "w") as f:
        json.dump(series, f)


def parse_arguments():
  """Parses command-line options."""
  parser = argparse.ArgumentParser()
  parser.add_argument("db_root_dir",
                      type=Path,
                      help=("IREE database root directory."))
  parser.add_argument("--dry-run",
                      action=argparse.BooleanOptionalAction,
                      default=True,
                      help=("Backfill units in to the IREE database."))
  args = parser.parse_args()
  return args


if __name__ == "__main__":
  update_db(parse_arguments())
