"""
harmonize_brfss.py — Download BRFSS 2014-2020 XPT files from CDC,
harmonize column names with 2023, and produce a single Parquet file.

Usage:
    source .venv/bin/activate
    python scripts/harmonize_brfss.py
"""

import io
import os
import sys
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pyreadstat

# ── Configuration ──────────────────────────────────────────────────────

YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2023]
DOWNLOAD_DIR = Path("data/brfss_xpt")
OUTPUT_PATH = Path("data/brfss_harmonized.parquet")
BRFSS_2023_PATH = Path("/Users/cwhogg/Downloads/brfss_2023.parquet")

# CDC download URLs — pattern varies slightly by year
def get_cdc_url(year: int) -> str:
    if year <= 2016:
        return f"https://www.cdc.gov/brfss/annual_data/{year}/files/LLCP{year}XPT.zip"
    else:
        return f"https://www.cdc.gov/brfss/annual_data/{year}/files/LLCP{year}XPT.zip"


# ── Columns we want (canonical 2023 names) ────────────────────────────

# These are the ~68 columns referenced in the schema prompt, plus survey_year.
# For each canonical name, we list variants that may appear in older years.
# The first match found is used and renamed to the canonical name.

COLUMN_RENAMES: dict[str, list[str]] = {
    # Demographics
    "_STATE": [],
    "SEXVAR": ["SEX", "SEX1"],
    "_SEX": [],
    "_AGEG5YR": [],
    "_AGE80": [],
    "_AGE_G": [],
    "_IMPRACE": [],
    "_RACEGR3": [],
    "EDUCA": [],
    "_EDUCAG": [],
    "INCOME3": [],  # 2023 only (11 categories) — older years have INCOME2
    "INCOME2": [],  # 2014-2020 only (8 categories)
    "_INCOMG1": [],  # 2023 only (7 groups)
    "_INCOMG": [],   # 2014-2020 only (5 groups)
    "MARITAL": [],
    "EMPLOY1": [],
    "VETERAN3": [],
    "CHILDREN": [],

    # General Health
    "GENHLTH": [],
    "PHYSHLTH": [],
    "MENTHLTH": [],
    "POORHLTH": [],
    "_RFHLTH": [],
    "_PHYS14D": [],
    "_MENT14D": [],

    # Chronic Conditions
    "BPHIGH6": ["BPHIGH4"],
    "CVDINFR4": [],
    "CVDCRHD4": [],
    "CVDSTRK3": [],
    "ASTHMA3": [],
    "ASTHNOW": [],
    "DIABETE4": ["DIABETE3"],
    "CHCCOPD3": [],
    "ADDEPEV3": [],
    "CHCKDNY2": [],
    "HAVARTH4": ["HAVARTH3"],
    "CHCSCNC1": ["CHCSCNCR"],
    "CHCOCNC1": ["CHCOCNCR"],
    "_MICHD": [],

    # Health Care Access
    "PRIMINS1": [],  # 2023 only
    "PERSDOC3": ["PERSDOC2"],
    "MEDCOST1": ["MEDCOST"],
    "CHECKUP1": [],
    "_HLTHPL1": [],
    "_HCVU653": ["_HCVU652", "_HCVU651"],

    # Behavioral Risk Factors
    "EXERANY2": [],
    "_TOTINDA": [],
    "SMOKE100": [],
    "_SMOKER3": [],
    "_CURECI2": [],  # e-cigarette — 2023+ only
    "ALCDAY4": ["ALCDAY5"],
    "_RFBING6": ["_RFBING5"],
    "_RFDRHV8": ["_RFDRHV7", "_RFDRHV6", "_RFDRHV5"],
    "_DRNKWK2": ["_DRNKWK1", "_DRNKWEK"],

    # BMI
    "_BMI5": [],
    "_BMI5CAT": [],
    "_RFBMI5": [],

    # Preventive Care
    "FLUSHOT7": ["FLUSHOT6"],
    "PNEUVAC4": [],
    "HIVTST7": ["HIVTST6"],
    "_FLSHOT7": ["_FLSHOT6"],

    # Disability
    "DEAF": [],
    "BLIND": [],
    "DECIDE": [],
    "DIFFWALK": [],
    "DIFFDRES": [],
    "DIFFALON": [],

    # Seatbelt
    "SEATBELT": [],

    # Survey Design
    "_LLCPWT": [],
    "_STSTR": [],
    "_PSU": [],
}

# All canonical column names we want in the output
CANONICAL_COLS = list(COLUMN_RENAMES.keys())


def download_xpt(year: int) -> Path:
    """Download a BRFSS XPT ZIP from CDC and extract the XPT file."""
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    xpt_path = DOWNLOAD_DIR / f"LLCP{year}.XPT"

    if xpt_path.exists():
        print(f"  [cached] {xpt_path}")
        return xpt_path

    url = get_cdc_url(year)
    zip_path = DOWNLOAD_DIR / f"LLCP{year}XPT.zip"

    print(f"  Downloading {url} ...")
    urlretrieve(url, zip_path)

    print(f"  Extracting ...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        # Find the XPT file inside (name varies, may have trailing spaces)
        xpt_names = [n for n in zf.namelist() if n.strip().upper().endswith(".XPT")]
        if not xpt_names:
            raise ValueError(f"No XPT file found in {zip_path}")
        # Extract to our standard name
        with zf.open(xpt_names[0]) as src, open(xpt_path, "wb") as dst:
            dst.write(src.read())

    # Clean up zip
    zip_path.unlink()
    print(f"  Extracted {xpt_path} ({xpt_path.stat().st_size / 1e6:.1f} MB)")
    return xpt_path


def load_year(year: int) -> pd.DataFrame:
    """Load one year of BRFSS data and harmonize columns."""
    print(f"\n{'='*60}")
    print(f"Processing {year}")
    print(f"{'='*60}")

    if year == 2023:
        df = pd.read_parquet(BRFSS_2023_PATH)
        print(f"  Loaded 2023 from parquet: {len(df):,} rows, {len(df.columns)} columns")
    else:
        xpt_path = download_xpt(year)
        df, meta = pyreadstat.read_xport(str(xpt_path), encoding="latin1")
        print(f"  Loaded {year} from XPT: {len(df):,} rows, {len(df.columns)} columns")

    # Uppercase all column names for consistent matching
    df.columns = [c.upper() for c in df.columns]
    available = set(df.columns)

    # Build the harmonized dataframe
    result = {}
    found = []
    missing = []

    for canonical, variants in COLUMN_RENAMES.items():
        canon_upper = canonical.upper()

        # Try canonical name first, then variants
        candidates = [canon_upper] + [v.upper() for v in variants]
        matched = False

        for candidate in candidates:
            if candidate in available:
                result[canonical] = df[candidate]
                if candidate != canon_upper:
                    found.append(f"  {canonical} <- {candidate}")
                matched = True
                break

        if not matched:
            result[canonical] = pd.Series([None] * len(df), dtype="float64")
            missing.append(canonical)

    if found:
        print(f"  Renamed columns:")
        for f in found:
            print(f"    {f}")

    if missing:
        print(f"  Missing columns (filled NULL): {', '.join(missing)}")

    out = pd.DataFrame(result)
    out["survey_year"] = year
    print(f"  Output: {len(out):,} rows, {len(out.columns)} columns")
    return out


def main():
    print("BRFSS Multi-Year Harmonization (2014-2020, 2023)")
    print("=" * 60)

    frames = []
    for year in YEARS:
        df = load_year(year)
        frames.append(df)

    print(f"\n{'='*60}")
    print("Concatenating all years...")
    combined = pd.concat(frames, ignore_index=True)
    print(f"Total: {len(combined):,} rows, {len(combined.columns)} columns")

    # Row counts per year
    print("\nRow counts by year:")
    for year in YEARS:
        count = (combined["survey_year"] == year).sum()
        print(f"  {year}: {count:,}")

    # Write to parquet
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"\nWriting to {OUTPUT_PATH} ...")
    combined.to_parquet(OUTPUT_PATH, engine="pyarrow", compression="snappy", index=False)

    size_mb = OUTPUT_PATH.stat().st_size / 1e6
    print(f"Done! File size: {size_mb:.1f} MB")

    if size_mb > 200:
        print("WARNING: File exceeds 200MB target!")
    else:
        print("File size is within target (<200MB).")


if __name__ == "__main__":
    main()
