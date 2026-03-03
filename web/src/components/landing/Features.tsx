import { MessageSquare, Layers, BarChart3 } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Ask a Question",
    description:
      "Type a question in plain English about any dataset. No SQL knowledge required — just ask what you want to know about Medicaid spending, Medicare services, or population health trends.",
  },
  {
    number: "02",
    icon: Layers,
    title: "AI Generates SQL",
    description:
      "Claude translates your question into a precise DuckDB query and executes it against raw federal data. The generated SQL is shown so you can verify exactly what was queried.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "See Results",
    description:
      "View tables, charts, and AI-generated insights from your query. Export results to CSV, refine with follow-up questions, or explore the data from a different angle.",
  },
];

export function Features() {
  return (
    <section id="features" className="max-w-[1080px] mx-auto px-4 sm:px-8">
      <div className="section-label">How It Works</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-2">
        {steps.map((step) => (
          <div key={step.number}>
            <div className="font-headline text-[2rem] font-normal text-rule leading-none mb-1">
              {step.number}
            </div>
            <div className="text-[0.9375rem] font-bold text-foreground tracking-wide mb-2.5 pb-2.5 border-b border-rule-light">
              {step.title}
            </div>
            <p className="font-serif text-[0.875rem] text-body leading-[1.7]">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
