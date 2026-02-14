#!/usr/bin/env python3
"""
One-time script: Clean up abbreviated HCPCS descriptions using Claude Sonnet.
Reads hcpcs_lookup.parquet, sends batches to the API, writes cleaned descriptions back.
Only processes codes that appear in the spending data (hcpcs_summary).
"""

import json
import os
import sys
import time
import duckdb
import httpx

# --- Config ---
BATCH_SIZE = 100
MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096
PARQUET_LOOKUP = "web/public/data/hcpcs_lookup.parquet"
PARQUET_SUMMARY = "web/public/data/hcpcs_summary.parquet"
OUTPUT_PARQUET = "web/public/data/hcpcs_lookup.parquet"
CHECKPOINT_FILE = "scripts/.hcpcs_clean_checkpoint.json"

# Load API key
env_path = os.path.join(os.path.dirname(__file__), "..", "web", ".env.local")
api_key = None
with open(env_path) as f:
    for line in f:
        if line.startswith("ANTHROPIC_API_KEY="):
            api_key = line.strip().split("=", 1)[1].strip('"').strip("'")
            break

if not api_key:
    print("ERROR: ANTHROPIC_API_KEY not found in .env.local")
    sys.exit(1)

# --- Load codes ---
con = duckdb.connect()

# Get all lookup codes that appear in spending data
rows = con.execute(f"""
    SELECT l.hcpcs_code, l.description
    FROM read_parquet('{PARQUET_LOOKUP}') l
    SEMI JOIN read_parquet('{PARQUET_SUMMARY}') h ON l.hcpcs_code = h.hcpcs_code
    ORDER BY l.hcpcs_code
""").fetchall()

# Also get codes NOT in spending data (we'll keep their descriptions as-is)
unused_rows = con.execute(f"""
    SELECT l.hcpcs_code, l.description
    FROM read_parquet('{PARQUET_LOOKUP}') l
    ANTI JOIN read_parquet('{PARQUET_SUMMARY}') h ON l.hcpcs_code = h.hcpcs_code
    ORDER BY l.hcpcs_code
""").fetchall()

print(f"Codes to clean: {len(rows)}")
print(f"Codes to keep as-is (not in spending data): {len(unused_rows)}")

# --- Load checkpoint if exists ---
cleaned = {}
if os.path.exists(CHECKPOINT_FILE):
    with open(CHECKPOINT_FILE) as f:
        cleaned = json.load(f)
    print(f"Loaded checkpoint: {len(cleaned)} codes already cleaned")

# --- Build batches ---
to_process = [(code, desc) for code, desc in rows if code not in cleaned]
batches = [to_process[i:i + BATCH_SIZE] for i in range(0, len(to_process), BATCH_SIZE)]
print(f"Remaining: {len(to_process)} codes in {len(batches)} batches")

# --- API client ---
client = httpx.Client(
    base_url="https://api.anthropic.com",
    headers={
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    },
    timeout=60.0,
)

SYSTEM_PROMPT = """You are a medical coding expert. You will receive a list of HCPCS/CPT codes with their abbreviated CMS descriptions. Your job is to expand each description into a clear, readable name.

Rules:
- Expand ALL abbreviations (e.g., "mgmt" → "Management", "tx" → "Treatment", "mntr" → "Monitoring", "eval" → "Evaluation", "dx" → "Diagnosis", "hx" → "History", "inj" → "Injection", "surg" → "Surgery", "proc" → "Procedure", "addl" → "Additional", "ea" → "Each", "w/" → "with", "w/o" → "without", "1st" → "First", "subq" → "Subcutaneous", "pt" → "Patient", "physiol" → "Physiological", "param" → "Parameters", "chrnc" → "Chronic", "optx" → "Open Treatment", "rpm" → "Remote Patient Monitoring", "rem" → "Remote", "prsmv" → "Presumptive", "obs" → "Observation")
- Use Title Case for all descriptions
- Keep drug names, brand names, and manufacturer names in their standard casing
- Keep numeric values (minutes, sizes, dosages) as-is
- If the abbreviated description is ambiguous, use the HCPCS code to determine the correct meaning
- Do NOT add information that isn't implied by the original description
- Keep descriptions concise but readable (aim for 3-10 words)
- For injection/drug codes (J-codes), keep the format "Injection, [Drug Name] [dose]"

Respond with ONLY a JSON object mapping each HCPCS code to its cleaned description. No other text."""

def process_batch(batch, batch_num, total_batches):
    """Send a batch of codes to Claude and return cleaned descriptions."""
    codes_text = "\n".join(f"{code}: {desc}" for code, desc in batch)

    payload = {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "temperature": 0,
        "system": SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": f"Clean up these {len(batch)} HCPCS descriptions:\n\n{codes_text}"}
        ],
    }

    for attempt in range(3):
        try:
            resp = client.post("/v1/messages", json=payload)
            if resp.status_code == 429:
                wait = int(resp.headers.get("retry-after", 30))
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()
            text = data["content"][0]["text"]
            # Parse JSON from response (handle markdown code blocks)
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            result = json.loads(text)
            return result
        except (httpx.HTTPStatusError, json.JSONDecodeError, KeyError) as e:
            print(f"  Attempt {attempt+1} failed: {e}")
            if attempt < 2:
                time.sleep(5)
            else:
                raise
    return {}

# --- Process batches ---
start_time = time.time()
for i, batch in enumerate(batches):
    batch_num = i + 1
    print(f"Batch {batch_num}/{len(batches)} ({len(batch)} codes)...", end=" ", flush=True)

    result = process_batch(batch, batch_num, len(batches))
    cleaned.update(result)

    # Checkpoint every batch
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(cleaned, f)

    elapsed = time.time() - start_time
    rate = (i + 1) / elapsed * 60 if elapsed > 0 else 0
    remaining = (len(batches) - i - 1) / rate * 60 if rate > 0 else 0
    print(f"done ({len(result)} cleaned, {rate:.1f} batches/min, ~{remaining:.0f}s remaining)")

    # Small delay to avoid rate limits
    if i < len(batches) - 1:
        time.sleep(1)

print(f"\nTotal cleaned: {len(cleaned)} codes in {time.time() - start_time:.0f}s")

# --- Show samples ---
print("\nSample transformations:")
sample_codes = ["99490", "99457", "99454", "99458", "99213", "J2785", "A0392", "80305"]
for code in sample_codes:
    if code in cleaned:
        orig = dict(rows).get(code, "?")
        print(f"  {code}: {orig}  →  {cleaned[code]}")

# --- Write output ---
# Merge: cleaned descriptions for used codes, original descriptions for unused codes
all_records = []

# Used codes: prefer cleaned, fall back to original
for code, orig_desc in rows:
    desc = cleaned.get(code, orig_desc)
    all_records.append((code, desc))

# Unused codes: keep original
for code, desc in unused_rows:
    all_records.append((code, desc))

print(f"\nWriting {len(all_records)} codes to {OUTPUT_PARQUET}...")
con.execute(f"""
    COPY (
        SELECT column0 AS hcpcs_code, column1 AS description
        FROM VALUES {', '.join(f"('{code}', '{desc.replace(chr(39), chr(39)+chr(39))}')" for code, desc in all_records)}
        ORDER BY column0
    ) TO '{OUTPUT_PARQUET}' (FORMAT PARQUET, COMPRESSION SNAPPY)
""")

print("Done! Parquet written.")

# Clean up checkpoint
if os.path.exists(CHECKPOINT_FILE):
    os.remove(CHECKPOINT_FILE)
    print("Checkpoint removed.")

client.close()
