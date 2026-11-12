---
title: "Medicaid Pays Radically Different Amounts Per Beneficiary for the Same Lab Code"
type: blog-post
targetKeywords: ["Medicaid lab spending","clinical lab reimbursement","Medicaid fee schedule variation","state Medicaid rates","laboratory billing Medicaid"]
contentGap: "State-level Medicaid lab reimbursement variation is almost entirely absent from public data journalism; this post quantifies the gap using actual billing records."
date: "2026-11-12T14:02:57.250Z"
description: "Medicaid's per-beneficiary spending on common clinical lab codes — such as comprehensive metabolic panels and complete blood counts — varies by more than 400% across states, a gap far too large to be explained by cost of living or patient complexity alone. State budget directors and Medicaid managed care analysts need to understand whether this reflects fee schedule differences, volume patterns, or billing behavior. The uncomfortable implication is that some states are systematically overpaying for identical diagnostic tests."
ideaName: "Open Health Data Hub"
status: published
wordCount: 724
canonicalUrl: "https://www.openhealthdatahub.com/blog/medicaid-pays-radically-different-amounts-per-beneficiary-for-the-same-lab-code"
followUps: [{"question":"Which states have the highest average payment per claim for HCPCS 85025 (Complete Blood Count), and how does it compare to 80053?","dataset":"medicaid"},{"question":"What are the top 20 lab HCPCS codes (starting with '8') by total Medicaid spending, and what is the average payment per claim for each?","dataset":"medicaid"},{"question":"For HCPCS 80053, how has total Medicaid spending and average payment per claim changed by year across all states?","dataset":"medicaid"}]
---

Medicaid spent **$146 per beneficiary** on a single lab code in Alaska. In Arizona, the same code cost the program **$6 per beneficiary**. That's not a rounding difference. That's a 24-fold gap for a Comprehensive Metabolic Panel, one of the most routine blood tests in medicine.

The code is HCPCS 80053. The test checks kidney function, blood sugar, electrolytes, and liver enzymes. Ordered millions of times a year across Medicaid, it should be about as standardized as lab work gets. It isn't.

## Alaska Pays 11 Times More Per Claim Than Puerto Rico

The average payment per claim for 80053 ranges from $105.67 in Alaska to $9.48 in Puerto Rico, an 11-fold difference across Medicaid programs. South Carolina comes in second at $57.27 per claim, more than six times Puerto Rico's rate. Missouri sits at $39.10. By the time you reach the bottom decile of states, the average payment is under $10.

| State | Avg Payment Per Claim | Total Claims | Total Paid |
|---|---|---|---|
| Alaska | $105.67 | 541,542 | $57,226,092 |
| South Carolina | $57.27 | 2,276,584 | $130,372,808 |
| Missouri | $39.10 | 2,205,270 | $86,233,576 |
| Rhode Island | $33.22 | 414,232 | $13,759,638 |
| West Virginia | $21.36 | 1,791,352 | $38,269,323 |
| Iowa | $9.55 | 1,133,627 | $10,822,879 |
| Puerto Rico | $9.48 | 3,546,039 | $33,628,416 |

This isn't a small-sample artifact. Alaska's figure is based on 541,542 claims. Puerto Rico's is based on 3,546,039. The gap is real, and it runs through the entire fee schedule.

For taxpayers, this matters because Medicaid is jointly funded by states and the federal government. When Alaska reimburses labs at more than 11 times Puerto Rico's rate for an identical test, federal matching dollars flow disproportionately into high-rate markets. A beneficiary in South Carolina generates roughly six times more federal lab spending per CMP than a beneficiary in Iowa, for the same diagnostic information.

## The Per-Beneficiary Gap Is Even Wider Than the Per-Claim Gap

Average payment per claim captures price. Spending per beneficiary captures both price and utilization. When you combine the two, the disparity grows.

Alaska's spending per beneficiary for 80053 reached $146. Alabama's was $8. Arizona's was $6, the lowest in the dataset, despite Arizona recording 3,461,402 total claims for the code. California had the highest total spending on 80053 at $125,777,231 across more than 19 million claims, but its per-beneficiary figure was just $8, the same as Alabama's, because its enrolled population is enormous.

The same pattern holds for HCPCS 85025, the Complete Blood Count with Auto Differential. Alaska's spending per beneficiary was $21. Arizona's was $1.

A $140 per-beneficiary gap on a single lab code, replicated across dozens of routine panels, compounds into a structural funding inequity. States with high fee schedules don't necessarily have sicker populations or more complex cases. They have different reimbursement rates, and those rates determine how much of the federal Medicaid match flows to labs in their markets.

## California Dominates Volume, But Not Rate

California's 2018 spending on lab codes starting with "8" reached $601,659,108 across 81,039,464 claims, the highest of any state that year. New Jersey was second at $348,119,135. The volume concentration is striking: a handful of large states account for the majority of total lab spending.

But volume and rate are different problems. California's massive claim count for 80053 coexists with an $8 per-beneficiary figure, suggesting that high-volume, low-rate states are absorbing enormous utilization at compressed margins. High-rate states like Alaska and South Carolina generate far less total volume but extract significantly more per transaction.

The practical consequence: a lab operating in South Carolina earns $57.27 per CMP from Medicaid. A lab in Puerto Rico earns $9.48 for the same result. If the underlying cost of running the test is similar, that gap either reflects a windfall in high-rate states, a loss in low-rate ones, or both simultaneously. Access to lab services in low-rate markets may be shaped by whether providers can afford to accept Medicaid reimbursement at all.

Given that Alaska's spending per beneficiary for 80053 is $146 compared to Alabama's $8, the question the data leaves open is whether this disparity is driven by higher state fee schedules, greater utilization intensity per beneficiary, or differences in how managed care organizations report claims to CMS.
