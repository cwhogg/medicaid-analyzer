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
      "Explore public health datasets with natural language queries powered by AI. Medicaid claims, BRFSS survey data, and more.",
    openGraph: {
      title: "Open Health Data Hub",
      description:
        "Query 230M+ rows of public health data in plain English. Medicaid provider spending, CDC BRFSS population health surveys — AI generates SQL and returns results with visualizations.",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Open Health Data Hub",
      description:
        "Query 230M+ rows of public health data in plain English. AI-powered natural language to SQL.",
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
