'use client';

import { useEffect, useMemo, useState } from 'react';
import { create, all, type MathJsInstance } from 'mathjs';
import { RotateCcw } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { formatNumber, rowsToTSV } from '@/lib/format';
import {
  isFormulaRow,
  isInputRow,
  type CalcSpec,
  type SpecFormulaRow,
  type SpecInputRow,
  type SpecRow,
} from '@/lib/spec';

const math: MathJsInstance = create(all, {});
// Lock down evaluation: disable imports & loading from strings.
math.import(
  {
    import: function () {
      throw new Error('Disabled');
    },
    createUnit: function () {
      throw new Error('Disabled');
    },
    evaluate: function () {
      throw new Error('Disabled');
    },
    parse: function () {
      throw new Error('Disabled');
    },
    simplify: function () {
      throw new Error('Disabled');
    },
    derivative: function () {
      throw new Error('Disabled');
    },
  },
  { override: true }
);

interface SpecGridProps {
  spec: CalcSpec;
}

function storageKey(slug: string) {
  return `ec-inputs-${slug}`;
}

function defaultInputs(rows: SpecRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) if (isInputRow(r)) out[r.id] = r.input;
  return out;
}

function evaluateRows(
  rows: SpecRow[],
  inputs: Record<string, number>
): { values: Record<string, number>; errors: Record<string, string> } {
  const scope: Record<string, number> = { ...inputs };
  const errors: Record<string, string> = {};
  for (const row of rows) {
    if (isFormulaRow(row)) {
      try {
        const result = math.evaluate(row.formula, scope);
        const num = typeof result === 'number' ? result : Number(result);
        if (!Number.isFinite(num)) {
          errors[row.id] = 'Not a finite number';
          scope[row.id] = NaN;
        } else {
          scope[row.id] = num;
        }
      } catch (e) {
        errors[row.id] = e instanceof Error ? e.message : 'Evaluation error';
        scope[row.id] = NaN;
      }
    }
  }
  return { values: scope, errors };
}

function formatCell(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return formatNumber(value, digits);
}

function rowCopyText(label: string, value: number, unit?: string, digits = 3): string {
  const v = formatCell(value, digits);
  return unit ? `${label} = ${v} ${unit}` : `${label} = ${v}`;
}

export function SpecGrid({ spec }: SpecGridProps) {
  const [inputs, setInputs] = useState<Record<string, number>>(() => defaultInputs(spec.rows));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(spec.slug));
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        setInputs((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [spec.slug]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey(spec.slug), JSON.stringify(inputs));
    } catch {
      // ignore
    }
  }, [inputs, spec.slug, hydrated]);

  const { values, errors } = useMemo(() => evaluateRows(spec.rows, inputs), [spec.rows, inputs]);

  function handleInputChange(id: string, raw: string) {
    const n = raw === '' ? NaN : Number(raw);
    setInputs((prev) => ({ ...prev, [id]: n }));
  }

  function reset() {
    setInputs(defaultInputs(spec.rows));
  }

  const resultRows = spec.rows.filter((r) => isFormulaRow(r) && (r.highlight ?? false));
  const finalResult = resultRows[resultRows.length - 1] as SpecFormulaRow | undefined;

  const tsvRows: Array<Array<string | number>> = [['Parameter', 'Value', 'Unit']];
  for (const r of spec.rows) {
    const v = values[r.id];
    tsvRows.push([r.label, formatCell(v, isFormulaRow(r) ? r.digits ?? 3 : 6), r.unit ?? '']);
  }
  const tsvAll = rowsToTSV(tsvRows);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,18rem]">
      <div className="min-w-0">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Parameter</th>
                <th className="text-right px-4 py-2 font-medium w-40">Value</th>
                <th className="text-left px-4 py-2 font-medium w-20">Unit</th>
              </tr>
            </thead>
            <tbody>
              {spec.rows.map((row, idx) => {
                const value = values[row.id];
                const isInput = isInputRow(row);
                const isResult = !isInput && (row as SpecFormulaRow).highlight;
                const error = errors[row.id];
                return (
                  <tr
                    key={row.id}
                    className={
                      'border-t border-slate-100 dark:border-slate-800/60 ' +
                      (isResult ? 'bg-accent-50/60 dark:bg-accent-900/10 font-medium' : '')
                    }
                  >
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs text-slate-400 mr-2">{row.id}</span>
                      {row.label}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isInput ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          value={Number.isNaN(inputs[row.id]) ? '' : inputs[row.id]}
                          step={(row as SpecInputRow).step ?? 'any'}
                          min={(row as SpecInputRow).min}
                          max={(row as SpecInputRow).max}
                          onChange={(e) => handleInputChange(row.id, e.target.value)}
                          className="w-32 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                        />
                      ) : (
                        <span className="font-mono" title={error}>
                          {error ? <span className="text-red-500">error</span> : formatCell(value, (row as SpecFormulaRow).digits ?? 3)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{row.unit ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {finalResult && (
            <CopyButton
              label="Copy result"
              text={rowCopyText(
                finalResult.label,
                values[finalResult.id],
                finalResult.unit,
                finalResult.digits ?? 3
              )}
            />
          )}
          <CopyButton label="Copy as table" text={tsvAll} />
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Notes
        </h3>
        <ul className="space-y-3 text-sm">
          {spec.rows
            .filter((r) => r.note)
            .map((r) => (
              <li key={r.id} className="border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-0.5">
                  {r.id}
                </div>
                <div className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                  {r.note}
                </div>
              </li>
            ))}
        </ul>
      </aside>
    </div>
  );
}
