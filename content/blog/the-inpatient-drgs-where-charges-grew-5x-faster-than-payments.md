---
title: "The Inpatient DRGs Where Charges Grew 5x Faster Than Payments"
type: blog-post
targetKeywords: ["hospital charge to payment ratio Medicare","chargemaster inflation Medicare","Medicare inpatient markup","hospital price transparency DRG","Medicare submitted charges vs payment"]
contentGap: "Hospital price transparency debates focus on list prices in isolation — this analysis connects chargemaster inflation directly to specific DRG categories and tracks the divergence over a full decade of Medicare data."
date: "2026-11-16T14:02:50.459Z"
description: "Across Medicare inpatient DRGs, submitted charges have grown dramatically faster than Medicare payments from 2013 to 2023 — but the divergence is not uniform, with certain procedure categories showing charge-to-payment ratios that have ballooned from 3x to 15x or more over the decade. This matters because chargemaster prices affect what uninsured and out-of-network patients actually pay, and extreme markup ratios are a leading indicator of hospital price opacity. The unanswered question is whether the widening gap reflects genuine cost pressure, strategic chargemaster inflation, or a breakdown in CMS's ability to set payment rates that track with actual hospital costs."
ideaName: "Open Health Data Hub"
status: published
wordCount: 784
canonicalUrl: "https://www.openhealthdatahub.com/blog/the-inpatient-drgs-where-charges-grew-5x-faster-than-payments"
followUps: [{"question":"Which states have the highest average charge-to-payment ratio across all DRGs in 2023, among hospitals with at least 500 discharges?","dataset":"medicare-inpatient"},{"question":"How has the average charge-to-payment ratio for DRG 291 (Heart Failure and Shock with MCC) changed by year from 2013 to 2023?","dataset":"medicare-inpatient"},{"question":"What is the weighted prevalence of heart failure diagnosis by age group among U.S. adults?","dataset":"brfss"}]
---

Medicare paid $12,134 per discharge at Capital Health Medical Center in Pennington, New Jersey in 2023. The hospital billed $340,134.

That 28-to-1 ratio is not a rounding error or a data artifact. It reflects a decade-long pattern in which hospital list prices have grown far faster than what Medicare actually reimburses, creating a chargemaster system that functions less like a pricing mechanism and more like an opening bid in a negotiation that most patients never agreed to enter.

## New Jersey Hospitals Are Billing at Levels That Defy Explanation

Capital Health Medical Center - Hopewell posted a charge-to-payment ratio of **28.03** across 1,296 discharges in 2023, the highest among all high-volume hospitals in the Medicare inpatient dataset. Its sister facility, Capital Health Regional Medical Center in Trenton, came in second at 26.51, with average submitted charges of $388,497 per discharge against average Medicare payments of $14,656.

To put that in context: HCA Florida Twin Cities Hospital, which also appears in the top 20, had average charges of $117,895 per discharge. Capital Health Regional's average charge was more than three times higher, yet both hospitals received Medicare payments in the same general range. The chargemaster price and the actual payment have essentially no relationship to each other.

Nineteen of the 20 hospitals with the highest charge-to-payment ratios in 2023 (among facilities with at least 500 discharges) were located in metropolitan area cores serving populations of 50,000 or more. The lone exception was Western Arizona Regional Medical Center in Bullhead City, classified as a micropolitan area, with a ratio of 17.23. That's still nearly 17 dollars billed for every dollar Medicare paid.

For uninsured patients or those with commercial coverage that references chargemaster rates, these numbers are not academic. A patient without Medicare or a negotiated contract at Capital Health - Hopewell faces a starting price that is 28 times what the federal government considers adequate reimbursement for the same care.

## DRG-Level Ratios Climbed Steadily for Years Before COVID Scrambled the Picture

The hospital-level extremes don't emerge from nowhere. At the DRG level, charge-to-payment ratios have been rising for most of the past decade across high-volume conditions.

DRG 177 (Respiratory Infections and Inflammations with MCC) illustrates the trajectory clearly. Its ratio rose from 4.24 in 2013 to **5.23 in 2019**, a 23% increase over six years driven almost entirely by charges growing faster than payments. Then 2020 arrived.

DRG 177 discharges grew from 73,479 in 2019 to 324,632 in 2020 as COVID-19 cases flooded into the respiratory infection category. The charge-to-payment ratio dropped sharply to 4.03 that year, even as volume quadrupled. By 2023, with discharges falling back to 166,448, the ratio had recovered to 4.80, nearly back to its pre-pandemic peak.

Heart failure tells a similar story. DRG 291 (Heart Failure and Shock with MCC) saw its ratio climb from 4.33 in 2013 to 5.19 in 2021, with total discharges growing from 191,247 to 310,925 over that period. More patients, higher charges relative to payment, year after year.

| DRG | Condition | 2013 Ratio | Peak Ratio | Peak Year |
|-----|-----------|-----------|-----------|-----------|
| 177 | Respiratory Infections w/ MCC | 4.24 | 5.23 | 2019 |
| 291 | Heart Failure and Shock w/ MCC | 4.33 | 5.19 | 2021 |

## Volume and Geography Don't Explain Away the Gaps

CJW Medical Center in Richmond, Virginia had the highest total submitted charges among the top-ratio hospitals: $1,480,732,530 across 7,590 discharges, with a charge-to-payment ratio of 16.96. That's a large, busy hospital in a major metro, not a small facility gaming a thin dataset.

Doctors Medical Center in Modesto, California had the highest average Medicare payment per discharge among the top-20 ratio hospitals at $19,042, reflecting a more complex case mix. Its ratio was still 16.89. Higher payments didn't compress the ratio because charges rose proportionally.

The geographic concentration in metropolitan cores matters for a specific reason: these are markets with enough commercial insurance volume that inflated chargemasters can generate real revenue from non-Medicare payers. The chargemaster isn't set for Medicare. Medicare pays what it pays regardless. The list price exists for everyone else.

What the 2020 DRG 177 data raises, and what the dataset can't fully resolve, is whether the sharp drop in that year's charge-to-payment ratio from 5.23 to 4.03 reflected a deliberate payment policy response to COVID or a case-mix shift as sicker patients with higher base payments flooded the respiratory DRG. Medicare payments per discharge rose from $11,993 to $14,963 in a single year, even as charges per discharge fell slightly. That divergence, in a year when everything else about hospital finance was in chaos, is the one number in this dataset that still doesn't have a clean answer.
