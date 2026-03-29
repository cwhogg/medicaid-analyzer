"use client";

import Link from "next/link";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

/* ---------- hardcoded but realistic data ---------- */

const medicaidData = [
  { year: "2019", claims: 2.1 },
  { year: "2020", claims: 8.4 },
  { year: "2021", claims: 14.7 },
  { year: "2022", claims: 12.3 },
  { year: "2023", claims: 11.8 },
];

const medicareData = [
  { specialty: "Ophthalmology", ratio: 3.8 },
  { specialty: "Dermatology", ratio: 3.5 },
  { specialty: "Cardiology", ratio: 3.2 },
  { specialty: "Orthopedics", ratio: 2.9 },
  { specialty: "Radiology", ratio: 2.7 },
];

const brfssData = [
  { year: "2014", rate: 29.5 },
  { year: "2015", rate: 30.0 },
  { year: "2016", rate: 30.1 },
  { year: "2017", rate: 30.8 },
  { year: "2018", rate: 31.3 },
  { year: "2019", rate: 31.9 },
  { year: "2020", rate: 32.4 },
  { year: "2023", rate: 34.1 },
  { year: "2024", rate: 34.8 },
];

const nhanesData = [
  { age: "20-39", systolic: 117 },
  { age: "40-59", systolic: 127 },
  { age: "60+", systolic: 136 },
];

/* ---------- accent colors (match datasetMeta) ---------- */

const ACCENTS: Record<string, string> = {
  medicaid: "#B91C1C",
  medicare: "#0F766E",
  brfss: "#1D4ED8",
  nhanes: "#7C3AED",
};

/* ---------- shared tooltip ---------- */

function MiniTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-rule rounded-sm px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-body">
        {payload[0].value.toLocaleString()}
        {suffix}
      </p>
    </div>
  );
}

/* ---------- individual mini-charts ---------- */

function MedicaidChart() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={medicaidData} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
        <XAxis dataKey="year" stroke="#78716C" fontSize={11} tickLine={false} />
        <YAxis
          stroke="#78716C"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={32}
          tickFormatter={(v) => `${v}M`}
        />
        <Tooltip content={<MiniTooltip suffix="M claims" />} />
        <Bar dataKey="claims" radius={[2, 2, 0, 0]}>
          {medicaidData.map((_, i) => (
            <Cell key={i} fill={i === 0 ? "#D6D3D1" : ACCENTS.medicaid} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MedicareChart() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={medicareData} layout="vertical" barSize={16}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" horizontal={false} />
        <XAxis type="number" stroke="#78716C" fontSize={11} tickLine={false} domain={[0, 4.5]} tickFormatter={(v) => `${v}x`} />
        <YAxis type="category" dataKey="specialty" stroke="#78716C" fontSize={10} tickLine={false} width={80} />
        <Tooltip content={<MiniTooltip suffix="x markup" />} />
        <Bar dataKey="ratio" fill={ACCENTS.medicare} radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BRFSSChart() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={brfssData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
        <XAxis dataKey="year" stroke="#78716C" fontSize={11} tickLine={false} />
        <YAxis stroke="#78716C" fontSize={11} tickLine={false} axisLine={false} width={32} domain={[28, 36]} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<MiniTooltip suffix="%" />} />
        <Line type="monotone" dataKey="rate" stroke={ACCENTS.brfss} strokeWidth={2} dot={{ r: 3, fill: ACCENTS.brfss }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function NHANESChart() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={nhanesData} barSize={36}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
        <XAxis dataKey="age" stroke="#78716C" fontSize={11} tickLine={false} />
        <YAxis stroke="#78716C" fontSize={11} tickLine={false} axisLine={false} width={32} domain={[100, 145]} />
        <Tooltip content={<MiniTooltip suffix=" mmHg" />} />
        <Bar dataKey="systolic" fill={ACCENTS.nhanes} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------- card data ---------- */

interface SampleCard {
  dataset: string;
  label: string;
  question: string;
  href: string;
  chart: React.ReactNode;
}

const CARDS: SampleCard[] = [
  {
    dataset: "medicaid",
    label: "Medicaid",
    question: "How did telehealth spending change after COVID?",
    href: "/analyze?q=How+did+telehealth+spending+change+after+COVID%3F",
    chart: <MedicaidChart />,
  },
  {
    dataset: "medicare",
    label: "Medicare",
    question: "Which specialties have the biggest charge-to-payment gap?",
    href: "/analyze?q=Which+specialties+have+the+biggest+charge-to-payment+gap%3F",
    chart: <MedicareChart />,
  },
  {
    dataset: "brfss",
    label: "BRFSS",
    question: "How have obesity rates changed over the past decade?",
    href: "/analyze?q=How+have+obesity+rates+changed+over+the+past+decade%3F",
    chart: <BRFSSChart />,
  },
  {
    dataset: "nhanes",
    label: "NHANES",
    question: "How does blood pressure vary by age group?",
    href: "/analyze?q=How+does+blood+pressure+vary+by+age+group%3F",
    chart: <NHANESChart />,
  },
];

/* ---------- main component ---------- */

export function SampleAnalyses() {
  return (
    <section className="max-w-[1080px] mx-auto px-4 sm:px-8">
      <div className="section-label">Sample Analyses</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CARDS.map((card) => (
          <Link key={card.dataset} href={card.href} className="block group">
            <div className="card p-5 sm:p-6 h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-rule">
              {/* Dataset tag */}
              <span
                className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase"
                style={{ color: ACCENTS[card.dataset] }}
              >
                {card.label}
              </span>

              {/* Question */}
              <h3 className="font-headline text-[1.0625rem] font-bold text-foreground leading-tight mt-1.5 mb-4">
                {card.question}
              </h3>

              {/* Chart */}
              <div className="mb-3">{card.chart}</div>

              {/* CTA */}
              <div
                className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
                style={{ color: ACCENTS[card.dataset] }}
              >
                Try this
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                  &rarr;
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
