import { Pill, BarChart3, FlaskConical, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DatasetMeta {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  stats: { label: string; value: string }[];
  description: string;
  sampleAnalyses: string[];
  href: string;
  accentColor: string;
  comingSoon?: boolean;
}

export const DATASET_METAS: DatasetMeta[] = [
  {
    key: "medicaid",
    title: "Medicaid Provider Spending",
    subtitle: "CMS Fee-for-Service Claims",
    icon: Pill,
    stats: [
      { label: "Claims", value: "227M" },
      { label: "Period", value: "Jan 2018 – Sep 2024" },
      { label: "Providers", value: "614K" },
    ],
    description:
      "Analyze provider spending patterns across Medicaid fee-for-service claims. Explore by procedure code, provider, state, and time period.",
    sampleAnalyses: [
      "Which states spend the most on telehealth per capita?",
      "Top 10 highest-paid Medicaid providers nationwide",
      "How did COVID change procedure spending patterns?",
    ],
    href: "/medicaid",
    accentColor: "#B91C1C",
  },
  {
    key: "medicare",
    title: "Medicare Physician Spending",
    subtitle: "Part B Physician & Other Practitioner Payments",
    icon: Stethoscope,
    stats: [
      { label: "Rows", value: "~107M" },
      { label: "Period", value: "2013-2023" },
      { label: "Providers", value: "1.2M" },
    ],
    description:
      "Analyze Medicare Part B fee-for-service physician spending by provider, specialty, procedure, state, and place of service across 11 years.",
    sampleAnalyses: [
      "Which specialties have the biggest gap between charges and payments?",
      "How has opioid prescribing changed since 2015?",
      "Compare average cost per beneficiary by state and specialty",
    ],
    href: "/medicare",
    accentColor: "#0F766E",
  },
  {
    key: "brfss",
    title: "BRFSS Health Survey",
    subtitle: "CDC Behavioral Risk Factor Survey",
    icon: BarChart3,
    stats: [
      { label: "Respondents", value: "~4M" },
      { label: "Years", value: "2014-2020, 2023-2024" },
      { label: "Columns", value: "99" },
    ],
    description:
      "Explore population health trends, risk factors, chronic conditions, SDOH, ACEs, and demographics across all 50 states and DC over 9 survey years.",
    sampleAnalyses: [
      "Which states saw the biggest rise in obesity since 2014?",
      "How does childhood adversity (ACEs) correlate with depression?",
      "Diabetes rates by income level and race across all states",
    ],
    href: "/brfss",
    accentColor: "#1D4ED8",
  },
  {
    key: "nhanes",
    title: "NHANES Clinical Survey",
    subtitle: "National Health & Nutrition Examination Survey",
    icon: FlaskConical,
    stats: [
      { label: "Participants", value: "~12K" },
      { label: "Cycle", value: "2021-2023" },
      { label: "Lab Values", value: "94 vars" },
    ],
    description:
      "Explore clinical lab results, blood pressure, BMI, depression scores, and health questionnaires from a nationally representative in-person survey.",
    sampleAnalyses: [
      "What % of undiagnosed diabetics have normal A1C but elevated glucose?",
      "Average blood lead levels by age group and poverty status",
      "How does sleep duration relate to BMI, blood pressure, and depression?",
    ],
    href: "/nhanes",
    accentColor: "#7C3AED",
  },
];
