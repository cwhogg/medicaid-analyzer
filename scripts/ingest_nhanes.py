"""
Download NHANES 2021-2023 cycle data and convert to Parquet.

Downloads ~20 SAS Transport (.XPT) files from CDC, merges on SEQN
(respondent sequence number), and outputs a single Parquet file.

Usage:
    source .venv/bin/activate
    python scripts/ingest_nhanes.py
"""

import os
import pandas as pd

BASE_URL = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles"

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "nhanes_2021_2023.parquet")

# Each tuple: (filename, short description)
XPT_FILES = [
    ("DEMO_L.xpt", "Demographics"),
    ("BMX_L.xpt", "Body Measures"),
    ("BPXO_L.xpt", "Blood Pressure"),
    ("GHB_L.xpt", "Glycohemoglobin (HbA1c)"),
    ("GLU_L.xpt", "Fasting Glucose & Insulin"),
    ("TCHOL_L.xpt", "Total Cholesterol"),
    ("HDL_L.xpt", "HDL Cholesterol"),
    ("TRIGLY_L.xpt", "Triglycerides & LDL"),
    ("BIOPRO_L.xpt", "Standard Biochemistry (kidney, liver, electrolytes)"),
    ("CBC_L.xpt", "Complete Blood Count"),
    ("HSCRP_L.xpt", "High-Sensitivity C-Reactive Protein"),
    ("DIQ_L.xpt", "Diabetes Questionnaire"),
    ("BPQ_L.xpt", "Blood Pressure & Cholesterol Questionnaire"),
    ("MCQ_L.xpt", "Medical Conditions"),
    ("DPQ_L.xpt", "Depression Screener (PHQ-9)"),
    ("SMQ_L.xpt", "Smoking"),
    ("ALQ_L.xpt", "Alcohol Use"),
    ("PAQ_L.xpt", "Physical Activity"),
    ("HIQ_L.xpt", "Health Insurance"),
    ("SLQ_L.xpt", "Sleep Disorders"),
]

# Columns to keep from each file (None = keep all)
# We curate to ~100 most useful columns
COLUMNS_TO_KEEP = {
    "DEMO_L.xpt": [
        "SEQN",
        "RIAGENDR",   # Gender (1=Male, 2=Female)
        "RIDAGEYR",   # Age in years at screening
        "RIDRETH3",   # Race/Hispanic origin with NH Asian
        "DMDEDUC2",   # Education level (adults 20+)
        "DMDMARTZ",   # Marital status
        "INDFMPIR",   # Ratio of family income to poverty
        "WTINT2YR",   # Interview weight (2021-2023 cycle name)
        "WTMEC2YR",   # MEC exam weight (2021-2023 cycle name)
        "SDMVSTRA",   # Masked variance stratum
        "SDMVPSU",    # Masked variance PSU
    ],
    "BMX_L.xpt": [
        "SEQN",
        "BMXWT",      # Weight (kg)
        "BMXHT",      # Standing height (cm)
        "BMXBMI",     # Body mass index
        "BMXWAIST",   # Waist circumference (cm)
    ],
    "BPXO_L.xpt": [
        "SEQN",
        "BPXOSY1",    # Systolic BP reading 1
        "BPXODI1",    # Diastolic BP reading 1
        "BPXOSY2",    # Systolic BP reading 2
        "BPXODI2",    # Diastolic BP reading 2
        "BPXOSY3",    # Systolic BP reading 3
        "BPXODI3",    # Diastolic BP reading 3
    ],
    "GHB_L.xpt": [
        "SEQN",
        "LBXGH",      # Glycohemoglobin HbA1c (%)
    ],
    "GLU_L.xpt": [
        "SEQN",
        "LBXGLU",     # Fasting glucose (mg/dL)
    ],
    "TCHOL_L.xpt": [
        "SEQN",
        "LBXTC",      # Total cholesterol (mg/dL)
    ],
    "HDL_L.xpt": [
        "SEQN",
        "LBDHDD",     # Direct HDL-cholesterol (mg/dL)
    ],
    "TRIGLY_L.xpt": [
        "SEQN",
        "LBXTLG",     # Triglycerides (mg/dL) — 2021-2023 cycle name
        "LBDLDL",     # LDL-cholesterol (mg/dL, calculated)
    ],
    "BIOPRO_L.xpt": [
        "SEQN",
        "LBXSCR",     # Creatinine (mg/dL)
        "LBXSBU",     # Blood urea nitrogen (mg/dL)
        "LBXSUA",     # Uric acid (mg/dL)
        "LBXSATSI",   # ALT (U/L)
        "LBXSASSI",   # AST (U/L)
        "LBXSAPSI",   # Alkaline phosphatase (U/L)
        "LBXSGB",     # Globulin (g/dL)
        "LBXSTP",     # Total protein (g/dL)
        "LBXSAL",     # Albumin (g/dL)
        "LBXSTB",     # Total bilirubin (mg/dL)
        "LBXSGL",     # Glucose, serum (mg/dL) — non-fasting
        "LBXSCA",     # Total calcium (mg/dL)
        "LBXSNASI",   # Sodium (mmol/L)
        "LBXSKSI",    # Potassium (mmol/L)
        "LBXSC3SI",   # Bicarbonate (mmol/L)
        "LBXSCLSI",   # Chloride (mmol/L)
        "LBXSPH",     # Phosphorus (mg/dL)
        "LBXSCH",     # Cholesterol, serum (mg/dL)
    ],
    "CBC_L.xpt": [
        "SEQN",
        "LBXWBCSI",   # White blood cell count (1000 cells/uL)
        "LBXRBCSI",   # Red blood cell count (million cells/uL)
        "LBXHGB",     # Hemoglobin (g/dL)
        "LBXHCT",     # Hematocrit (%)
        "LBXMCVSI",   # Mean cell volume (fL)
        "LBXPLTSI",   # Platelet count (1000 cells/uL)
    ],
    "HSCRP_L.xpt": [
        "SEQN",
        "LBXHSCRP",   # hs-CRP (mg/L)
    ],
    "DIQ_L.xpt": [
        "SEQN",
        "DIQ010",     # Doctor told you have diabetes
        "DIQ050",     # Taking insulin now
        "DIQ070",     # Taking oral diabetes medication
    ],
    "BPQ_L.xpt": [
        "SEQN",
        "BPQ020",     # Ever told high blood pressure
        "BPQ030",     # Told more than once high BP
        "BPQ080",     # Ever told high cholesterol
    ],
    "MCQ_L.xpt": [
        "SEQN",
        "MCQ010",     # Ever told asthma
        "MCQ035",     # Still have asthma
        "MCQ160B",    # Ever told congestive heart failure
        "MCQ160C",    # Ever told coronary heart disease
        "MCQ160D",    # Ever told angina/angina pectoris
        "MCQ160E",    # Ever told heart attack
        "MCQ160F",    # Ever told stroke
        "MCQ220",     # Ever told cancer/malignancy
        "MCQ160L",    # Ever told liver condition
    ],
    "DPQ_L.xpt": [
        "SEQN",
        "DPQ010",     # Little interest in doing things
        "DPQ020",     # Feeling down/depressed/hopeless
        "DPQ030",     # Trouble sleeping
        "DPQ040",     # Feeling tired/little energy
        "DPQ050",     # Poor appetite or overeating
        "DPQ060",     # Feeling bad about yourself
        "DPQ070",     # Trouble concentrating
        "DPQ080",     # Moving/speaking slowly or fidgety
        "DPQ090",     # Thoughts of self-harm
    ],
    "SMQ_L.xpt": [
        "SEQN",
        "SMQ020",     # Smoked at least 100 cigarettes in life
        "SMQ040",     # Do you now smoke cigarettes
    ],
    "ALQ_L.xpt": [
        "SEQN",
        "ALQ111",     # Ever had a drink of alcohol
        "ALQ121",     # Past 12 mo: how often drank
        "ALQ142",     # Past 12 mo: # drinks on drinking days
        "ALQ270",     # Past 12 mo: binge drinking frequency
    ],
    "PAQ_L.xpt": [
        "SEQN",
        "PAD680",     # Sedentary activity (minutes/day)
    ],
    "HIQ_L.xpt": [
        "SEQN",
        "HIQ011",     # Covered by health insurance
        "HIQ032A",    # Covered by private insurance
        "HIQ032B",    # Covered by Medicare
        "HIQ032C",    # Covered by Medi-Gap
        "HIQ032D",    # Covered by Medicaid
        "HIQ032E",    # Covered by SCHIP
        "HIQ032H",    # Covered by military health care
        "HIQ032I",    # Covered by Indian Health Service
    ],
    "SLQ_L.xpt": [
        "SEQN",
        "SLD012",     # Sleep hours — weekdays/workdays
        "SLD013",     # Sleep hours — weekends
        "SLQ050",     # Ever told doctor had sleep disorder
    ],
}


def download_xpt(filename: str) -> pd.DataFrame:
    """Download a single XPT file from CDC."""
    url = f"{BASE_URL}/{filename}"
    print(f"  Downloading {filename}...")
    try:
        df = pd.read_sas(url, format="xport")
    except Exception:
        # Some pandas versions need the file locally
        import urllib.request
        import tempfile
        tmp = os.path.join(tempfile.gettempdir(), filename)
        urllib.request.urlretrieve(url, tmp)
        df = pd.read_sas(tmp, format="xport")
        os.remove(tmp)
    print(f"    → {len(df):,} rows, {len(df.columns)} columns")
    return df


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Step 1: Download demographics as the spine
    print("Downloading NHANES 2021-2023 data files...\n")
    demo_file, demo_desc = XPT_FILES[0]
    print(f"[1/{len(XPT_FILES)}] {demo_desc}")
    merged = download_xpt(demo_file)

    # Keep only selected columns from demo
    demo_cols = COLUMNS_TO_KEEP.get(demo_file)
    if demo_cols:
        available = [c for c in demo_cols if c in merged.columns]
        merged = merged[available]

    # Step 2: Download and merge each component file
    for i, (filename, desc) in enumerate(XPT_FILES[1:], start=2):
        print(f"\n[{i}/{len(XPT_FILES)}] {desc}")
        try:
            df = download_xpt(filename)

            # Keep only selected columns
            keep_cols = COLUMNS_TO_KEEP.get(filename)
            if keep_cols:
                available = [c for c in keep_cols if c in df.columns]
                df = df[available]

            # Merge on SEQN
            merged = merged.merge(df, on="SEQN", how="left")
            print(f"    → Merged: {len(merged):,} rows, {len(merged.columns)} columns")
        except Exception as e:
            print(f"    !! FAILED: {e}")
            print(f"    Skipping {filename}")
            continue

    # Step 3: Add survey cycle column
    merged["survey_cycle"] = "2021-2023"

    # Step 4: Cast SEQN to integer (it comes as float from SAS)
    merged["SEQN"] = merged["SEQN"].astype(int)

    # Step 5: Write to Parquet
    print(f"\nWriting to {OUTPUT_FILE}...")
    merged.to_parquet(OUTPUT_FILE, compression="snappy", index=False)

    # Step 6: Verify
    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\nDone!")
    print(f"  Rows: {len(merged):,}")
    print(f"  Columns: {len(merged.columns)}")
    print(f"  Size: {size_mb:.1f} MB")
    print(f"\nColumn list:")
    for col in merged.columns:
        dtype = merged[col].dtype
        nulls = merged[col].isna().sum()
        null_pct = nulls / len(merged) * 100
        print(f"  {col:25s} {str(dtype):15s} {null_pct:5.1f}% null")


if __name__ == "__main__":
    main()
