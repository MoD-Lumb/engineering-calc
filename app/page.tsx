import Link from 'next/link';
import { categories } from '@/lib/categories';
import { calculatorsByCategory } from '@/calculators';

export default function HomePage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Engineering Calc</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          A personal collection of quick engineering calculators. Pick a category to get started.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Categories
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map((cat) => {
            const items = calculatorsByCategory(cat.slug);
            return (
              <div
                key={cat.slug}
                className="rounded-lg border border-slate-200 dark:border-slate-800 p-5 hover:border-accent-400 dark:hover:border-accent-500 transition-colors"
              >
                <h3 className="font-medium mb-1">{cat.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  {cat.description}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                  {items.length} calculator{items.length === 1 ? '' : 's'}
                </p>
                <ul className="space-y-1">
                  {items.map((c) => (
                    <li key={c.meta.slug}>
                      <Link
                        href={`/${c.meta.category}/${c.meta.slug}`}
                        className="text-sm text-accent-700 dark:text-accent-400 hover:underline"
                      >
                        {c.meta.name}
                      </Link>
                      {c.meta.status === 'wip' && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          WIP
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
