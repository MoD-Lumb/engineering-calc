'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Search } from 'lucide-react';
import { categories } from '@/lib/categories';
import { calculators } from '@/calculators';
import type { CategorySlug } from '@/lib/types';

const STORAGE_KEY = 'ec-sidebar';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  }, [collapsed, mounted]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.map((cat) => ({
      category: cat,
      items: calculators
        .filter((c) => c.meta.category === cat.slug)
        .filter((c) => !q || c.meta.name.toLowerCase().includes(q) || c.meta.slug.includes(q)),
    }));
  }, [query]);

  function toggle(slug: CategorySlug) {
    setCollapsed((s) => ({ ...s, [slug]: !s[slug] }));
  }

  const isFiltering = query.trim().length > 0;

  return (
    <>
      {open && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/40"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={
          'fixed md:sticky top-14 z-20 h-[calc(100vh-3.5rem)] w-72 shrink-0 ' +
          'border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0c0e] ' +
          'overflow-y-auto transition-transform md:translate-x-0 ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
        aria-label="Sidebar"
      >
        <div className="p-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              placeholder="Search calculators…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-transparent pl-8 pr-2 py-1.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
        </div>
        <nav className="px-2 pb-6">
          {grouped.map(({ category, items }) => {
            const isCollapsed = !isFiltering && collapsed[category.slug];
            return (
              <div key={category.slug} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggle(category.slug)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                >
                  <ChevronRight
                    size={12}
                    className={'transition-transform ' + (isCollapsed ? '' : 'rotate-90')}
                  />
                  <span className="truncate">{category.name}</span>
                </button>
                {!isCollapsed && (
                  <ul className="ml-2 border-l border-slate-200 dark:border-slate-800">
                    {items.length === 0 && (
                      <li className="px-3 py-1 text-xs text-slate-400">No matches</li>
                    )}
                    {items.map((c) => {
                      const href = `/${c.meta.category}/${c.meta.slug}`;
                      const active = pathname === href || pathname === href + '/';
                      return (
                        <li key={c.meta.slug}>
                          <Link
                            href={href}
                            onClick={onClose}
                            className={
                              'flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-r-md transition-colors ' +
                              (active
                                ? 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800')
                            }
                          >
                            <span className="truncate">{c.meta.name}</span>
                            {c.meta.status === 'wip' && (
                              <span className="shrink-0 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                WIP
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
