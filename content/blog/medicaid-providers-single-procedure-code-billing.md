---
title: "Which Medicaid Providers Bill Only One Procedure Code?"
type: blog-post
targetKeywords: ["Medicaid provider billing patterns","single procedure code Medicaid","Medicaid billing specialization","HCPCS code concentration","Medicaid fraud indicators"]
contentGap: "Most Medicaid analyses focus on top spenders or top procedures, but no public analysis examines the concentration of providers who bill only a single procedure code — a pattern that can indicate either extreme specialization (e.g., a sole mammography clinic) or a potential fraud signal worth investigating."
date: "2026-02-24T03:33:07.525Z"
description: "Discover how many Medicaid providers bill exclusively one HCPCS code, what those codes are, and what this reveals about care specialization vs. potential fraud."
ideaName: "Medicaid Claims Analyzer"
status: published
wordCount: 1848
canonicalUrl: "https://medicaid-analyzer.vercel.app/blog/medicaid-providers-single-procedure-code-billing"
---

## Nearly 1 in 4 Medicaid Providers Bills Just One Procedure Code — Here's What That Reveals

In the sprawling complexity of Medicaid billing, where providers routinely submit claims across dozens of procedure codes, a striking pattern emerges from the data: a substantial share of providers bill Medicaid for exactly one type of service, and only one. This isn't a rounding error or a data artifact — it's a structural feature of how Medicaid care is actually delivered, and it tells us something important about provider specialization, care fragmentation, and where billions of dollars are flowing.

Analyzing Medicaid billing records from 2018 to 2024 across more than 617,000 distinct billing NPIs, we found that **153,349 providers — nearly 25% of all providers in the dataset — submitted claims for exactly one unique HCPCS/CPT procedure code across their entire multi-year billing history**. That's not one code in a given month or quarter. That's one code, ever, across six years of Medicaid billing.

This analysis digs into who those providers are, what they're billing for, and what the spending patterns reveal about the structure of Medicaid-covered care.

---

## The Scale of Single-Code Billing

| Metric | Value |
|---|---|
| Total distinct billing NPIs in dataset | 617,000+ |
| Providers billing exactly one HCPCS/CPT code | 153,349 |
| Share of all providers | 24.83% |

One in four Medicaid providers, across a six-year window, never diversified beyond a single procedure code. For some, this is entirely expected — a chiropractor who performs one type of manipulation, a speech therapist focused on a single treatment modality, or a personal care attendant agency billing a single per-unit service code. For others, it may signal something worth examining more closely: extreme billing concentration that could reflect either deep specialization or, in some cases, unusual billing patterns.

The key question is: what are these providers billing for?

---

## The Top Procedure Codes Among Single-Code Billers

The table below shows the 20 most common procedure codes billed by providers who submitted claims for that code and *only* that code across their entire Medicaid billing history.

| HCPCS Code | Description | # Providers | Total Spending | Total Claims | Total Beneficiaries | Avg Spending/Provider |
|---|---|---|---|---|---|---|
| 90837 | Psychotherapy 60 Min | 18,560 | $1,363,014,320 | 15,892,299 | 5,774,346 | $73,438 |
| 99213 | Office Visit Established Low (20 Min) | 14,779 | $93,963,049 | 2,205,560 | 1,847,471 | $6,358 |
| 99214 | Office Visit Established Moderate (30 Min) | 13,009 | $101,156,012 | 2,014,064 | 1,726,718 | $7,776 |
| 90834 | Psychotherapy 45 Min | 5,162 | $225,039,849 | 3,388,438 | 1,333,937 | $43,595 |
| 92507 | Speech/Language Treatment (Individual) | 4,489 | $470,380,755 | 7,288,539 | 1,758,835 | $104,785 |
| 98941 | Chiropractic Manipulation 3–4 Regions | 3,823 | $88,897,257 | 4,216,249 | 2,024,946 | $23,253 |
| T1019 | Personal Care Service Per 15 Min | 3,209 | $10,058,924,560 | 102,305,097 | 5,659,732 | $3,134,598 |
| 97530 | Therapeutic Activities | 2,974 | $245,234,835 | 3,504,816 | 948,396 | $82,460 |
| 99232 | Subsequent Hospital Inpatient/Obs. Moderate | 2,847 | $10,350,441 | 462,881 | 159,713 | $3,636 |
| 93010 | Electrocardiogram Report | 2,641 | $16,960,971 | 3,823,193 | 2,900,916 | $6,422 |
| 97110 | Therapeutic Exercises | 2,611 | $79,491,737 | 1,485,496 | 431,505 | $30,445 |
| H0004 | Alcohol/Drug Services | 1,872 | $239,841,195 | 2,584,862 | 929,733 | $128,120 |
| S5125 | Attendant Care Service Per 15 Min | 1,803 | $6,519,592,607 | 69,290,172 | 3,385,980 | $3,615,969 |
| T2031 | Assisted Living Waiver Per Diem | 1,753 | $4,032,033,074 | 12,086,994 | 1,533,959 | $2,300,076 |
| 99284 | ED Visit Moderate Medical Decision Making | 1,496 | $5,519,316 | 73,622 | 70,686 | $3,689 |
| A4253 | Blood Glucose/Reagent Strips | 1,471 | $2,292,202 | 168,112 | 152,547 | $1,558 |
| 99233 | Subsequent Hospital Inpatient/Obs. High | 1,463 | $6,776,862 | 178,601 | 64,924 | $4,632 |
| 92015 | Determine Refractive State | 1,362 | $459,133 | 47,977 | 45,189 | $337 |
| T1015 | Clinic Service | 1,243 | $146,130,026 | 684,382 | 422,531 | $117,562 |
| 99285 | ED Visit High Medical Decision Making | 1,210 | $3,404,491 | 73,044 | 71,497 | $2,814 |

---

## Mental Health Dominates the Provider Count

The single most common code among single-code billers is **90837 — 60-minute psychotherapy** — with 18,560 providers billing nothing else. That's more than any other code by a wide margin, and it makes intuitive sense. Independent therapists and licensed clinical social workers often operate narrow, focused practices. A solo psychotherapist seeing patients for 60-minute sessions week after week has little reason to bill anything else.

Combined with **90834 (45-minute psychotherapy)**, which accounts for another 5,162 single-code providers, the two psychotherapy codes alone represent nearly 24,000 providers — more than 15% of all single-code billers. Together, they account for over **$1.58 billion in Medicaid spending** from providers who bill exclusively those codes.

The average spending per provider for 90837 single-code billers is $73,438 — a figure consistent with a part-time or supplemental Medicaid practice for a therapist who may also see privately insured or self-pay patients.

---

## The Massive Spending Concentration in Long-Term Services

While mental health providers dominate by provider count, the most striking finding in the spending column involves long-term services and supports (LTSS) codes — specifically **T1019** and **S5125**.

**T1019 (Personal Care Service, Per 15 Minutes)** is billed by 3,209 single-code providers, generating a staggering **$10.06 billion in total Medicaid spending** — an average of **$3.13 million per provider**. **S5125 (Attendant Care Service, Per 15 Minutes)** follows closely, with 1,803 providers and **$6.52 billion in spending**, averaging **$3.62 million per provider**.

These are not individual clinicians. These are home care agencies, personal care organizations, and attendant care companies that bill Medicaid for hourly or per-unit personal assistance services. Their billing model is inherently single-code: they provide one type of service, billed in 15-minute increments, at enormous volume. The 102 million claims submitted under T1019 alone — by providers billing only that code — underscore the sheer scale of home-based personal care in Medicaid.

**T2031 (Assisted Living Waiver, Per Diem)** adds another **$4.03 billion** from 1,753 single-code providers, averaging $2.3 million per provider. These three LTSS codes alone account for over **$20.6 billion in Medicaid spending** from single-code billers — dwarfing every other category combined.

This concentration is worth flagging for policy analysts. When a single billing entity submits tens of millions of claims for a single service code over six years, the integrity of that billing warrants robust oversight infrastructure. That's not an accusation of fraud — it's a structural observation about where audit resources should be focused.

---

## The Specialists: Speech, Therapy, and Chiropractic

Several codes in the top 20 reflect genuine clinical specialization:

- **92507 (Speech/Language Treatment, Individual)**: 4,489 providers, $470 million in spending, averaging $104,785 per provider. Speech-language pathologists treating individual patients have little reason to bill other codes, and the per-provider average suggests meaningful caseloads.

- **97530 (Therapeutic Activities)**: 2,974 providers, $245 million, averaging $82,460 per provider. Occupational therapists using therapeutic activities as their primary modality fit this profile well.

- **97110 (Therapeutic Exercises)**: 2,611 providers, $79 million, averaging $30,445 per provider. The lower per-provider average here may reflect part-time Medicaid participation.

- **98941 (Chiropractic Manipulation, 3–4 Regions)**: 3,823 providers, $89 million. Chiropractors are among the most naturally single-code billers in any payer system — their scope of practice within Medicaid is typically narrow and well-defined.

**H0004 (Alcohol and Drug Services)** stands out with the highest average spending per provider among the clinical codes at **$128,120**, reflecting the intensive, high-frequency nature of substance use disorder treatment services.

---

## The Puzzling Cases: ED Visits and Hospital Follow-Ups

A few entries in the top 20 deserve closer scrutiny. **99284 and 99285** — emergency department visit codes at moderate and high complexity — appear with 1,496 and 1,210 single-code providers respectively. Why would a provider bill only emergency department visits, and nothing else, across six years?

One explanation is legitimate: emergency medicine physicians who work exclusively in ED settings and bill only for their evaluation and management services. Another explanation involves billing arrangements where a group or facility bills under a single NPI for a narrow service type.

Similarly, **99232 and 99233** — subsequent hospital inpatient/observation visit codes — appear with nearly 4,300 combined single-code providers. Hospitalists who see patients only during inpatient stays, billing only follow-up visits, could plausibly generate this pattern. But the relatively low average spending per provider ($3,636 and $4,632 respectively) suggests these may be providers with limited Medicaid exposure rather than full-time hospitalists.

**93010 (Electrocardiogram Report)** is perhaps the most interesting outlier: 2,641 providers billing only ECG interpretation, serving nearly 2.9 million beneficiaries, at an average of just $6,422 per provider. Cardiologists or radiologists who read ECGs remotely — without performing any other billable service — fit this pattern. The high beneficiary count relative to spending reflects the low per-unit cost of ECG interpretation.

---

## What Single-Code Billing Tells Us About Medicaid's Structure

The 24.83% of Medicaid providers who bill exactly one procedure code are not a monolithic group. They include:

1. **Highly specialized clinicians** (therapists, chiropractors, speech pathologists) whose scope of practice is inherently narrow
2. **Large-volume LTSS agencies** billing personal care services at industrial scale
3. **Part-time or supplemental Medicaid participants** whose primary practice lies elsewhere
4. **Facility-based or role-specific billers** (ECG readers, ED physicians) whose billing naturally concentrates in one code

Understanding which category a provider falls into matters enormously for program integrity, rate-setting, and network adequacy analysis. A single-code biller with $3 million in annual Medicaid revenue is a fundamentally different entity than one with $6,000.

---

## Key Takeaways

- **153,349 Medicaid providers — nearly 1 in 4 — billed exactly one HCPCS/CPT code across their entire 2018–2024 billing history**, representing 24.83% of all providers in the dataset.

- **Mental health providers dominate by count**: 90837 (60-min psychotherapy) is the most common single code, with 18,560 providers and $1.36 billion in spending.

- **Long-term services and supports codes dominate by spending**: T1019 and S5125 alone account for over $16.5 billion in Medicaid spending from single-code billers, with per-provider averages exceeding $3 million.

- **Single-code billing is not inherently suspicious** — it often reflects legitimate specialization — but the combination of high volume, high spending, and narrow code concentration creates a natural starting point for targeted program integrity review.

- **The diversity within single-code billers** — from a solo therapist billing $6,000 annually to a home care agency billing $10 million — underscores the need for context-sensitive analysis rather than blanket assumptions about what single-code billing means.

For researchers and analysts building Medicaid provider risk models, the single-code billing flag is a useful first-pass filter — not a red flag in itself, but a lens that quickly surfaces both the most specialized and the most concentrated corners of the Medicaid provider universe.
