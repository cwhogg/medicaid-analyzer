---
title: "The Beneficiary Cost-Sharing Burden Is Highest Exactly Where Medicare Pays the Most"
type: blog-post
targetKeywords: ["Medicare beneficiary cost sharing","Medicare out of pocket inpatient","Medicare deductible high cost DRGs","Medicare inpatient patient costs","beneficiary cost burden Medicare"]
contentGap: "Existing beneficiary cost-sharing analysis focuses on premiums and Part D; this piece uses the Avg_Tot_Pymt_Amt minus Avg_Mdcr_Pymt_Amt gap to quantify the inpatient out-of-pocket burden by DRG and hospital over a decade."
date: "2026-10-26T14:02:49.160Z"
description: "The difference between average total payment and average Medicare payment approximates what beneficiaries owe per discharge, and this gap is not random — it is systematically larger for the same high-severity DRGs where Medicare itself pays the most. A patient admitted for a complex cardiac procedure at a high-payment hospital faces a beneficiary cost burden that can dwarf the deductible for a routine admission, yet Medicare's cost-sharing structure is flat by design. The analytical tension is whether the out-of-pocket burden is effectively a regressive tax on the sickest Medicare patients."
ideaName: "Open Health Data Hub"
status: published
wordCount: 677
canonicalUrl: "https://www.openhealthdatahub.com/blog/the-beneficiary-cost-sharing-burden-is-highest-exactly-where-medicare-pays-the-most"
followUps: [{"question":"Which DRGs have the highest beneficiary cost-sharing rate (beneficiary payment as % of total payment) in 2023?","dataset":"medicare-inpatient"},{"question":"How has average beneficiary cost share per discharge changed by state from 2013 to 2023?","dataset":"medicare-inpatient"},{"question":"What is the total Medicare inpatient spending by year from 2013 to 2023?","dataset":"medicare-inpatient"}]
---

Kidney transplant patients face a beneficiary cost-sharing rate of **38.6%** of total payment. Patients receiving CAR T-cell therapy, which costs nearly 16 times as much per discharge, face a rate of just 5.1%. That gap is the clearest illustration of a structural pattern running through Medicare's inpatient payment data: the size of a patient's out-of-pocket burden has almost no reliable relationship to how much Medicare itself pays.

## When Medicare Pays More, Patients Don't Necessarily Pay Less

The disconnect shows up immediately at the top of the DRG rankings. CAR T-cell and other immunotherapies (DRG 018) carried the highest average Medicare payment of any DRG in 2023 at $419,347 per discharge. But beneficiary out-of-pocket burden ranked only 5th, at $22,655, just 5.1% of the $442,002 total payment.

Heart transplant (DRG 001) tells a different story. Average Medicare payment was $290,442, ranking second. But beneficiary burden ranked first, at **$53,340 per discharge**, representing 15.5% of the $343,782 total. A patient admitted for a heart transplant paid more than twice as much out of pocket as a patient receiving CAR T-cell therapy, despite the latter being a more expensive procedure for the program.

The kidney transplant case is the most extreme. DRG 652 had an average Medicare payment of only $26,377, ranking 68th among DRGs. Yet beneficiary out-of-pocket burden averaged $16,586, and the beneficiary cost share as a percentage of total payment was 38.6%, the highest of any DRG. For patients in this group, more than a third of every dollar spent on their hospitalization came from their own pocket. That's a financial exposure that bears no resemblance to what Medicare's payment level alone would suggest.

## A Decade of Diverging Trajectories

The DRG-level misalignment isn't a one-year anomaly. It reflects a decade-long trend in which patient cost-sharing has grown faster than Medicare's own payments.

Between 2013 and 2023, average beneficiary cost share per discharge rose from $1,884 to $3,183, an indexed increase to **168.9** (base 100 in 2013). Over the same period, average Medicare payment per discharge grew from $11,004 to $15,332, an indexed increase to only 139.3. Patients' share of inpatient costs grew roughly 21% faster than Medicare's share over the decade.

Total Medicare discharges fell from 7,494,046 in 2013 to 4,956,412 in 2023, so the universe of affected patients is smaller. But the patients who remain in the inpatient system are absorbing a larger share of costs with each passing year. For a program designed to protect elderly and disabled Americans from catastrophic medical expenses, that trajectory runs in the wrong direction.

## Geography Adds Another Layer of Misalignment

State-level data shows the same rank divergence that appears across DRGs. Washington D.C. ranked first in average beneficiary burden per discharge in 2023 at $7,655, with a burden rate of 24.6% of total payment. Its average Medicare payment of $23,405 also ranked first among states, so at least the rankings align there.

Illinois is a sharper example of the disconnect. The state ranked 5th in beneficiary burden at $3,953 per discharge but only 28th in average Medicare payment at $14,160, a rank divergence of 23 positions. California sits on the other side: it ranked 3rd in average Medicare payment at $21,095 but only 15th in beneficiary burden at $3,393, a divergence of 12 positions in the opposite direction.

The geographic variation matters because it means the financial exposure patients face isn't simply a function of how sick they are or how expensive their care is. Two patients admitted for comparable procedures in different states can face meaningfully different out-of-pocket burdens, and neither the procedure cost nor the Medicare payment reliably predicts which patient pays more.

What the kidney transplant numbers make hard to ignore: a procedure with a relatively modest Medicare payment of $26,377 generates a 38.6% beneficiary cost share, while procedures costing ten times as much generate rates below 6%. Understanding what drives that specific inversion, whether in the structure of Medicare's deductible, the role of supplemental coverage, or contracting patterns between payers and transplant centers, is the question the aggregate data raises but cannot answer.
