import { Pill, BarChart3, FlaskConical } from "lucide-react";
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
    key: "brfss",
    title: "BRFSS Health Survey",
    subtitle: "CDC Behavioral Risk Factor Survey",
    icon: BarChart3,
    stats: [
      { label: "Respondents", value: "433K" },
      { label: "Survey year", value: "2023" },
      { label: "Columns", value: "350" },
    ],
    description:
      "Explore population health behaviors, risk factors, chronic conditions, and demographics across all 50 states and DC.",
    limitations: [
      "Self-reported survey data",
      "Phone-based sample",
      "2023 only (single year)",
    ],
    href: "/brfss",
    accentColor: "#0EA5E9",
  },
  {
    key: "nhanes",
    title: "NHANES",
    subtitle: "National Health & Nutrition Survey",
    icon: FlaskConical,
    stats: [
      { label: "Participants", value: "—" },
      { label: "Period", value: "—" },
    ],
    description:
      "Lab results, physical exams, dietary intake, and demographics from nationally representative samples.",
    limitations: [],
    href: "#",
    accentColor: "#8B5CF6",
    comingSoon: true,
  },
];
