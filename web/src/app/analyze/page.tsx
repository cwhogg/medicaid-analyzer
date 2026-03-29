import dynamic from "next/dynamic";
import type { Metadata } from "next";

const UnifiedAnalyzePage = dynamic(
  () => import("@/components/analyze/UnifiedAnalyzePage"),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Analyze | Open Health Data Hub",
  description: "Ask questions about public health data across Medicaid, Medicare, BRFSS, NHANES, and more. AI-powered analysis with automatic dataset detection.",
};

export default function AnalyzePage() {
  return <UnifiedAnalyzePage />;
}
