'use client';

import { useState, type ReactNode } from 'react';

type TabKey = 'calculator' | 'theory' | 'examples';

interface CalcTabsProps {
  calculator: ReactNode;
  theory: ReactNode;
  examples: ReactNode;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'calculator', label: 'Calculator' },
  { key: 'theory', label: 'Theory' },
  { key: 'examples', label: 'Examples' },
];

export function CalcTabs({ calculator, theory, examples }: CalcTabsProps) {
  const [active, setActive] = useState<TabKey>('calculator');

  const content = active === 'calculator' ? calculator : active === 'theory' ? theory : examples;

  return (
    <div>
      <div className="border-b border-slate-200 dark:border-slate-800 mb-6">
        <nav className="flex gap-1" aria-label="Calculator sections">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className={
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
                  (isActive
                    ? 'border-accent-600 text-accent-600 dark:text-accent-400 dark:border-accent-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200')
                }
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div>{content}</div>
    </div>
  );
}
