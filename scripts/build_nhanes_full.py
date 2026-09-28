"""
build_nhanes_full.py — Build nhanes_2021_2023.parquet with EVERY NHANES
2021-2023 variable from every one-row-per-participant data file.

The original 94 columns from ingest_nhanes.py come first, in the same order
and with the same names, then every other variable from every file. Files
with multiple rows per participant (individual foods, prescriptions, ...)
are skipped and listed. Also writes nhanes_variables.json with each
variable's CDC label and source file.

Fixes the SAS XPT "tiny zero" artifact (5.4e-79 instead of 0) that
pandas.read_sas introduced in the original build.

Usage:
    source .venv/bin/activate
    python scripts/build_nhanes_full.py
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

import pandas as pd
import pyreadstat

sys.path.insert(0, str(Path(__file__).parent))
from ingest_nhanes import COLUMNS_TO_KEEP, XPT_FILES  # noqa: E402

CDC = "https://wwwn.cdc.gov"
COMPONENTS = ["Demographics", "Dietary", "Examination", "Laboratory", "Questionnaire"]
XPT_DIR = Path("data/nhanes_xpt")
OUTPUT_PATH = Path("data/nhanes_2021_2023.parquet")
CATALOG_PATH = Path("data/nhanes_variables.json")


def list_files() -> list[tuple[str, str]]:
    files = []
    for comp in COMPONENTS:
        url = f"{CDC}/nchs/nhanes/search/datapage.aspx?Component={comp}&Cycle=2021-2023"
        html = urllib.request.urlopen(url, timeout=60).read().decode("utf-8", "ignore")
        for path in sorted(set(re.findall(r'href="(/Nchs/Data/Nhanes/Public/2021/DataFiles/[^"]+\.xpt)"', html, re.I))):
            files.append((comp, path))
    return files


def fetch(path: str) -> Path:
    XPT_DIR.mkdir(parents=True, exist_ok=True)
    local = XPT_DIR / Path(path).name
    if not local.exists():
        urllib.request.urlretrieve(CDC + path, local)
    return local


def main():
    files = list_files()
    print(f"Found {len(files)} data files for 2021-2023")

    frames: dict[str, pd.DataFrame] = {}
    catalog: dict[str, dict] = {}
    skipped: list[str] = []

    for comp, path in files:
        name = Path(path).name
        local = fetch(path)
        df, meta = pyreadstat.read_xport(str(local), encoding="latin1")
        df.columns = [c.upper() for c in df.columns]
        labels = {k.upper(): v for k, v in meta.column_names_to_labels.items()}
        if "SEQN" not in df.columns:
            skipped.append(f"{name} (no SEQN)")
            continue
        if df["SEQN"].duplicated().any():
            skipped.append(f"{name} (multiple rows per participant: {len(df):,} rows)")
            continue
        frames[name.upper()] = df
        for c in df.columns:
            if c != "SEQN" and c not in catalog:
                catalog[c] = {"label": labels.get(c), "file": name, "component": comp}
        print(f"  {name:16s} {len(df):>6,} rows {len(df.columns) - 1:>4} vars  [{comp}]")

    # Original column order first (identical to ingest_nhanes.py output)
    original: list[str] = []
    for fname, _ in XPT_FILES:
        for c in COLUMNS_TO_KEEP[fname]:
            if c not in original:
                original.append(c)

    merged = frames.pop("DEMO_L.XPT")
    seen = set(merged.columns)
    dropped_dupes: list[str] = []
    order = ["DEMO_L.XPT"] + [f.upper() for f, _ in XPT_FILES[1:]]
    order += sorted(k for k in frames if k not in order)
    for key in order:
        if key not in frames:
            continue
        df = frames[key]
        dupes = [c for c in df.columns if c != "SEQN" and c in seen]
        dropped_dupes += [f"{c} ({key})" for c in dupes]
        df = df.drop(columns=dupes)
        seen |= set(df.columns)
        merged = merged.merge(df, on="SEQN", how="left")

    merged["survey_cycle"] = "2021-2023"
    merged["SEQN"] = merged["SEQN"].astype(int)

    fixed = 0
    for c in merged.columns:
        if pd.api.types.is_float_dtype(merged[c]):
            mask = (merged[c].abs() < 1e-70) & (merged[c] != 0)
            fixed += int(mask.sum())
            merged.loc[mask, c] = 0.0

    original = [c for c in original if c in merged.columns]  # same filtering as ingest_nhanes.py
    extras = [c for c in merged.columns if c not in original and c != "survey_cycle"]
    merged = merged[original + ["survey_cycle"] + extras]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    merged.to_parquet(OUTPUT_PATH, compression="snappy", index=False)
    CATALOG_PATH.write_text(json.dumps(catalog, indent=1))

    print(f"\nDone: {len(merged):,} rows, {len(merged.columns)} columns "
          f"({len(original) + 1} original + {len(extras)} new), "
          f"{OUTPUT_PATH.stat().st_size/1e6:.1f} MB")
    print(f"Tiny-zero values fixed: {fixed:,}")
    print(f"Skipped files: {skipped}")
    print(f"Duplicate columns dropped (kept first occurrence): {dropped_dupes}")


if __name__ == "__main__":
    main()
