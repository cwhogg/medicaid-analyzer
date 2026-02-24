"use client";

import ReactMarkdown from "react-markdown";

export function BlogContent({ content }: { content: string }) {
  return (
    <div
      className="prose prose-invert max-w-none
        prose-headings:font-sans prose-headings:text-white prose-headings:font-bold
        prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
        prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
        prose-p:text-[#9CA3AF] prose-p:leading-relaxed
        prose-a:text-accent prose-a:no-underline hover:prose-a:underline
        prose-strong:text-white prose-strong:font-semibold
        prose-code:text-accent prose-code:bg-white/[0.05] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
        prose-pre:bg-white/[0.05] prose-pre:border prose-pre:border-white/[0.08] prose-pre:rounded-xl
        prose-blockquote:border-accent prose-blockquote:text-muted
        prose-li:text-[#9CA3AF] prose-li:marker:text-accent
        prose-hr:border-white/[0.08]
        prose-img:rounded-xl
        prose-table:text-sm
        prose-th:text-white prose-th:font-semibold prose-th:bg-white/[0.05] prose-th:px-4 prose-th:py-2 prose-th:text-left
        prose-td:text-[#9CA3AF] prose-td:px-4 prose-td:py-2 prose-td:border-t prose-td:border-white/[0.08]
      "
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
