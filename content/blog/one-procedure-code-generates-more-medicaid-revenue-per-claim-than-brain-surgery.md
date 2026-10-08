---
title: "One Procedure Code Generates More Medicaid Revenue Per Claim Than Brain Surgery"
type: blog-post
targetKeywords: ["Medicaid high-cost procedures","Medicaid per-claim spending","HCPCS code analysis","Medicaid budget risk","low-volume high-cost codes"]
contentGap: "Public Medicaid spending analyses rank procedures by total dollars, not by cost-per-claim, systematically hiding the low-frequency catastrophic codes that drive variance rather than averages."
date: "2026-10-08T14:02:59.295Z"
description: "Sorting Medicaid HCPCS codes by average payment per claim — rather than total volume — reveals a tier of low-frequency, extremely high-cost codes where a single claim can exceed $50,000, dwarfing even complex surgical procedures. Health economists tracking Medicaid budget risk focus almost exclusively on high-volume codes, leaving the tail of catastrophic-cost-per-claim codes unexamined. The provocative finding is that a handful of codes with fewer than 10,000 annual claims nationally account for a disproportionate share of spending variance."
ideaName: "Open Health Data Hub"
status: published
wordCount: 686
canonicalUrl: "https://www.openhealthdatahub.com/blog/one-procedure-code-generates-more-medicaid-revenue-per-claim-than-brain-surgery"
followUps: [{"question":"What are the top 10 procedure codes by average payment per claim, filtered to codes with at least 1,000 claims?","dataset":"medicaid"},{"question":"For the top 20 highest-spending procedure codes, what percentage of total payments comes from the top 5 providers?","dataset":"medicaid"},{"question":"How has total Medicaid spending on J2326 changed year over year?","dataset":"medicaid"}]
---

Two numbers that don't belong together: 1,353 claims and $124,690,714 in total Medicaid payments.

That's the footprint of J2326, the billing code for Nusinersen (Spinraza), a treatment for spinal muscular atrophy. At **$92,158.69 per claim on average**, it generates more Medicaid revenue per encounter than any other procedure code with at least 1,000 claims in the dataset. For context, Pembrolizumab (Keytruda), one of the most widely used cancer immunotherapies in Medicaid, averages $5,328.79 per claim across 230,803 claims. J2326 costs more than 17 times as much per claim and appears a fraction as often.

That combination, extreme per-claim cost and narrow utilization, is exactly what makes it worth examining closely.

## The Codes That Cost the Most Per Encounter Are Almost All Rare Disease Treatments

The top of the per-claim cost ranking reads like a formulary for ultra-rare conditions. Casimersen (J1426), a Duchenne muscular dystrophy treatment, ranks second at **$31,833.01 per claim** across 2,062 claims. Emicizumab (J7170), used in hemophilia A, averages $24,068.63 per claim across 10,264 claims and has generated $247,040,460 in total payments, more than double J2326's total despite a lower per-claim average. Ocrelizumab (J2350), used in multiple sclerosis, generated $391,826,852 across 24,420 claims at $16,045.33 per claim.

These are not billing errors or administrative artifacts. Nusinersen requires intrathecal injection and is dosed repeatedly over a patient's lifetime. The per-claim cost reflects the drug's list price, not some anomaly in how the code is applied. What makes J2326 stand out is the combination of the highest per-claim average in the dataset and the smallest claim volume among the top codes. For Medicaid programs, that means the financial exposure is concentrated in a very small number of encounters, any one of which could be scrutinized individually.

## 100% Billing Concentration Is the Statistic That Demands Attention

Among the top 10 highest-average-payment codes, several show extreme provider concentration. J2326 is the starkest case: **100% of its $124,690,714 in total Medicaid payments came from just five providers**. J1426 and J1428 show the same pattern, with 100% of payments concentrated among five or fewer billers. Burosumab (J0584) comes close, with 97.93% of its $168,353,120 in payments concentrated in the top five providers.

Not every high-cost code looks this way. Ocrelizumab (J2350) has a top-5 concentration of just 43.6%, meaning its $391 million in payments is distributed across a much broader provider base. That's what you'd expect for a drug treating a condition, multiple sclerosis, with a larger patient population and more prescribers. The contrast matters: when a code's entire payment volume flows through five providers, those providers are either the only legitimate administrators of a genuinely rare therapy, or the concentration itself is a signal worth investigating.

For J7170 (Emicizumab), the top-5 concentration sits at 81.94%, accounting for $202,432,848 of $247,040,460 in total payments. Factor VIII (J7192) is at 99.85% concentration across $42,353,009 in payments. The pattern across rare-disease biologics is consistent: a handful of providers handle nearly all the volume, and nearly all the money.

## What Medicaid's Budget Actually Looks Like at the Extremes

The standard framing of Medicaid cost pressure focuses on high-volume codes, the primary care visits, generic prescriptions, and routine procedures that appear millions of times a year. J2326 inverts that logic entirely. Across just 1,353 claims, it generated more than $124 million. If that claim count doubled, so would the program's exposure, with no change in the number of providers billing it and no increase in the number of patients who could plausibly need it.

That's the structural risk embedded in rare-disease biologics: the per-unit cost is so high that even modest changes in utilization produce large budget swings. Pembrolizumab, by comparison, generated $1,229,899,613 across 230,803 claims. Its total is ten times larger, but it's also spread across a patient population large enough that utilization trends are statistically predictable. J2326's 1,353 claims offer no such predictability.

Given that 100% of J2326's Medicaid payments are concentrated among five providers, the question Medicaid auditors and program integrity teams need to answer is whether those five are large specialty infusion centers serving a genuinely rare patient population, or whether that concentration reflects something else entirely.
