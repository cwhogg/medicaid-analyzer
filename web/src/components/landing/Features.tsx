import { MessageSquare, Zap, BarChart3 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const features = [
  {
    icon: MessageSquare,
    title: "Natural Language Queries",
    description:
      "Ask questions in plain English. AI converts your question into optimized SQL and returns results instantly.",
    example: '"What are the top 10 procedure codes by spending in 2024?"',
  },
  {
    icon: Zap,
    title: "Browser-Native SQL Engine",
    description:
      "DuckDB-WASM runs entirely in your browser. No data leaves your machine — fast, private, and secure.",
    example: "Powered by DuckDB-WASM with pre-aggregated Parquet files",
  },
  {
    icon: BarChart3,
    title: "Interactive Visualizations",
    description:
      "Results are automatically visualized as tables, line charts, bar charts, or pie charts based on your query.",
    example: "AI selects the best chart type for your data",
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
            Three powerful capabilities in one simple interface
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <GlassCard
              key={feature.title}
              hover
              className="p-8 animate-fade-in-up"
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
