'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';

interface FormulaProps {
  tex: string;
  display?: boolean;
  className?: string;
}

export function Formula({ tex, display = true, className }: FormulaProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, {
        displayMode: display,
        throwOnError: false,
        output: 'html',
      });
    }
  }, [tex, display]);

  return <span ref={ref} className={className} />;
}
