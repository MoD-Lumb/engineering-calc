import { notFound } from 'next/navigation';
import { calculators, findCalculator } from '@/calculators';
import { categoryBySlug } from '@/lib/categories';
import { CalcTabs } from '@/components/CalcTabs';

export function generateStaticParams() {
  return calculators.map((c) => ({
    category: c.meta.category,
    slug: c.meta.slug,
  }));
}

export const dynamicParams = false;

interface PageProps {
  params: { category: string; slug: string };
}

export function generateMetadata({ params }: PageProps) {
  const calc = findCalculator(params.category, params.slug);
  if (!calc) return {};
  return {
    title: `${calc.meta.name} · Engineering Calc`,
    description: calc.meta.description,
  };
}

export default function CalculatorPage({ params }: PageProps) {
  const calc = findCalculator(params.category, params.slug);
  const category = categoryBySlug(params.category);
  if (!calc || !category) notFound();

  const { Calculator, Theory, Examples, meta } = calc;

  return (
    <article>
      <nav className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        <span>{category.name}</span>
      </nav>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">{meta.name}</h1>
        {meta.status === 'wip' && (
          <span className="shrink-0 rounded bg-amber-100 dark:bg-amber-900/40 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            Work in progress
          </span>
        )}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{meta.description}</p>
      <CalcTabs
        calculator={<Calculator />}
        theory={<Theory />}
        examples={<Examples />}
      />
    </article>
  );
}
