'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyToClipboard } from '@/lib/format';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label = 'Copy', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        'inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 ' +
        'px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 ' +
        'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ' +
        (className ?? '')
      }
      aria-label={label}
    >
      {copied ? <Check size={14} className="text-accent-600" /> : <Copy size={14} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
