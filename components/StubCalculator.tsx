'use client';

import { Construction } from 'lucide-react';

export function StubCalculator({ description }: { description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
      <Construction className="mx-auto mb-3 text-amber-500" size={28} />
      <h3 className="font-medium mb-1">Coming soon</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{description}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
        Check the <span className="font-medium">Theory</span> tab to preview the planned formula.
      </p>
    </div>
  );
}
