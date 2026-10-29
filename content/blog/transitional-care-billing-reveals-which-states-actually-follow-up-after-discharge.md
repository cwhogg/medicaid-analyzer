---
title: "Transitional Care Billing Reveals Which States Actually Follow Up After Discharge"
type: blog-post
targetKeywords: ["transitional care management Medicaid","post-discharge follow-up","Medicaid readmission prevention","TCM billing by state","care transitions Medicaid"]
contentGap: "TCM billing has been analyzed in Medicare but almost never in Medicaid, where post-discharge follow-up is arguably more critical given the higher social complexity of the enrollee population."
date: "2026-10-29T14:02:52.978Z"
description: "Transitional Care Management codes (99495, 99496) are billed when a clinician contacts a recently discharged patient within days of leaving a hospital — making their frequency a proxy for how seriously each state's Medicaid system takes post-discharge follow-up. States with low TCM billing relative to their Medicaid enrollment are likely sending high-risk patients home with no structured handoff, which is a known driver of preventable readmissions. The tension worth investigating is whether the states with the least TCM billing also show the highest emergency care spending per enrollee, suggesting the cost of skipping follow-up lands elsewhere in the system."
ideaName: "Open Health Data Hub"
status: published
wordCount: 653
canonicalUrl: "https://www.openhealthdatahub.com/blog/transitional-care-billing-reveals-which-states-actually-follow-up-after-discharge"
followUps: [{"question":"What is the year-over-year trend in TCM claims (99495 and 99496) by state from 2018 to 2024?","dataset":"medicaid"},{"question":"Which states have the highest total emergency department spending per Medicaid enrollee from 2018 to 2024?","dataset":"medicaid"},{"question":"How has the rate of hospital readmissions or unplanned ED visits changed over time by age group in BRFSS data?","dataset":"brfss"}]
---

Across Medicaid's entire billing universe, few codes are as revealing as transitional care management. States that bill for TCM (codes 99495 and 99496) are documenting that someone called, followed up, and saw the patient after discharge. States that don't bill for it are, in effect, documenting the opposite.

The gap between those two groups is wider than most analysts assume.

## Virginia and Michigan Are Doing Something Most States Aren't

Virginia recorded **0.0192 TCM claims per Medicaid enrollee** from 2018 through 2024, the highest rate among all states analyzed. Florida, by comparison, came in at 0.0012. That's a 16x difference between two large states with comparable Medicaid populations. Michigan led in raw volume with 41,241 total TCM claims, while Virginia's 36,409 claims translated into the highest per-enrollee rate because its enrollment base is smaller.

Both states demonstrate that high TCM utilization is achievable even when ED spending per enrollee is substantial. Virginia's ED spending per enrollee was $967.05, nearly identical to the national median for high-ED states, yet its ED-to-TCM claims ratio was just 395.8. That ratio measures how many ED claims exist for every TCM claim. A lower number means more follow-up relative to emergency use.

## The Zero-Billing States Carry a Specific Price Tag

Alaska spent **$2,087.64 per Medicaid enrollee on emergency department care** from 2018 through 2024 and billed zero TCM claims. North Dakota, with $1,142.06 in ED spending per enrollee, also recorded zero TCM claims. These aren't small programs with thin data. Alaska had 1,793,442 ED claims in the dataset.

The pattern extends beyond the zero-billing states. Indiana's ED-to-TCM claims ratio reached **25,316.3**, the highest in the dataset, with 14,683,463 ED claims against only 580 TCM claims. Kentucky's ratio was 18,655.7, with 15,540,237 ED claims and just 833 TCM claims. Connecticut's ratio was 10,943.3. For every TCM claim Connecticut billed, it billed nearly 11,000 ED claims. For Indiana, that figure was over 25,000.

The consequence is direct: patients discharged from hospitals in these states are returning to emergency rooms at rates that dwarf the post-discharge follow-up activity the billing record can detect. Whether those readmissions are avoidable is a separate question, but the absence of TCM billing means the system isn't even attempting the intervention that could reduce them.

| State | ED Spending/Enrollee | TCM Claims/Enrollee | ED-to-TCM Ratio |
|-------|---------------------|---------------------|-----------------|
| Alaska | $2,087.64 | 0 | N/A |
| Connecticut | $1,782.66 | 0.0008 | 10,943.3 |
| Kentucky | $1,403.42 | 0.0006 | 18,655.7 |
| Indiana | $870.67 | 0.0003 | 25,316.3 |
| Virginia | $967.05 | 0.0192 | 395.8 |
| Michigan | $880.29 | 0.0143 | 493.0 |

## National TCM Billing Grew, But From a Very Low Base

Nationally, 99495 claims grew from 14,027 in 2018 to **20,120 in 2024**. Code 99496 grew from 12,066 to 19,431 over the same period. Total reimbursement for 99495 rose from $954,231 in 2018 to $2,283,509 in 2024. The trend is clearly upward.

The 2020 interruption is visible in the data. 99495 claims dropped to 9,609 that year, the lowest point in the dataset, before recovering to 11,823 in 2021 and continuing upward through 2024. The recovery matters because 2020 and 2021 were precisely the years when post-discharge follow-up was most critical, as COVID hospitalizations generated enormous discharge volumes with fragile patients.

Louisiana adds a different kind of anomaly. The state recorded 7,429 total TCM claims but only $4,027.11 in total TCM spending across the entire period, the lowest among states with any TCM activity despite having 1,705,820 Medicaid enrollees. At that volume of claims, the implied average payment per claim is implausibly low, raising the question of whether Louisiana's TCM claims are being systematically denied after submission, reimbursed under a state-specific rate that doesn't appear in the federal data, or represent a reporting artifact. The billing record shows the claims exist. What it can't explain is why almost none of the money followed.
