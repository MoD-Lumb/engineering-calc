import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';
import { Formula } from '@/components/Formula';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Formula,
    h1: (props: ComponentProps<'h1'>) => (
      <h1 className="text-xl font-semibold tracking-tight mt-4 mb-3" {...props} />
    ),
    h2: (props: ComponentProps<'h2'>) => (
      <h2 className="text-lg font-semibold tracking-tight mt-6 mb-2" {...props} />
    ),
    h3: (props: ComponentProps<'h3'>) => (
      <h3 className="text-base font-semibold mt-4 mb-2" {...props} />
    ),
    p: (props: ComponentProps<'p'>) => (
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 my-3" {...props} />
    ),
    ul: (props: ComponentProps<'ul'>) => (
      <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-300 my-3" {...props} />
    ),
    ol: (props: ComponentProps<'ol'>) => (
      <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-300 my-3" {...props} />
    ),
    li: (props: ComponentProps<'li'>) => <li className="leading-relaxed" {...props} />,
    table: (props: ComponentProps<'table'>) => (
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse" {...props} />
      </div>
    ),
    thead: (props: ComponentProps<'thead'>) => (
      <thead
        className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40"
        {...props}
      />
    ),
    th: (props: ComponentProps<'th'>) => (
      <th className="text-left px-3 py-2 font-medium border-b border-slate-200 dark:border-slate-800" {...props} />
    ),
    td: (props: ComponentProps<'td'>) => (
      <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60" {...props} />
    ),
    code: (props: ComponentProps<'code'>) => (
      <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-xs" {...props} />
    ),
    blockquote: (props: ComponentProps<'blockquote'>) => (
      <blockquote
        className="border-l-2 border-accent-400 pl-3 my-3 text-sm text-slate-600 dark:text-slate-400 italic"
        {...props}
      />
    ),
    ...components,
  };
}
