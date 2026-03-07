import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedResultView } from "@/components/analyze/SharedResultView";

interface ShareData {
  question: string;
  dataset: string;
  type: "query" | "analysis";
  sql?: string;
  columns?: string[];
  rows?: unknown[][];
  totalRows?: number;
  plan?: string[];
  steps?: {
    stepIndex: number;
    title: string;
    sql: string | null;
    chartType: string;
    columns: string[];
    rows: unknown[][];
    totalRows?: number;
    insight: string | null;
    error: string | null;
  }[];
  summary?: string | null;
  timestamp: number;
}

async function fetchShareData(id: string): Promise<ShareData | null> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/share/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });

    if (!response.ok) return null;

    const json = await response.json();
    return json.data as ShareData;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchShareData(id);

  if (!data) {
    return { title: "Share Not Found | Open Health Data Hub" };
  }

  const datasetLabel = data.dataset?.toUpperCase() || "DATA";
  const description = data.summary
    ? data.summary.slice(0, 160)
    : `${datasetLabel} analysis: ${data.question}`;

  return {
    title: `${data.question} | Open Health Data Hub`,
    description,
    openGraph: {
      title: data.question,
      description,
      siteName: "Open Health Data Hub",
    },
    twitter: {
      card: "summary",
      title: data.question,
      description,
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchShareData(id);

  if (!data) {
    notFound();
  }

  return <SharedResultView data={data} shareId={id} />;
}
