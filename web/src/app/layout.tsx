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
    metadataBase: new URL("https://www.openhealthdatahub.com"),
    title: "Open Health Data Hub",
    description:
      "Explore Medicaid, Medicare, BRFSS, and NHANES datasets with natural language queries powered by AI. 240M+ rows of public health data.",
    openGraph: {
      title: "Open Health Data Hub",
      description:
        "Query 240M+ rows of public health data in plain English. Medicaid claims, Medicare physician spending, BRFSS surveys, NHANES clinical labs — AI generates SQL and returns results with visualizations.",
    },
    twitter: {
      card: "summary_large_image",
      title: "Open Health Data Hub",
      description:
        "Query 240M+ rows of public health data in plain English. Medicaid, Medicare, BRFSS, NHANES — AI-powered natural language to SQL.",
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
