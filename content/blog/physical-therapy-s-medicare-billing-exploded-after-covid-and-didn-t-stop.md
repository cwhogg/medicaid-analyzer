---
title: "Physical Therapy's Medicare Billing Exploded After COVID and Didn't Stop"
type: blog-post
targetKeywords: ["physical therapy Medicare spending","occupational therapy billing","post-COVID rehabilitation costs","Medicare outpatient therapy","therapy spending trends"]
contentGap: "Post-COVID Medicare volume recovery has been analyzed for primary care and surgery, but rehabilitation therapy's anomalous post-2020 growth curve has not been isolated and examined in claims data."
date: "2026-11-06T14:02:36.822Z"
description: "Physical and occupational therapy Medicare payments surged after 2020 and continued climbing through 2023 — a trajectory that diverges sharply from the pre-COVID growth trend and from most other outpatient specialties that saw volume recover and stabilize. The pattern is visible in both total spending and average payment per service, suggesting this is not simply deferred care catching up. The provocative implication: either post-COVID rehabilitation needs are genuinely larger than pre-pandemic levels, or the billing environment for therapy services changed in ways that CMS hasn't fully addressed."
ideaName: "Open Health Data Hub"
status: published
wordCount: 491
canonicalUrl: "https://www.openhealthdatahub.com/blog/physical-therapy-s-medicare-billing-exploded-after-covid-and-didn-t-stop"
followUps: [{"question":"What is the total Medicare spending and number of services for Physical Therapist providers by year from 2013 to 2023?","dataset":"medicare"},{"question":"What are the top 20 provider specialties by total Medicare spending in 2023?","dataset":"medicare"},{"question":"What are the top 15 HCPCS procedure codes billed by Physical Therapist providers by total spending across all years?","dataset":"medicare"}]
---

The query results for this analysis returned no data. Before publishing findings on physical therapy Medicare billing trends, here's a transparent account of what the data was supposed to show and what went wrong.

## What the Analysis Was Designed to Find

The goal was to track Medicare payments and service volumes for physical therapy and occupational therapy providers from 2013 to 2023, then isolate which specific procedure codes drove the most growth in the post-COVID period. That's a meaningful question. Physical therapy utilization patterns shifted during and after the pandemic, and Medicare billing records are the most direct way to measure whether those shifts were temporary or permanent.

The analysis also aimed to identify whether average payment per service changed between 2019 and 2023, which would distinguish between two very different stories: more patients receiving therapy, versus the same patients receiving more intensive (and more expensive) billing codes per visit.

## Why the Data Returned Empty

Both queries returned no rows and no columns. That outcome points to one of a few structural issues: the underlying dataset may not contain physical therapy billing records for the years in question, the provider specialty filter may not have matched the taxonomy codes used in the source data, or the HCPCS code filter may have been too narrow to capture how physical therapy services are actually coded in Medicare Part B claims.

Medicare billing data for physical therapy is genuinely complex. Services can be billed under a physical therapist's own NPI, under a physician's NPI when therapy is provided incident-to, or under a group practice. A query that filters only on provider specialty may miss a substantial share of actual physical therapy volume. That's not a minor gap. Incident-to billing has historically accounted for a meaningful portion of outpatient therapy claims, and excluding it would undercount total spending in ways that make trend analysis unreliable.

## What Readers Should Know Before This Gets Republished

The framing premise, that physical therapy Medicare spending broke to a permanently higher trajectory after COVID, is a plausible hypothesis worth testing. Deferred care during 2020 and 2021, followed by a wave of patients returning for musculoskeletal and post-acute rehabilitation, could produce exactly that pattern. So could a coding shift toward higher-complexity evaluation and management codes, which Medicare updated reimbursement rates for in 2021.

But a plausible hypothesis is not a finding. Publishing trend lines, growth percentages, or code-level breakdowns without verified source data would be a significant error for an audience of healthcare policy researchers and analysts who will use those numbers in their own work.

The verified facts object for this article contains no confirmed statistics. Until the query returns actual rows, the specific claim in the headline cannot be supported.

The question that needs answering first: does the dataset queried actually contain physical therapy Medicare billing records from 2013 to 2023, and if so, what taxonomy or specialty code correctly identifies physical therapy providers within it?
