import { Pill, BarChart3, FlaskConical, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DatasetMeta {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  stats: { label: string; value: string }[];
  description: string;
  limitations: string[];
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
    limitations: [
      "Fee-for-service only (no managed care)",
      "No diagnosis or drug names",
      "Oct–Dec 2024 data incomplete",
    ],
    href: "/medicaid",
    accentColor: "#EA580C",
  },
  {
    key: "medicare",
    title: "Medicare Physician Spending",
    subtitle: "Part B Physician & Other Practitioner Payments",
    icon: Stethoscope,
    stats: [
      { label: "Rows", value: "~9.7M" },
      { label: "Year", value: "2023" },
      { label: "Providers", value: "1.2M" },
    ],
    description:
      "Analyze Medicare Part B fee-for-service physician spending by provider, specialty, procedure, state, and place of service.",
    limitations: [
      "Part B only (no hospital inpatient, Part C, or Part D)",
      "Providers with <11 beneficiaries per code excluded",
      "2023 data only (single year)",
    ],
    href: "/medicare",
    accentColor: "#10B981",
  },
  {
    key: "brfss",
    title: "BRFSS Health Survey",
    subtitle: "CDC Behavioral Risk Factor Survey",
    icon: BarChart3,
    stats: [
      { label: "Respondents", value: "~3.5M" },
      { label: "Years", value: "2014-2020, 2023" },
      { label: "Columns", value: "72" },
    ],
    description:
      "Explore population health trends, risk factors, chronic conditions, and demographics across all 50 states and DC over 8 survey years.",
    limitations: [
      "Self-reported survey data",
      "Phone-based sample",
      "2021-2022 not included",
      "Income categories changed in 2023",
    ],
    href: "/brfss",
    accentColor: "#0EA5E9",
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
    limitations: [
      "Single cycle (no time trends)",
      "No geographic identifiers (state/ZIP)",
      "Fasting labs available for subsample only",
      "~12K participants (smaller than BRFSS)",
    ],
    href: "/nhanes",
    accentColor: "#8B5CF6",
  },
];
