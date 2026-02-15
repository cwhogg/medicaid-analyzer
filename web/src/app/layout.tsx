import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL("https://medicaid-analyzer.vercel.app"),
    title: "Medicaid Claims Analyzer",
    description:
      "Explore 227M+ rows of Medicaid provider spending data with natural language queries powered by AI.",
    openGraph: {
      title: "Medicaid Claims Analyzer",
      description:
        "Query $1+ trillion in Medicaid provider spending across 617K+ providers. Ask questions in plain English — AI generates SQL and returns results with visualizations.",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Medicaid Claims Analyzer",
      description:
        "Query $1+ trillion in Medicaid provider spending across 617K+ providers. AI-powered natural language to SQL.",
      images: ["/og.png"],
    },
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
