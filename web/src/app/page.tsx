import dynamic from "next/dynamic";
import { Navbar } from "@/components/layout/Navbar";
import { Features } from "@/components/landing/Features";
import { DataScope } from "@/components/landing/DataScope";
import { Footer } from "@/components/layout/Footer";

const Hero = dynamic(() => import("@/components/landing/Hero").then((m) => ({ default: m.Hero })), {
  ssr: false,
});

const LiveDemo = dynamic(() => import("@/components/landing/LiveDemo").then((m) => ({ default: m.LiveDemo })), {
  ssr: false,
});

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <Hero />
        <Features />
        <DataScope />
        <LiveDemo />
      </main>
      <Footer />
    </>
  );
}
