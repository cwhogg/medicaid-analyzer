import { MessageSquare, Layers, BarChart3 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const features = [
  {
    icon: MessageSquare,
    title: "Natural Language Queries",
    description:
      "Ask questions in plain English. AI converts your question into optimized SQL, executes it against 227M rows, and returns results in seconds.",
    example: '"What are the top 10 services by total spending?"',
  },
  {
    icon: Layers,
    title: "Deep Analysis",
    description:
      "Multi-step investigations powered by AI. The analyst plans a research approach, executes queries in sequence, and synthesizes findings into a comprehensive answer.",
    example: "Works like a human analyst — each step builds on prior results",
  },
  {
    icon: BarChart3,
    title: "Interactive Visualizations",
    description:
      "Results are automatically visualized as tables, line charts, bar charts, or pie charts. Drill into provider detail pages for spending breakdowns and trends.",
    example: "Click any provider name to see their full profile",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            How It Works
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto">
            From quick lookups to multi-step investigations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <GlassCard
              key={feature.title}
              hover
              className="p-5 sm:p-8 animate-fade-in-up"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-muted leading-relaxed mb-4">
                {feature.description}
              </p>
              <p className="text-sm text-muted-dark italic">
                {feature.example}
              </p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
