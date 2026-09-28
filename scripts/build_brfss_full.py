"""
build_brfss_full.py — Build brfss_harmonized.parquet with EVERY BRFSS column.

Keeps the harmonized canonical columns from harmonize_brfss.py exactly as
before (same names, order, and rename logic), then appends every other raw
column from each year's CDC file under its original name. Columns absent in
a given year are NULL for that year's rows.

Also fixes the SAS XPT "tiny zero" artifact (values like 5.4e-79 that should
be exactly 0).

Usage:
    source .venv/bin/activate
    python scripts/build_brfss_full.py
"""

import sys
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
import pyreadstat

sys.path.insert(0, str(Path(__file__).parent))
from harmonize_brfss import BRFSS_2023_PATH, COLUMN_RENAMES, YEARS, download_xpt  # noqa: E402

YEAR_DIR = Path("data/brfss_full")
OUTPUT_PATH = Path("data/brfss_harmonized.parquet")
CANONICAL = list(COLUMN_RENAMES.keys())


def fix_tiny_zeros(df: pd.DataFrame) -> int:
    fixed = 0
    for col in df.columns:
        if pd.api.types.is_float_dtype(df[col]):
            mask = df[col].abs() < 1e-70
            mask &= df[col] != 0
            n = int(mask.sum())
            if n:
                df.loc[mask, col] = 0.0
                fixed += n
    return fixed


def build_year(year: int) -> Path:
    out = YEAR_DIR / f"brfss_{year}.parquet"
    if out.exists():
        print(f"{year}: already built, skipping")
        return out

    if year == 2023:
        raw = pd.read_parquet(BRFSS_2023_PATH)
    else:
        xpt = download_xpt(year)
        raw, _ = pyreadstat.read_xport(str(xpt), encoding="latin1")
    raw.columns = [c.upper() for c in raw.columns]
    available = set(raw.columns)

    result: dict[str, pd.Series] = {}
    consumed: set[str] = set()
    for canonical, variants in COLUMN_RENAMES.items():
        for cand in [canonical.upper()] + [v.upper() for v in variants]:
            if cand in available:
                result[canonical] = raw[cand]
                consumed.add(cand)
                break
        else:
            result[canonical] = pd.Series([None] * len(raw), dtype="float64")

    canon_upper = {c.upper() for c in CANONICAL}
    extras = sorted(c for c in raw.columns if c not in consumed and c not in canon_upper)
    for c in extras:
        result[c] = raw[c]

    df = pd.DataFrame(result)
    df.insert(len(CANONICAL), "survey_year", year)
    fixed = fix_tiny_zeros(df)

    YEAR_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, engine="pyarrow", compression="snappy", index=False)
    print(f"{year}: {len(df):,} rows, {len(CANONICAL)} canonical + {len(extras)} extra cols, "
          f"{fixed:,} tiny-zeros fixed -> {out} ({out.stat().st_size/1e6:.0f} MB)")
    return out


def main():
    paths = [build_year(y) for y in YEARS]

    con = duckdb.connect()
    files = ", ".join(f"'{p}'" for p in paths)
    src = f"read_parquet([{files}], union_by_name=true)"
    all_cols = [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM {src}").fetchall()]
    head = CANONICAL + ["survey_year"]
    extras = sorted(c for c in all_cols if c not in head)
    select = ", ".join(f'"{c}"' for c in head + extras)

    print(f"\nCombining {len(paths)} years: {len(head)} harmonized + {len(extras)} extra columns...")
    con.execute(
        f"COPY (SELECT {select} FROM {src} ORDER BY survey_year) "
        f"TO '{OUTPUT_PATH}' (FORMAT PARQUET, COMPRESSION SNAPPY)"
    )
    n = con.execute(f"SELECT COUNT(*) FROM '{OUTPUT_PATH}'").fetchone()[0]
    print(f"Done: {n:,} rows, {len(head) + len(extras)} columns, "
          f"{OUTPUT_PATH.stat().st_size/1e6:.0f} MB -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
