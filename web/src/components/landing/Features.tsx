import { MessageSquare, Layers, BarChart3 } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Ask a Question",
    description:
      "Type a question in plain English — no need to pick a dataset. AI automatically identifies which of the seven datasets to query, including cross-dataset questions that span multiple sources.",
  },
  {
    number: "02",
    icon: Layers,
    title: "AI Generates SQL",
    description:
      "Claude identifies the right dataset, builds an analysis plan, and generates precise DuckDB SQL — including cross-dataset JOINs when your question spans multiple sources.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "See Results",
    description:
      "View tables, charts, and AI-generated insights from your query. Cross-dataset results are synthesized into a single narrative. Export to CSV or refine with follow-ups.",
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
