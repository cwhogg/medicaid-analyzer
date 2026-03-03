"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  table: ({ children }) => (
    <div className="my-6 -mx-4 sm:mx-0 overflow-x-auto">
      <div className="px-4 sm:px-0 inline-block min-w-full">
        <table className="min-w-full text-sm border-collapse overflow-hidden border border-rule rounded-sm">
          {children}
        </table>
      </div>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[#F5F5F0]">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-[0.6875rem] font-bold text-foreground uppercase tracking-[0.1em] whitespace-nowrap border-t-2 border-b border-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-body border-t border-rule-light text-sm">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-[#F5F5F0] transition-colors">{children}</tr>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl sm:text-[1.65rem] font-headline font-bold text-foreground mt-10 mb-4">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg sm:text-xl font-headline font-bold text-foreground mt-8 mb-3">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-body leading-relaxed mb-4 font-serif">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-foreground font-semibold">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-teal hover:underline"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-4 space-y-1.5 text-body font-serif">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-body font-serif">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-body leading-relaxed marker:text-accent">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent pl-4 my-4 text-muted italic font-serif">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block text-sm font-mono text-[#44403C]">
          {children}
        </code>
      );
    }
    return (
      <code className="text-accent bg-[#F5F5F0] px-1.5 py-0.5 rounded-sm text-sm font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-[#F5F5F0] border border-rule-light rounded-sm p-4 my-4 overflow-x-auto">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-rule my-8" />,
};

export function BlogContent({ content }: { content: string }) {
  return (
    <div className="max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
