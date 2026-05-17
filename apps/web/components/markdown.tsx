import type { Components } from "react-markdown";

import ReactMarkdown from "react-markdown";

/**
 * Shared component map matching the styles from mdx-components.tsx.
 * Used by both MDX and react-markdown to ensure consistent typography.
 */
const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-8">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl md:text-2xl font-bold tracking-tight mt-14 mb-5">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold mt-10 mb-3 text-foreground/90">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-mono font-semibold text-foreground/70 mt-6 mb-2">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="text-base text-foreground/50 leading-relaxed mb-4">
      {children}
    </p>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside text-foreground/50 mb-4">
      {children}
    </ol>
  ),
  ul: ({ children }) => <ul className="list-none mb-4">{children}</ul>,
  li: ({ children }) => (
    <li className="ml-5 pl-2 mb-2 text-foreground/50 leading-relaxed">
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="text-foreground/80 font-semibold">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l border-neon/30 pl-6 my-8 text-foreground/40 italic">
      {children}
    </blockquote>
  ),
  hr: () => <div className="neon-line w-16 my-12" />,
  a: ({ href, children }) => (
    <a
      className="text-neon/60 hover:text-neon underline underline-offset-4 transition-colors duration-300"
      href={href}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      target={href?.startsWith("http") ? "_blank" : undefined}
    >
      {children}
    </a>
  ),
};

export function Markdown({ content }: { content: string }) {
  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}
