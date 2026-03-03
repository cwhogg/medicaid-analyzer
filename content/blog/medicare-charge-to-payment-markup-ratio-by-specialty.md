---
title: "Medicare Markup: Who Charges the Most vs. Gets Paid"
type: blog-post
targetKeywords: ["Medicare charge to payment ratio","Medicare billing markup by specialty","Medicare allowed amount vs billed charges","Medicare physician billing analysis","CMS provider payment data"]
contentGap: "Most Medicare billing coverage focuses on total spending or top-paid providers. This piece uniquely examines the ratio between what providers submit vs. what Medicare actually pays — revealing which specialties systematically overbill and how that markup has shifted over a decade."
date: "2026-03-03T22:06:35.813Z"
description: "Which medical specialties submit the most inflated charges to Medicare? We analyze the gap between billed charges and actual payments across all provider types, 2013–2023."
ideaName: "Open Health Data Hub"
status: published
wordCount: 1859
canonicalUrl: "https://www.openhealthdatahub.com/blog/medicare-charge-to-payment-markup-ratio-by-specialty"
---

The gap between what healthcare providers bill and what Medicare actually pays has long been one of the most revealing—and least understood—fault lines in American healthcare finance. While patients rarely see submitted charges directly, these numbers shape negotiations, influence policy, and expose structural tensions in how medical services are priced. A decade of Medicare data, spanning 2013 through 2023, offers an unprecedented window into which specialties and procedures carry the steepest markups—and what that means for the system as a whole.

## The Markup Landscape: Specialty-Level Patterns

When we examine the ratio of submitted charges to actual Medicare payments across provider specialties, the results are striking. Anesthesia-related specialties dominate the top of the markup rankings by a wide margin, and the pattern holds across multiple credential types and billing categories.

### Anesthesia: The Markup Leader

Anesthesiology Assistants top the list with a charge-to-payment ratio of **12.22**—meaning that for every dollar Medicare ultimately paid, providers submitted $12.22 in charges. Certified Registered Nurse Anesthetists (CRNAs) follow at **9.72**, with Anesthesiologist Assistants at **9.28** and Anesthesiology as a specialty at **8.68**. Even a second CRNA billing category carries a ratio of **7.22**.

| Specialty | Charge-to-Payment Ratio | Total Services | Provider Count |
|---|---|---|---|
| Anesthesiology Assistant | 12.22 | 891,192 | 3,113 |
| Certified Registered Nurse Anesthetist (CRNA) | 9.72 | 35,917,572 | 56,694 |
| Anesthesiologist Assistants | 9.28 | 269,235 | 1,484 |
| Anesthesiology | 8.68 | 148,214,079 | 51,481 |
| CRNA | 7.22 | 12,653,459 | 39,165 |
| Radiation Therapy Center | 7.08 | 1,686,146 | 54 |
| Emergency Medicine | 6.96 | 284,495,314 | 67,178 |
| Ambulatory Surgical Center | 6.13 | 132,544,452 | 7,040 |
| Independent Diagnostic Testing Facility (IDTF) | 6.11 | 182,989,685 | 3,614 |
| Radiation Therapy | 6.01 | 1,192,299 | 57 |

Why does anesthesia cluster so heavily at the top? Several structural factors are at play. Anesthesia billing is notoriously complex, often involving time-based units and base units that interact with Medicare's fee schedule in ways that create large gaps between submitted and allowed amounts. Additionally, anesthesia providers frequently operate in environments where they have limited direct negotiating leverage with payers, and their billing practices have historically been set to capture maximum reimbursement across a wide range of payer types—with Medicare's fixed rates creating a predictable floor that sits well below submitted amounts.

It's also worth noting that the scale here is substantial. Anesthesiology alone accounts for over **148 million services** and more than **$87.7 billion in submitted charges** over the study period, with Medicare ultimately paying approximately **$10.1 billion**—a gap of more than $77 billion. CRNAs represent another **$33.1 billion in submitted charges** against **$3.4 billion in payments** across nearly **36 million services**.

### Emergency Medicine and Facility-Based Care

Emergency Medicine, with a ratio of **6.96** across **284 million services** and **67,178 providers**, represents one of the most consequential entries on this list. Emergency departments have long been associated with high-charge, high-volume billing, and this data confirms that pattern at scale. The total submitted charges for Emergency Medicine over the study period reached **$166.3 billion**, with Medicare paying **$23.9 billion**—a ratio that reflects both the complexity of emergency care and the structural reality that emergency providers cannot turn away Medicare patients regardless of reimbursement rates.

Ambulatory Surgical Centers (ASCs) show a ratio of **6.13** across **132.5 million services**. ASCs have been positioned by policymakers as cost-saving alternatives to hospital outpatient departments, and their Medicare payment rates are indeed lower than hospital rates for comparable procedures. But a markup ratio above 6 suggests that even in these supposedly efficient settings, submitted charges remain far above what Medicare considers appropriate payment.

### Radiology and Imaging

Diagnostic Radiology presents a particularly interesting case: a ratio of **5.38** across a staggering **1.91 billion services**—by far the highest service volume in the top 20 specialties. With **$204 billion in submitted charges** and **$37.9 billion in Medicare payments**, radiology represents one of the largest absolute gaps in the dataset. Independent Diagnostic Testing Facilities (IDTFs) show ratios of **6.11** and **5.28** across two separate billing categories, reflecting the fragmented nature of how imaging services are classified and billed.

| Specialty | Charge-to-Payment Ratio | Total Submitted Charges | Total Medicare Payment |
|---|---|---|---|
| Diagnostic Radiology | 5.38 | $204,054,545,697 | $37,926,333,581 |
| Interventional Radiology | 5.12 | $14,199,758,252 | $2,776,086,989 |
| Radiation Oncology | 4.95 | $74,579,126,285 | $15,079,938,943 |
| Pain Management | 5.04 | $18,849,895,240 | $3,742,719,417 |
| Neurosurgery | 5.89 | $21,198,907,675 | $3,597,354,051 |
| Gastroenterology | 4.78 | $62,046,236,325 | $12,977,602,421 |

## Procedure-Level Markups: Where the Numbers Get Extreme

The specialty-level analysis tells one story; the procedure-level data tells another—and in some cases, a far more dramatic one.

### The Contrast Agent Anomaly

Among the top 20 most-billed HCPCS codes by volume, one entry stands out as an extreme outlier: **Q9967**, a low osmolar contrast material used in imaging procedures. In facility settings, this code carries a markup ratio of **120.7**—providers submitted an average of **$13.91** per milliliter while Medicare paid just **$0.12**. Even in office settings, the ratio is **14.4**, with a submitted charge of **$1.65** against a payment of **$0.11**.

| HCPCS Code | Description | Facility Markup | Office Markup | Total Services |
|---|---|---|---|---|
| Q9967 | Low osmolar contrast material, 300-399 mg/ml iodine | 120.7 | 14.4 | 93,413,115 |
| J0878 | Injection, daptomycin, 1 mg | — | 19.9 | 34,330,176 |
| A9575 | Injection, gadoterate meglumine, 0.1 ml | — | 11.6 | 48,261,172 |
| Q0138 | Injection, ferumoxytol, iron deficiency anemia, 1 mg | — | 9.9 | 36,878,194 |
| J1439 | Injection, ferric carboxymaltose, 1 mg | — | 4.0 | 46,709,069 |

The contrast material ratio of 120.7 in facility settings is not necessarily evidence of fraud or abuse—Medicare's payment methodology for contrast agents in facility settings is structured differently, often bundling payment into broader procedure reimbursements rather than paying separately for the contrast itself. But it illustrates how dramatically the charge-to-payment relationship can diverge depending on billing context and Medicare's payment bundling rules.

Daptomycin (J0878), an antibiotic injection, shows an office-setting markup of **19.9** across **34.3 million services**. Gadoterate meglumine (A9575), an MRI contrast agent, carries an **11.6** ratio in office settings across **48.3 million services**.

### High-Volume Workhorse Codes: More Moderate Markups

The most commonly billed evaluation and management codes tell a different story. Code **99214** (established patient office visit, 30-39 minutes) shows ratios of **3.7** in facility settings and **3.1** in office settings across **99.3 million services**. Code **99213** (established patient visit, 20-29 minutes) shows **3.7** facility and **3.0** office ratios across **70.2 million services**.

| HCPCS Code | Description | Facility Markup | Office Markup | Total Services |
|---|---|---|---|---|
| 99214 | Established patient visit, 30-39 min | 3.7 | 3.1 | 99,338,804 |
| 99213 | Established patient visit, 20-29 min | 3.7 | 3.0 | 70,165,439 |
| 97110 | Therapeutic exercise, each 15 min | 4.0 | 3.7 | 63,754,222 |
| 97530 | Therapeutic activities | 3.6 | 2.9 | 36,072,817 |
| 99232 | Subsequent hospital care | 3.2 | 2.9 | 34,797,914 |
| K1034 | COVID-19 test, nonprescription | — | 1.4 | 153,281,273 |

These ratios—in the 3 to 4 range—represent what might be considered the "baseline" markup for routine outpatient care. The COVID-19 test code (K1034) shows the lowest markup in the dataset at **1.4**, with an average submitted charge of **$16.21** against a payment of **$11.62**, reflecting the relatively standardized pricing environment for pandemic-era testing.

### Facility vs. Office Setting Differences

One consistent pattern across the procedure-level data is that facility settings tend to carry slightly higher markup ratios than office settings for the same procedure codes. For therapeutic exercise (97110), the facility ratio is **4.0** versus **3.7** in office settings. For onabotulinumtoxinA injections (J0585), facility markup is **3.3** versus **2.8** in offices. For therapeutic activities (97530), facility is **3.6** versus **2.9** in offices.

This pattern reflects the structural difference in how Medicare pays for facility versus non-facility services. Facility fees are typically lower per-unit because the facility receives a separate payment for overhead and resources, while the professional component is billed separately. Providers may submit higher charges in facility settings partly because the payment methodology is more complex and the gap between list price and allowed amount is more predictable.

## What These Numbers Mean for Policy

The charge-to-payment ratio is not, by itself, a measure of waste or inappropriate billing. Medicare's fee schedule is set by statute and regulation, not by market negotiation, and providers are legally permitted to submit charges above the Medicare-allowed amount. The ratio reflects, in part, the fact that providers set their chargemasters to capture maximum reimbursement from commercial payers, and Medicare's fixed rates simply sit well below those levels.

That said, several policy-relevant observations emerge from this data:

**Anesthesia billing warrants continued scrutiny.** The concentration of the highest markup ratios in anesthesia-related specialties—across multiple credential types and billing categories—suggests that anesthesia billing practices deserve ongoing attention from CMS and oversight bodies. The scale of submitted charges relative to payments in this specialty is substantial.

**Drug and contrast agent markups are structurally complex.** The extreme ratios seen for contrast materials and certain injectable drugs reflect Medicare's bundling and payment methodology as much as provider pricing behavior. Policymakers working on drug payment reform should account for how payment bundling creates apparent markup anomalies that may not reflect actual provider revenue.

**Facility vs. office disparities persist.** The consistent pattern of higher markup ratios in facility settings reinforces longstanding concerns about site-of-service payment differentials. CMS has been moving toward site-neutral payment policies in some areas, and this data provides additional context for those efforts.

**Volume matters as much as ratio.** A specialty with a ratio of 5.38 and 1.9 billion services (Diagnostic Radiology) represents a far larger absolute gap than a specialty with a ratio of 12.22 and fewer than 1 million services (Anesthesiology Assistants). Policy interventions should weigh both dimensions.

## Key Takeaways

- **Anesthesia specialties carry the highest charge-to-payment ratios** in Medicare data, with Anesthesiology Assistants at 12.22 and CRNAs at 9.72—reflecting complex billing structures and the gap between chargemaster rates and Medicare's fixed fee schedule.

- **Emergency Medicine and Ambulatory Surgical Centers** show ratios above 6, representing hundreds of millions of services and tens of billions in submitted charges annually.

- **At the procedure level, contrast agents and certain injectable drugs** show extreme markup ratios—up to 120.7 for low osmolar contrast material in facility settings—driven largely by Medicare's payment bundling methodology rather than straightforward overcharging.

- **Routine evaluation and management codes** show more moderate ratios in the 3 to 4 range, representing the baseline markup for standard outpatient care.

- **Facility settings consistently show higher markup ratios** than office settings for the same procedure codes, reflecting site-of-service payment structure differences.

- **The absolute scale of the gap** between submitted charges and Medicare payments—tens of billions of dollars across major specialties—underscores why chargemaster reform and payment transparency remain active areas of healthcare policy debate.
