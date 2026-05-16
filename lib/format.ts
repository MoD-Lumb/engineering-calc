export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return Number(value.toFixed(digits)).toString();
}

export function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('Clipboard API not available'));
}

export function rowsToTSV(rows: Array<Array<string | number>>): string {
  return rows.map((r) => r.join('\t')).join('\n');
}
