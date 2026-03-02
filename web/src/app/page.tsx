import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { DatasetCard } from "@/components/home/DatasetCard";
import { DATASET_METAS } from "@/lib/datasetMeta";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
              Explore Public Health Data
            </h1>
            <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
              Natural language queries across federal health datasets. Ask questions in plain English, get SQL-powered answers instantly.
            </p>
          </div>

          {/* Dataset Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {DATASET_METAS.map((meta) => (
              <DatasetCard key={meta.key} meta={meta} />
            ))}
          </div>

          {/* How it works */}
          <div className="glass-card p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-4">How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="text-accent font-mono text-sm font-bold mb-2">01</div>
                <h3 className="text-sm font-semibold text-white mb-1">Ask a question</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Type a question in plain English about any dataset.
                </p>
              </div>
              <div>
                <div className="text-accent font-mono text-sm font-bold mb-2">02</div>
                <h3 className="text-sm font-semibold text-white mb-1">AI generates SQL</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Claude translates your question into a precise SQL query.
                </p>
              </div>
              <div>
                <div className="text-accent font-mono text-sm font-bold mb-2">03</div>
                <h3 className="text-sm font-semibold text-white mb-1">See results</h3>
                <p className="text-xs text-muted leading-relaxed">
                  View tables, charts, and insights from real federal data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
