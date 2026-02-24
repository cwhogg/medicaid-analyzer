import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BlogContent } from "@/components/blog/BlogContent";
import { getAllPosts, getPostBySlug } from "@/lib/content";
import { Calendar, ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  const posts = getAllPosts("blog");
  return posts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getPostBySlug("blog", params.slug);
  if (!post) return { title: "Post Not Found" };

  const { frontmatter } = post;
  const description =
    frontmatter.contentGap ||
    `Analysis of ${frontmatter.title.toLowerCase()} from 227M+ Medicaid claims records.`;
  const canonical =
    frontmatter.canonicalUrl ||
    `https://medicaid-analyzer.vercel.app/blog/${params.slug}`;

  return {
    title: `${frontmatter.title} | Medicaid Claims Analyzer`,
    description,
    keywords: frontmatter.targetKeywords,
    alternates: { canonical },
    openGraph: {
      title: frontmatter.title,
      description,
      type: "article",
      publishedTime: frontmatter.date,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: frontmatter.title,
      description,
    },
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPostPage({ params }: Props) {
  const post = getPostBySlug("blog", params.slug);
  if (!post) notFound();

  const { frontmatter, content } = post;
  const canonical =
    frontmatter.canonicalUrl ||
    `https://medicaid-analyzer.vercel.app/blog/${params.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: frontmatter.title,
    datePublished: frontmatter.date,
    author: {
      "@type": "Organization",
      name: "Medicaid Claims Analyzer",
      url: "https://medicaid-analyzer.vercel.app",
    },
    publisher: {
      "@type": "Organization",
      name: "Medicaid Claims Analyzer",
    },
    url: canonical,
    wordCount: frontmatter.wordCount,
    keywords: frontmatter.targetKeywords?.join(", "),
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-24 pb-16">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            All posts
          </Link>

          {/* Header */}
          <header className="mb-10">
            <div className="flex items-center gap-2 text-sm text-muted-dark mb-4">
              <Calendar className="w-4 h-4" />
              <time dateTime={frontmatter.date}>
                {formatDate(frontmatter.date)}
              </time>
              {frontmatter.wordCount > 0 && (
                <>
                  <span className="text-white/20">|</span>
                  <span>
                    {Math.ceil(frontmatter.wordCount / 250)} min read
                  </span>
                </>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
              {frontmatter.title}
            </h1>
            {frontmatter.targetKeywords?.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-4">
                {frontmatter.targetKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] text-muted-dark border border-white/[0.08]"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Content */}
          <BlogContent content={content} />

          {/* CTA */}
          <div className="mt-16 p-6 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <h3 className="text-lg font-semibold text-white mb-2">
              Explore the data yourself
            </h3>
            <p className="text-sm text-muted mb-4">
              Run your own queries against 227M+ Medicaid claims records using
              natural language — powered by AI.
            </p>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Start analyzing <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
