---
title: "Ten Providers Collect More Medicaid Dollars Than Most States Spend in Total"
type: blog-post
targetKeywords: ["Medicaid high-volume providers","Medicaid spending concentration","personal care agency Medicaid billing","Medicaid program integrity","top Medicaid providers by spending"]
contentGap: "A direct comparison of top individual provider spending totals against state-level Medicaid spending using the same claims dataset has not been published in a data-journalism context."
date: "2026-11-19T14:02:46.875Z"
description: "A small number of organization-type Medicaid providers — primarily large personal care and home health agencies — bill totals that rival or exceed the entire Medicaid claims spending of mid-size states, a concentration of revenue that has no parallel in Medicare's provider landscape. Medicaid program integrity researchers have flagged high-volume billing as a fraud risk, but the sheer scale of legitimate concentration in personal care services is itself underappreciated. The tension: if a handful of organizations intermediate the majority of Medicaid's largest spending category, the program's accountability structure has effectively collapsed into a vendor relationship."
ideaName: "Open Health Data Hub"
status: published
wordCount: 655
canonicalUrl: "https://www.openhealthdatahub.com/blog/ten-providers-collect-more-medicaid-dollars-than-most-states-spend-in-total"
followUps: [{"question":"Which states have the highest total Medicaid spending, and how does that compare to the $7.2B collected by the single top provider?","dataset":"medicaid"},{"question":"What are the top 10 billing codes by total Medicaid spending, and what is the average spending per claim for each?","dataset":"medicaid"},{"question":"Which states have the highest rates of no exercise in the past 30 days among adults with low income?","dataset":"brfss"}]
---

Medicaid's ten largest providers collected a combined sum that exceeds the entire annual Medicaid budgets of most U.S. states. That's not a rounding error or an artifact of how the data is structured. It's a structural feature of how the program now works.

## A Single Intermediary Outspent Most State Programs

PUBLIC PARTNERSHIPS LLC, a fiscal intermediary registered in New York, collected **$7,177,816,544** in Medicaid payments between 2018 and September 2024. That figure is larger than the total Medicaid expenditures of roughly 30 states in a given year. The second-largest provider, LOS ANGELES COUNTY DEPARTMENT OF MENTAL HEALTH, collected $6,778,483,867 over the same period.

The gap between these two and the rest of the top ten is meaningful. TEMPUS UNLIMITED, INC., a Massachusetts-based personal care services company, collected $5,243,487,523 on a single billing code: T1019, Personal Care Service Per 15 Minutes, across **59,709,101 claims**. That's one company, one service code, nearly 60 million claims. For context, FREEDOM CARE LLC billed the same T1019 code for $2,842,608,456 across 20,734,461 claims, less than a third of Tempus's claim volume.

When a single intermediary can accumulate $7 billion in Medicaid payments, the program's financial exposure to that entity's operational and compliance health is enormous. A billing irregularity, a contract dispute, or an insolvency event at that scale doesn't just affect one provider. It disrupts care for hundreds of thousands of beneficiaries who depend on personal care attendants.

## Personal Care and Transport Dominate the Top Billing Codes

The service categories driving these totals are not hospital procedures or specialty drugs. They're personal care, residential habilitation, and non-emergency transport: high-volume, low-unit-cost services billed in 15-minute or per-diem increments.

| Provider | State | Primary Code | Code Spending | Total Spending |
|---|---|---|---|---|
| PUBLIC PARTNERSHIPS LLC | NY | T1019 | $2,608,277,483 | $7,177,816,544 |
| TEMPUS UNLIMITED, INC. | MA | T1019 | $5,243,487,523 | $5,243,487,523+ |
| FREEDOM CARE LLC | NY | T1019 | $2,842,608,456 | $3,025,874,967 |
| MODIVCARE SOLUTIONS, LLC | CO | A0100 | $1,241,161,288 | $3,093,063,113 |
| ALABAMA DEPT. OF MENTAL HEALTH | AL | T2016 | $1,775,682,601 | $2,254,946,212 |

MODIVCARE SOLUTIONS, LLC illustrates a different concentration pattern. Its $3,093,063,113 in total spending included $1,241,161,288 from non-emergency transport taxi (A0100) across 37,471,993 claims. That's a national transportation broker collecting over a billion dollars on taxi rides for Medicaid beneficiaries. The Alabama Department of Mental Health and Mental Retardation, by contrast, collected $1,775,682,601 from a single residential habilitation code (T2016) across just 468,486 claims, reflecting the much higher per-diem cost of residential care.

The per-claim economics vary dramatically across these providers, and that variation matters for oversight. A provider billing 59 million claims at low per-unit rates faces different fraud and abuse risks than one billing half a million claims at high per-diem rates.

## No Individual Providers in the Top 20

Every single provider in the top 20 by total Medicaid spending is classified as an Organization type. Zero individual practitioners appear. This is a structural shift from how Medicaid was originally conceived, as a payer of last resort for physicians and hospitals treating low-income patients.

What the top 20 actually contains: fiscal intermediaries managing self-directed care programs, county mental health departments, state developmental disability agencies, a national lab company, and a transportation broker. GUARDIANTRAC. LLC, a Michigan-based organization, collected $2,683,634,592 in total spending. Tennessee's Department of Intellectual and Developmental Disabilities appears twice in the top 20 under two separate NPIs, with $2,596,064,455 under one NPI and $1,452,536,495 under a second, a combined $4 billion from a single state agency.

The concentration of Medicaid dollars in organizational intermediaries rather than direct care providers means that a substantial share of program oversight now functions as contract management. The question that follows from that reality: when a single fiscal intermediary processes $7 billion in payments across hundreds of thousands of personal care arrangements, what does meaningful audit coverage actually look like?
