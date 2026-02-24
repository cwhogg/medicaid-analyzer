import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { GlassCard } from "@/components/ui/GlassCard";
import { getAllPosts } from "@/lib/content";
import { Calendar, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Medicaid Spending Analysis Blog | Medicaid Claims Analyzer",
  description:
    "Data-driven analysis of Medicaid provider spending trends, top procedures, state comparisons, and more — powered by 227M+ claims records.",
  openGraph: {
    title: "Medicaid Spending Analysis Blog",
    description:
      "Data-driven analysis of Medicaid provider spending trends, top procedures, state comparisons, and more.",
  },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getExcerpt(content: string, maxLength = 160): string {
  const plain = content
    .replace(/^#+\s.*/gm, "")
    .replace(/\|.*\|/g, "")
    .replace(/[*_`#\[\]]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).replace(/\s\S*$/, "") + "...";
}

export default function BlogListPage() {
  const posts = getAllPosts("blog");

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Medicaid Spending Analysis
            </h1>
            <p className="text-lg text-muted max-w-2xl">
              Data-driven insights from 227 million Medicaid claims records
              spanning 2018&ndash;2024, covering $1+ trillion in provider
              spending.
            </p>
          </div>

          {posts.length === 0 ? (
            <GlassCard>
              <div className="p-8 text-center">
                <p className="text-muted">
                  No posts yet. Check back soon for data-driven Medicaid
                  spending analysis.
                </p>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`}>
                  <GlassCard className="hover:bg-white/[0.06] transition-colors cursor-pointer">
                    <div className="p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-dark mb-3">
                        <Calendar className="w-4 h-4" />
                        <time dateTime={post.frontmatter.date}>
                          {formatDate(post.frontmatter.date)}
                        </time>
                        {post.frontmatter.wordCount > 0 && (
                          <>
                            <span className="text-white/20">|</span>
                            <span>
                              {Math.ceil(post.frontmatter.wordCount / 250)} min
                              read
                            </span>
                          </>
                        )}
                      </div>
                      <h2 className="text-xl font-semibold text-white mb-2 group-hover:text-accent transition-colors">
                        {post.frontmatter.title}
                      </h2>
                      <p className="text-muted text-sm leading-relaxed mb-4">
                        {post.frontmatter.description ||
                          getExcerpt(post.content)}
                      </p>
                      <div className="flex items-center gap-4">
                        <span className="text-accent text-sm font-medium flex items-center gap-1">
                          Read analysis <ArrowRight className="w-4 h-4" />
                        </span>
                        {post.frontmatter.targetKeywords?.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {post.frontmatter.targetKeywords
                              .slice(0, 3)
                              .map((kw) => (
                                <span
                                  key={kw}
                                  className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-muted-dark"
                                >
                                  {kw}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
