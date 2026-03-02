import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { DatasetCard } from "@/components/home/DatasetCard";
import { DATASET_METAS } from "@/lib/datasetMeta";
import dynamic from "next/dynamic";

const LiveDemo = dynamic(
  () => import("@/components/landing/LiveDemo").then((m) => m.LiveDemo),
  { ssr: false }
);

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <Hero />
        <Features />

        {/* Dataset highlights */}
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Available Datasets
              </h2>
              <p className="mt-4 text-muted max-w-xl mx-auto">
                Federal health data from CMS, CDC, and NIH — ready to query
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DATASET_METAS.map((meta) => (
                <DatasetCard key={meta.key} meta={meta} />
              ))}
            </div>
          </div>
        </section>

        <LiveDemo />
      </main>
      <Footer />
    </>
  );
}
