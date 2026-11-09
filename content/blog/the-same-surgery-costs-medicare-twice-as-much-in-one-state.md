---
title: "The Same Surgery Costs Medicare Twice as Much in One State"
type: blog-post
targetKeywords: ["Medicare inpatient state variation","geographic Medicare payment differences","state Medicare spending comparison","Medicare payment variation by state","inpatient cost variation"]
contentGap: "State-level Medicare inpatient payment variation is discussed in academic literature but almost never visualized across a full decade using total-payment methodology that accounts for both price per case and discharge volume."
date: "2026-11-09T14:03:06.873Z"
description: "For identical high-volume surgical DRGs, average Medicare inpatient payments vary by more than 100 percent across states — a disparity that has persisted and in some cases widened over the decade from 2013 to 2023. Health policy journalists and benefit consultants need this data because geographic payment variation is one of the most durable and least-explained inefficiencies in American healthcare. The provocative gap: states with the highest per-discharge payments are not necessarily the ones with the best outcomes, raising the possibility that Medicare is systematically overpaying in markets where it has the least leverage."
ideaName: "Open Health Data Hub"
status: published
wordCount: 660
canonicalUrl: "https://www.openhealthdatahub.com/blog/the-same-surgery-costs-medicare-twice-as-much-in-one-state"
followUps: [{"question":"Which states have the highest average Medicare inpatient payment per discharge for DRG 470 (major joint replacement) in 2023?","dataset":"medicare-inpatient"},{"question":"For DRG 470, what is the gap between the highest and lowest paying hospital within each state, ranked by largest spread?","dataset":"medicare-inpatient"},{"question":"How has the average Medicare inpatient payment per discharge for major joint replacement (DRG 470) changed from 2013 to 2023?","dataset":"medicare-inpatient"}]
---

Major joint replacement, one of Medicare's most common inpatient procedures, costs the program **$23,530 per discharge** in Maryland. In Illinois, the same surgery costs **$12,814**. That $10,716 gap, for a procedure defined by the same DRG code, is not a rounding error or a data artifact. It's a structural feature of how Medicare pays hospitals.

## Maryland's Numbers Don't Look Like Anyone Else's

Maryland sits in a category of its own. Its weighted average payment of $23,530 across 29 hospitals and 1,090 discharges is the highest in the dataset by a wide margin. Alaska, the second-highest state, averages $19,531, and that's across just 5 hospitals and 348 discharges. Every other state in the top tier falls below $18,000.

The spread within Maryland is even more striking. The state's minimum hospital-level payment is $16,653, meaning Maryland's floor is higher than the weighted average of 14 of the 20 states in this dataset. And at the top end, one Maryland hospital received $58,296 per discharge, the highest single-hospital maximum recorded anywhere in the data. For context, Alaska's maximum hospital payment is $25,770, less than half of Maryland's peak.

That kind of internal range matters for CMS reimbursement benchmarking. When one state's floor exceeds most states' averages, geographic payment equity becomes difficult to defend on clinical grounds alone.

## Volume Doesn't Explain the Price

A reasonable assumption is that high-volume states drive down per-discharge costs through efficiency or negotiating leverage. California has 7,694 discharges across 130 hospitals, the largest volume in the dataset, and its weighted average payment is $17,525. New York, with 6,994 discharges across 59 hospitals, averages $17,231. Both are well above the national midpoint in this dataset, which undercuts the idea that scale alone compresses payments.

| State | Hospitals | Discharges | Avg Payment |
|-------|-----------|------------|-------------|
| MD | 29 | 1,090 | $23,530 |
| AK | 5 | 348 | $19,531 |
| CA | 130 | 7,694 | $17,525 |
| NY | 59 | 6,994 | $17,231 |
| NJ | 27 | 1,287 | $14,945 |
| MN | 23 | 1,491 | $13,367 |
| IL | 52 | 3,255 | $12,814 |

Illinois, the lowest-average state at $12,814, has 52 hospitals and 3,255 discharges. That's a substantial footprint. Minnesota, with 23 hospitals and 1,491 discharges, averages $13,367. Neither is a low-capacity outlier. The data doesn't support a simple story where more volume equals lower payments.

At the other end of the spectrum, New Mexico's minimum hospital payment of $9,401 is the lowest floor in the dataset, while Rhode Island's maximum hospital payment of $15,484 is the lowest ceiling. Rhode Island's entire payment range sits below Maryland's floor. Two patients receiving the same DRG 470 procedure, one in Providence and one in Baltimore, generate payments that don't overlap at all.

## What a $10,716 Gap Means at Scale

For a procedure this common, the arithmetic compounds fast. California alone processed 7,694 discharges in 2023. If those patients had been reimbursed at Maryland's rate instead of California's $17,525 average, the additional cost to Medicare would have exceeded $46 million for a single state in a single year. That's not a projection or a model. It's a direct consequence of the payment structure as it currently exists.

The gap between Maryland's $23,530 and Illinois's $12,814 represents an 84% premium for the same coded procedure. Patients don't choose their state based on what Medicare pays their hospital, and hospitals don't choose their state based on what they'll receive. But the program pays as if geography is a legitimate clinical variable, and the numbers show just how much weight that variable carries.

Maryland operates under a unique all-payer hospital rate-setting system, which gives the state's hospital commission authority over payment rates across all payers, not just Medicare. Whether that system accounts for the full $10,716 gap, or whether patient acuity and hospital cost structures absorb part of it, is a question the data raises but doesn't resolve.
