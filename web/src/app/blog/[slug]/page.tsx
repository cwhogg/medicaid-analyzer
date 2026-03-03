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
    frontmatter.description ||
    frontmatter.contentGap ||
    `Analysis of ${frontmatter.title.toLowerCase()} from 227M+ Medicaid claims records.`;
  const canonical =
    frontmatter.canonicalUrl ||
    `https://www.openhealthdatahub.com/blog/${params.slug}`;

  return {
    title: `${frontmatter.title} | Open Health Data Hub`,
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
    `https://www.openhealthdatahub.com/blog/${params.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: frontmatter.title,
    datePublished: frontmatter.date,
    author: {
      "@type": "Organization",
      name: "Open Health Data Hub",
      url: "https://www.openhealthdatahub.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Open Health Data Hub",
    },
    url: canonical,
    wordCount: frontmatter.wordCount,
    keywords: frontmatter.targetKeywords?.join(", "),
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-20 sm:pt-24 pb-12 sm:pb-16">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-teal transition-colors mb-6 sm:mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            All posts
          </Link>

          {/* Header */}
          <header className="mb-8 sm:mb-10">
            <div className="flex items-center gap-2 text-sm text-muted mb-3 sm:mb-4">
              <Calendar className="w-4 h-4 shrink-0" />
              <time dateTime={frontmatter.date}>
                {formatDate(frontmatter.date)}
              </time>
              {frontmatter.wordCount > 0 && (
                <>
                  <span className="text-rule">|</span>
                  <span>
                    {Math.ceil(frontmatter.wordCount / 250)} min read
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-bold text-foreground leading-tight">
              {frontmatter.title}
            </h1>
            {frontmatter.targetKeywords?.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3 sm:mt-4">
                {frontmatter.targetKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-sm bg-[#F5F5F0] text-muted border border-rule-light"
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
          <div className="mt-12 sm:mt-16 p-4 sm:p-6 rounded-sm card border-l-[3px] border-l-accent">
            <h3 className="text-base sm:text-lg font-headline font-semibold text-foreground mb-2">
              Explore the data yourself
            </h3>
            <p className="text-sm text-muted mb-4 font-serif">
              Run your own queries against 240M+ rows of federal health data
              using natural language — powered by AI.
            </p>
            <Link
              href="/analyze"
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
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
