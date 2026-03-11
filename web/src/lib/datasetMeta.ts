import { Pill, BarChart3, FlaskConical, Stethoscope, Building2, Users, Tablets } from "lucide-react";
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
    title: "Medicare Outpatient Spend",
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
    key: "medicare-inpatient",
    title: "Medicare Inpatient Spend",
    subtitle: "Part A Hospital Discharges by DRG",
    icon: Building2,
    stats: [
      { label: "Rows", value: "~2M" },
      { label: "Period", value: "2013-2023" },
      { label: "Hospitals", value: "3,000+" },
    ],
    description:
      "Analyze Medicare Part A inpatient hospital spending by hospital, DRG, state, and year. Compare hospital charges, Medicare payments, and beneficiary costs across 3,000+ IPPS hospitals.",
    sampleAnalyses: [
      "Which hospitals charge the most for hip replacement (DRG 470)?",
      "Top 10 most expensive DRGs by total Medicare spending",
      "How did COVID-19 change inpatient hospital spending in 2020?",
    ],
    href: "/medicare-inpatient",
    accentColor: "#0D9488",
  },
  {
    key: "medicare-partd",
    title: "Medicare Part D Prescriptions",
    subtitle: "Part D Prescribers by Provider & Drug",
    icon: Tablets,
    stats: [
      { label: "Rows", value: "~276M" },
      { label: "Period", value: "2013-2023" },
      { label: "Prescribers", value: "1.2M+" },
    ],
    description:
      "Analyze Medicare Part D prescription drug spending by prescriber, drug, specialty, state, and year. Compare brand vs generic costs, track opioid trends, and identify top-prescribed medications.",
    sampleAnalyses: [
      "What are the top 10 most prescribed drugs in Medicare?",
      "How has opioid prescribing changed since 2013?",
      "Which specialties prescribe the most expensive drugs?",
    ],
    href: "/medicare-partd",
    accentColor: "#14B8A6",
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
  {
    key: "dac",
    title: "Clinician Directory",
    subtitle: "CMS Doctors and Clinicians",
    icon: Users,
    stats: [
      { label: "Records", value: "~2.8M" },
      { label: "Updated", value: "Feb 2026" },
      { label: "Unique NPIs", value: "1.5M" },
    ],
    description:
      "Look up any Medicare-enrolled clinician by NPI, specialty, location, or group practice. Analyze workforce distribution, telehealth adoption, and specialty demographics.",
    sampleAnalyses: [
      "How many cardiologists are in each state?",
      "What is the gender breakdown across surgical specialties?",
      "Which medical schools produce the most active clinicians?",
    ],
    href: "/dac",
    accentColor: "#EC4899",
  },
];
