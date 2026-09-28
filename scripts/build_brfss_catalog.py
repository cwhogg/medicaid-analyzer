"""
build_brfss_catalog.py — Write data/brfss_variables.json: for every column in
data/brfss_harmonized.parquet, its CDC label (from the XPT metadata) and the
survey years in which it has any non-NULL values.

Run after build_brfss_full.py (needs the XPTs in data/brfss_xpt/).
"""

import json
from pathlib import Path

import duckdb
import pyreadstat

XPT_DIR = Path("data/brfss_xpt")
PARQUET = "data/brfss_harmonized.parquet"
OUT = Path("data/brfss_variables.json")


def main():
    labels: dict[str, str] = {}
    for xpt in sorted(XPT_DIR.glob("LLCP*.XPT"), reverse=True):  # newest label wins
        _, meta = pyreadstat.read_xport(str(xpt), metadataonly=True, encoding="latin1")
        for k, v in meta.column_names_to_labels.items():
            labels.setdefault(k.upper(), v)

    con = duckdb.connect()
    cols = [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM '{PARQUET}'").fetchall()]
    exprs = ", ".join(f'list(DISTINCT survey_year ORDER BY survey_year) FILTER (WHERE "{c}" IS NOT NULL)' for c in cols)
    years = con.execute(f"SELECT {exprs} FROM '{PARQUET}'").fetchone()

    catalog = {c: {"label": labels.get(c.upper()), "years": y or []} for c, y in zip(cols, years)}
    OUT.write_text(json.dumps(catalog, indent=1))
    unlabeled = [c for c, v in catalog.items() if not v["label"]]
    print(f"{len(catalog)} columns -> {OUT} ({len(unlabeled)} without a CDC label)")


if __name__ == "__main__":
    main()
