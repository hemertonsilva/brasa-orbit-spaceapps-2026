#!/usr/bin/env python3
"""Build daily MODIS / VIIRS S-NPP active-fire counts for the Brasa Orbit calendar.

Input : NASA FIRMS standard (archive) yearly country files for Brazil, 2018-2020
        https://firms.modaps.eosdis.nasa.gov/data/country/{modis|viirs-snpp}/{YEAR}/{modis|viirs-snpp}_{YEAR}_Brazil.csv
Output: docs/data/firms_daily_2018_2020.json (small, committed; feeds the web calendar)

Counting rule
  * one row = one FIRMS detection (a pixel flagged with one or more fires/thermal anomalies),
    NOT one fire and NOT burned area;
  * only rows with type == 0 ("presumed vegetation fire");
  * all confidence levels, day and night passes;
  * date = acq_date as published by FIRMS (UTC);
  * regions are half-open boxes: lon_min <= lon < lon_max and lat_min <= lat < lat_max.

The FIRMS files carry no information on cloud cover or missing observations, so a zero
means "no detection recorded", never "no fire".

AI assistance: this script was written with the help of an AI coding assistant (Claude)
during the NASA Space Apps Challenge 2026 hackathon window and reviewed by the team.

Usage: python3 -I scripts/build_data.py <raw_dir> <output_json>
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

YEARS = (2018, 2019, 2020)
SENSORS = {"modis": "modis", "viirs": "viirs-snpp"}
REGIONS = {
    "R1": {
        "name": "Western Mato Grosso (training sector)",
        "lon": [-56.0, -52.0],
        "lat": [-17.0, -10.0],
    },
    "R2": {
        "name": "MATOPIBA (Cerrado agricultural frontier)",
        "lon": [-47.0, -43.0],
        "lat": [-12.0, -5.0],
    },
}


def in_box(lon: float, lat: float, box: dict) -> bool:
    return box["lon"][0] <= lon < box["lon"][1] and box["lat"][0] <= lat < box["lat"][1]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(raw_dir: Path, out_path: Path) -> None:
    start, end = dt.date(YEARS[0], 1, 1), dt.date(YEARS[-1], 12, 31)
    days = [(start + dt.timedelta(n)).isoformat() for n in range((end - start).days + 1)]
    index = {d: i for i, d in enumerate(days)}
    series = {r: {s: [0] * len(days) for s in SENSORS} for r in REGIONS}
    inputs, versions = [], {s: set() for s in SENSORS}

    for sensor, prefix in SENSORS.items():
        for year in YEARS:
            path = raw_dir / f"{prefix}_{year}_Brazil.csv"
            inputs.append({"file": path.name, "bytes": path.stat().st_size, "sha256": sha256(path)})
            with path.open(newline="", encoding="utf-8") as fh:
                for row in csv.DictReader(fh):
                    if row.get("type") != "0":
                        continue
                    lon, lat = float(row["longitude"]), float(row["latitude"])
                    i = index.get(row["acq_date"])
                    if i is None:
                        continue
                    versions[sensor].add(row["version"])
                    for rid, box in REGIONS.items():
                        if in_box(lon, lat, box):
                            series[rid][sensor][i] += 1

    out = {
        "_meta": {
            "title": "Brasa Orbit - daily active-fire detections, MODIS vs VIIRS S-NPP",
            "source": "NASA FIRMS standard (archive) yearly country files, Brazil",
            "source_url": "https://firms.modaps.eosdis.nasa.gov/data/country/",
            "acknowledgment": "We acknowledge the use of imagery from the NASA LANCE FIRMS (https://www.earthdata.nasa.gov/data/tools/firms).",
            "versions_as_labelled_in_files": {s: sorted(v) for s, v in versions.items()},
            "filter": "type == 0 (presumed vegetation fire); all confidence levels; day and night",
            "date_basis": "acq_date (UTC) as published by FIRMS",
            "box_rule": "half-open: lon_min <= lon < lon_max, lat_min <= lat < lat_max",
            "zero_meaning": "no detection recorded; FIRMS files carry no cloud-cover or missing-observation information",
            "not": "not a fire count, not burned area, not a harmonized series",
            "ai_assistance": True,
            "generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "inputs": inputs,
        },
        "regions": REGIONS,
        "start": days[0],
        "days": len(days),
        "series": series,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    for rid in REGIONS:
        for year in YEARS:
            sl = [i for i, d in enumerate(days) if d.startswith(str(year))]
            m = sum(series[rid]["modis"][i] for i in sl)
            v = sum(series[rid]["viirs"][i] for i in sl)
            print(f"{rid} {year} modis={m} viirs={v}")
    print(f"wrote {out_path} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
