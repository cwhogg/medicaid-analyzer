"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  table: ({ children }) => (
    <div className="my-6 -mx-4 sm:mx-0 overflow-x-auto">
      <div className="inline-block min-w-full align-middle sm:px-0 px-4">
        <table className="min-w-full text-sm border-collapse rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-white/[0.06]">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-[#9CA3AF] border-t border-white/[0.06] whitespace-nowrap">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-white/[0.03] transition-colors">{children}</tr>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl sm:text-[1.65rem] font-bold text-white mt-10 mb-4 font-sans">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl sm:text-lg font-bold text-white mt-8 mb-3 font-sans">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-[#9CA3AF] leading-relaxed mb-4">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-accent hover:underline"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-4 space-y-1.5 text-[#9CA3AF]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-[#9CA3AF]">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-[#9CA3AF] leading-relaxed marker:text-accent">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent pl-4 my-4 text-muted italic">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block text-sm font-mono text-[#9CA3AF]">
          {children}
        </code>
      );
    }
    return (
      <code className="text-accent bg-white/[0.05] px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 my-4 overflow-x-auto">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-white/[0.08] my-8" />,
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
