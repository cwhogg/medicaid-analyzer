import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import { Playfair_Display, Lora, Merriweather, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-merriweather",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
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
    <html lang="en">
      <body
        className={`${playfair.variable} ${lora.variable} ${merriweather.variable} ${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
