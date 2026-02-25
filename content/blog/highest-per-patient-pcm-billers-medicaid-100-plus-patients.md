---
title: "Highest Per-Patient PCM Billers in Medicaid (100+ Patients)"
type: blog-post
targetKeywords: ["Medicaid Principal Care Management billing","PCM per patient spending Medicaid","high cost PCM providers Medicaid","Medicaid care management billing analysis","PCM procedure code Medicaid claims"]
contentGap: "Existing posts cover RPM trends, single-code billers, and top procedures by total spend, but none isolate per-patient intensity of billing for a specific chronic care management service like PCM. This post surfaces outlier providers who may be upcoding or delivering unusually intensive care by normalizing spend to the beneficiary level with a minimum patient volume threshold to filter out statistical noise."
date: "2026-02-25T01:11:10.633Z"
description: "Which Medicaid providers bill the most per patient for Principal Care Management? We rank providers with 100+ PCM patients by average spending per beneficiary."
ideaName: "Medicaid Claims Analyzer"
status: published
wordCount: 2049
canonicalUrl: "https://medicaid-analyzer.vercel.app/blog/highest-per-patient-pcm-billers-medicaid-100-plus-patients"
---

When the federal government expanded reimbursement for Principal Care Management (PCM) services in 2020, the intent was straightforward: pay clinicians to coordinate care for patients with a single high-risk chronic condition, reducing hospitalizations and improving outcomes. What the data reveals, however, is a billing landscape with striking variation — a small group of providers extracting dramatically more per patient than their peers, sometimes at a scale that demands closer scrutiny.

This analysis examines Medicaid PCM billing across procedure codes 99424, 99425, 99426, and 99427, focusing specifically on providers who billed for at least 100 distinct beneficiaries. That threshold matters: it filters out statistical noise from providers who may have billed PCM for a handful of patients and happened to receive high reimbursements by chance. What remains is a group of established PCM billers — and among them, a handful of outliers whose per-patient spending dwarfs the rest of the field.

## The Top 25: A Wide Spectrum of Per-Patient Intensity

Among all providers meeting the 100-patient threshold, the top 25 by average reimbursement per beneficiary reveal a striking range — from $209 per patient at the top to $46 at the bottom of this list.

| Provider Name | Type | City, State | Total Spend | Total Claims | Total Beneficiaries | Avg Reimbursement/Beneficiary |
|---|---|---|---|---|---|---|
| Supports Coordination Group, LLC | Org | Lancaster, PA | $759,499 | 3,935 | 3,636 | $209 |
| Excelsior Integrated Medical Group, PLLC | Org | New York, NY | $9,218 | 107 | 107 | $86 |
| Total Health Care Network Inc | Org | Northridge, CA | $13,177 | 165 | 155 | $85 |
| Debra Balke | Individual | Templeton, CA | $114,642 | 1,427 | 1,373 | $83 |
| Trustees of Columbia University in the City of New York | Org | New York, NY | $41,991 | 586 | 560 | $75 |
| Greenhill Health Consulting LLC | Org | Wilmington, DE | $176,342 | 2,482 | 2,453 | $72 |
| Advanced Cardiovascular Specialists PC | Org | Bridgeport, CT | $652,926 | 10,366 | 9,237 | $71 |
| Mountain View Headache and Spine Institute PLLC | Org | Phoenix, AZ | $63,268 | 927 | 920 | $69 |
| Endocrine Associate of West Village PC | Org | Long Island City, NY | $117,051 | 1,797 | 1,750 | $67 |
| 3PRONG | Org | Fremont, CA | $71,455 | 1,073 | 1,073 | $67 |
| St. George Family Practice P.C | Org | Omaha, NE | $30,679 | 475 | 465 | $66 |
| MaineGeneral Medical Center | Org | Augusta, ME | $42,166 | 731 | 699 | $60 |
| Vantage Medical Associates PC | Org | Far Rockaway, NY | $16,991 | 292 | 292 | $58 |
| Ghassan A Atto MD PLLC | Org | Southgate, MI | $42,519 | 810 | 761 | $56 |
| SVMHS Clinics | Org | Salinas, CA | $28,970 | 549 | 549 | $53 |
| Insight Comprehensive Medical PC | Org | New York, NY | $27,892 | 559 | 559 | $50 |
| New Mexico Center for Pain and Wellness, LLC | Org | Albuquerque, NM | $135,747 | 2,762 | 2,749 | $49 |
| Valcee Medical Corporation | Org | Memphis, TN | $9,136 | 238 | 187 | $49 |
| Sunrise Cardiovascular PLLC | Org | Brooklyn, NY | $9,502 | 196 | 196 | $48 |
| Center for Orthopedic Research and Education, LLC | Org | Phoenix, AZ | $26,159 | 579 | 574 | $46 |

The first thing that jumps out is the sheer dominance of **Supports Coordination Group, LLC** in Lancaster, Pennsylvania. At $209 per beneficiary — more than double the second-ranked provider — and with $759,499 in total Medicaid spend across 3,636 beneficiaries, this organization is operating at a scale and intensity that sets it apart from every other provider on this list. Its claim count of 3,935 against 3,636 beneficiaries suggests a relatively tight ratio of claims to patients, but the per-patient dollar figure is extraordinary.

The second notable feature of this table is the geographic concentration. New York state alone accounts for five of the top 20 providers: Excelsior Integrated Medical Group, Columbia University, Endocrine Associate of West Village, Vantage Medical Associates, Insight Comprehensive Medical, and Sunrise Cardiovascular. This clustering may reflect New York's Medicaid managed care structure, its higher cost-of-living adjustments to reimbursement rates, or simply a more aggressive adoption of PCM billing infrastructure in the state's provider community.

### The Outlier Problem: Claims-to-Beneficiary Ratios

One useful diagnostic for PCM billing intensity is the ratio of total claims to total beneficiaries. PCM codes are time-based monthly services — a provider can legitimately bill multiple codes per patient per month depending on the complexity and time spent. But unusually high ratios can indicate either genuinely intensive care management or potential upcoding.

Advanced Cardiovascular Specialists PC in Bridgeport, Connecticut stands out here: 10,366 claims for 9,237 beneficiaries — a ratio of roughly 1.12 claims per beneficiary. Given that this is a cardiovascular specialist practice managing patients with serious cardiac conditions, multiple monthly PCM encounters per patient are clinically plausible. The New Mexico Center for Pain and Wellness shows a similar pattern: 2,762 claims for 2,749 beneficiaries.

Greenhill Health Consulting LLC in Wilmington, Delaware presents a slightly different picture: 2,482 claims for 2,453 beneficiaries, with $176,342 in total spend. The name "health consulting" rather than a clinical specialty designation is worth noting — PCM services are intended to be delivered by qualified clinical staff, and the nature of this organization's clinical operations is not discernible from billing data alone.

## Temporal Trends: Are High Billers Accelerating?

Perhaps more revealing than the static rankings is how these providers' per-patient billing intensity has evolved over time. The data covers activity from 2022 through mid-2024, and the trends are not uniform.

| Provider Name | State | Overall Avg/Bene | 2022 Spend/Bene | 2023 Spend/Bene | 2024 Spend/Bene |
|---|---|---|---|---|---|
| Supports Coordination Group, LLC | PA | $206 | $199 | $195 | $213 |
| Excelsior Integrated Medical Group, PLLC | NY | $86 | $86 | — | — |
| Total Health Care Network Inc | CA | $85 | — | $82 | $95 |
| Debra Balke | CA | $84 | — | $83 | $87 |
| Trustees of Columbia University | NY | $75 | $40 | $74 | $81 |
| Greenhill Health Consulting LLC | DE | $72 | — | $66 | $74 |
| Advanced Cardiovascular Specialists PC | CT | $68 | $39 | $66 | $84 |
| Mountain View Headache and Spine Institute PLLC | AZ | $69 | — | — | $69 |
| Endocrine Associate of West Village PC | NY | $67 | $73 | $67 | — |
| 3PRONG | CA | $67 | — | $67 | — |

*Note: Dashes indicate no billing activity recorded for that year in the dataset.*

### The Acceleration Pattern

The most striking trend in this table belongs to **Advanced Cardiovascular Specialists PC**. This Connecticut practice went from $39 per beneficiary in 2022 to $66 in 2023 to $84 in 2024 — a more than doubling of per-patient billing intensity in just two years. Over the same period, its annual beneficiary count grew from 1,673 to 3,422. This is not a small practice experimenting with PCM; it is a large-scale operation that has simultaneously expanded its patient base and dramatically increased how much it bills per patient.

**Columbia University's** trajectory tells a different story — one of a large institution gradually building out its PCM infrastructure. Starting with just 28 beneficiaries in 2022 at $40 per patient, it grew to 332 beneficiaries at $74 in 2023 and 200 beneficiaries at $81 in 2024. The ramp-up pattern here looks more consistent with an institutional program coming online than with aggressive billing optimization.

**Greenhill Health Consulting** in Delaware shows a similar ramp: no 2022 activity in the dataset, $66 per beneficiary in 2023 across 732 patients, then $74 per beneficiary in 2024 across 1,721 patients. The patient volume more than doubled year-over-year while per-patient spend also increased — a combination that drove total annual spend from roughly $48,564 to $127,778.

**Supports Coordination Group** in Pennsylvania, despite its commanding position at the top of the per-patient rankings, actually shows relatively stable billing intensity: $199 in 2022, $195 in 2023, and $213 in 2024. The growth in this practice's total spend is driven primarily by patient volume expansion rather than per-patient billing escalation — a distinction that matters when assessing billing behavior.

### Late Entrants and Single-Year Billers

Several providers in the top 10 appear in the dataset for only a single year. **Mountain View Headache and Spine Institute** in Phoenix has all 706 of its beneficiaries concentrated in 2024. **3PRONG** in Fremont, California billed all 1,073 of its beneficiaries in 2023 with no apparent activity before or after. **Excelsior Integrated Medical Group** in New York billed all 107 of its patients in 2022.

These single-year patterns are worth flagging. A provider that bills PCM intensively for one year and then disappears from the data — or one that appears suddenly with a large patient panel — warrants closer examination. PCM is designed as an ongoing care management service; patients with chronic conditions don't typically cycle through a single year of care coordination and then no longer require it.

## What the Data Can and Cannot Tell Us

It's important to be precise about the limits of this analysis. High per-patient reimbursement is not, by itself, evidence of fraud or abuse. PCM codes are legitimately tiered by time — a provider spending 60 minutes per month on care management for a complex patient will and should bill more than one spending 30 minutes. Providers managing patients with multiple comorbidities, or those in high-cost geographic markets, will naturally show higher per-patient figures.

What this data does is identify providers whose billing patterns diverge significantly from their peers — and in doing so, it generates questions that billing data alone cannot answer. Is Supports Coordination Group's $209 per-patient average a reflection of genuinely intensive care coordination for a complex Medicaid population in Lancaster, Pennsylvania? Is Advanced Cardiovascular Specialists' rapid per-patient billing escalation driven by sicker patients, more sophisticated billing infrastructure, or something else? These are questions for auditors, not data journalists — but the data is what surfaces them.

The geographic concentration in New York is also worth monitoring. Five of the top 20 providers are New York-based organizations, and New York has historically been a state with elevated Medicaid billing scrutiny. Whether that concentration reflects legitimate market factors or a billing culture that pushes the boundaries of PCM documentation requirements is a question the state's Medicaid program would be well-positioned to investigate.

## Key Takeaways

- **Supports Coordination Group, LLC** in Lancaster, PA is the highest per-patient PCM biller among providers with 100+ Medicaid beneficiaries, averaging $209 per patient across 3,636 beneficiaries and $759,499 in total spend — more than double the second-ranked provider.

- **Advanced Cardiovascular Specialists PC** in Bridgeport, CT shows the most dramatic billing escalation in the dataset, with per-patient spend rising from $39 in 2022 to $84 in 2024 while simultaneously more than doubling its patient volume to 9,237 total beneficiaries and $652,926 in total spend.

- **New York state** accounts for a disproportionate share of high per-patient PCM billers, with five organizations appearing in the top 20.

- Several top-10 providers appear in the dataset for only a single year, a pattern inconsistent with the ongoing nature of chronic care management services that PCM is designed to support.

- Most high-intensity billers show **increasing** per-patient spend over time, not stable or declining rates — suggesting that as providers become more experienced with PCM billing infrastructure, they tend to bill more aggressively per patient, not less.

- High per-patient reimbursement is not inherently problematic, but the combination of high per-patient rates, rapid volume growth, and billing escalation over time represents a risk profile that Medicaid program integrity units should prioritize for review.
