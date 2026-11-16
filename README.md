# Brasa Orbit

**MODIS and VIIRS active-fire detections, side by side, in one calendar.**

By Hemerton Silva · Team Brasa Orbital · NASA Space Apps Challenge 2026 (Santa Cruz das Palmeiras Local Event, virtual)

Challenge: *Harmonization of MODIS and VIIRS Hot Spots*

Built during the NASA Space Apps Challenge 2026 hackathon window (14–15 Nov 2026).

- Calendar app: https://hemertonsilva.github.io/brasa-orbit-spaceapps-2026/
- Slides: https://hemertonsilva.github.io/brasa-orbit-spaceapps-2026/slides/

## Overview

Two NASA sensor families record active fires over the same ground: MODIS (about 1 km pixels) and VIIRS on Suomi NPP (375 m pixels). Their detection counts are not interchangeable. A user who switches from one record to the other can mistake a change of instrument for a change on the ground.

Brasa Orbit puts both records in the same day × month × year calendar for an area of interest. The reader can see where the two sensors agree, where they differ, and why a raw comparison is not yet a harmonized series.

Two widely used services show the split: INPE uses a single "reference satellite" (Aqua since 22 Aug 2011), and GWIS shows VIIRS and MODIS anomalies separately. Brasa Orbit shows both records for the same area and days. It is a first step toward harmonization: measuring the seasonal gap any harmonization must correct.

## What it shows

- Daily counts of FIRMS detections for MODIS and VIIRS S-NPP, side by side, for 2018–2020, browsable by day, month and year.
- A region selector:
  - **R1 — central-eastern Mato Grosso, Brazil:** lon [−56, −52) × lat [−17, −10).
  - **R2 — part of MATOPIBA (Cerrado agricultural frontier), Brazil (comparison):** lon [−47, −43) × lat [−12, −5).
  - Boxes are half-open: a detection at exactly lon −52 is not in R1.
- A VIIRS/MODIS ratio labelled **"naive diagnostic, not harmonization"**.
- A legend that reads **"no detection recorded ≠ no fire"**: FIRMS files carry no information on cloud cover or missing observations.

### What the calendar reveals

| Region | Year | MODIS | VIIRS S-NPP | VIIRS/MODIS |
| --- | --- | ---: | ---: | ---: |
| R1 | 2018 | 12,986 | 41,287 | 3.18 |
| R1 | 2019 | 23,839 | 79,303 | 3.33 |
| R1 | 2020 | 37,051 | 132,219 | 3.57 |
| R2 | 2018 | 28,836 | 126,636 | 4.39 |
| R2 | 2019 | 36,290 | 157,356 | 4.34 |
| R2 | 2020 | 32,782 | 144,100 | 4.40 |

Detections with `type == 0`, day and night, dates in UTC. MODIS counts include both Terra and Aqua; VIIRS here is Suomi NPP only.

**The two sensors agree on timing.** September is the peak month in every year, in both regions, for both sensors.

In R1, over a full year, VIIRS records 3.2–3.6× as many detections as MODIS. Yet in 9 months MODIS records clearly more than VIIRS (ratio below 0.8: February–April of 2018, 2019 and 2020):

| R1 monthly VIIRS/MODIS | Feb | Mar | Apr |
| --- | ---: | ---: | ---: |
| 2018 | 0.58 | 0.50 | 0.35 |
| 2019 | 0.70 | 0.21 | 0.43 |
| 2020 | 0.39 | 0.22 | 0.62 |

In R2, the ratio drops below 0.8 in March of each year (0.51 / 0.78 / 0.78 for 2018 / 2019 / 2020).

The ratio between the two records changes with the season. In these data, no single scaling factor fits every month. The February–April inversion is unexpected and still to be verified. Pixel size, overpass time and the number of satellites can all produce gaps like these; this view shows them but does not correct for them.

## Data (NASA FIRMS)

- **Source:** NASA FIRMS (Fire Information for Resource Management System), standard (archive) yearly country files for Brazil, 2018–2020.
  - MODIS: version 6.03, as labelled in the files.
  - VIIRS S-NPP (375 m): version 2, as labelled in the files.
- **URL pattern:** `https://firms.modaps.eosdis.nasa.gov/data/country/{modis|viirs-snpp}/{YEAR}/{modis|viirs-snpp}_{YEAR}_Brazil.csv`
- **Accessed:** 15 Nov 2026. File sizes and SHA-256 checksums are recorded in `docs/data/firms_daily_2018_2020.json` (`_meta.inputs`).
- **Not in this repository:** the raw CSV files. [scripts/build_data.py](scripts/build_data.py) rebuilds the aggregated JSON from them.
- **Suomi NPP status:** according to the FIRMS FAQ, S-NPP production "ceased at 15:40 UTC on November 2, 2026". The 2018–2020 period used here is not affected.

## Method

1. Read the FIRMS yearly country files for MODIS and VIIRS S-NPP (Brazil, 2018–2020).
2. Keep rows with `type == 0` (presumed vegetation fire). This field exists only in the standard product. All confidence levels are kept, from both day and night passes.
3. Assign each detection to a day using `acq_date` (UTC) as published by FIRMS.
4. Clip to each region with half-open bounds: `lon_min <= lon < lon_max` and `lat_min <= lat < lat_max`.
5. Count detections per day, then add them up by month and year.
6. Compute the VIIRS/MODIS ratio as a naive diagnostic. It is not a correction.

## Next step: exposure-normalized rate

Raw counts mix fire activity with how much ground each sensor actually observed. The next step is a rate per observed area. For each comparable overpass *p*, let *Aₚ* be the usable area both sensors observed and *Dₚ* the detections counted on that same area:

```
E = Σ Aₚ                 (exposure, km² × overpass)
Y = 1000 · Σ Dₚ / E      (detections per 1,000 km² observed per overpass), only when E > 0
```

An observed zero and a missing rate are different things. A period with usable observations and no detections has Y = 0. A period with no usable observation has no rate at all.

This step needs coverage and cloud information that the FIRMS CSV files do not provide. It is described here as method only. This submission does not compute it.

## Limitations

- **Not harmonized.** The calendar shows raw counts. The ratio is a naive diagnostic, not a calibrated or harmonized series.
- **A detection is not a fire, and not burned area.** One fire can produce many detections. Pixel sizes differ: about 1 km for MODIS and 375 m for VIIRS.
- **No coverage information.** FIRMS files "do not provide any information on cloud cover or missing data" (FIRMS FAQ). A day without detections is "no detection recorded", not "no fire".
- **Limited scope.** Two regions in Brazil, 2018–2020. Results are not shown to hold elsewhere.
- **No causal claims.** This is not an operational alert, a forecast or a burned-area product.
- **Sensor continuity.** Suomi NPP stopped producing new observations on 2 Nov 2026. This calendar uses only S-NPP for VIIRS.

## Use of AI tools

The author conceived the idea and made the project decisions. AI assistants (Claude, by Anthropic) helped organize the concept (13 Nov 2026) and, during the hackathon window, with research, data analysis, code and writing. No AI-generated images are used.

## Prior work

This project draws on prior independent feasibility research (private), not included in this submission. No code or data from that research is used here.

## License

Apache License 2.0 — © 2026 Hemerton Silva (see [LICENSE](LICENSE)).

## Acknowledgment

We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time Capability for Earth observations (LANCE) (https://earthdata.nasa.gov/lance) and NASA's Earth Science Data and Information System (ESDIS).

Data accessed on 15 Nov 2026.
