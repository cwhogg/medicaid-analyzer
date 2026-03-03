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

        {/* Dataset highlights */}
        <section className="max-w-[1080px] mx-auto px-4 sm:px-8">
          <div className="section-label">Available Datasets</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DATASET_METAS.map((meta) => (
              <DatasetCard key={meta.key} meta={meta} />
            ))}
          </div>
        </section>

        <LiveDemo />
        <Features />
      </main>
      <Footer />
    </>
  );
}
