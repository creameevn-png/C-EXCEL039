'use client';

export function exportToCSV(
  rows: any[],
  filename: string,
  headers?: Record<string, string>
): boolean {
  if (!rows || rows.length === 0) return false;
  const keys = headers ? Object.keys(headers) : Object.keys(rows[0]);
  const labels = headers ? Object.values(headers) : keys;

  const escape = (v: any): string => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  let csv = '﻿';
  csv += labels.map(escape).join(',') + '\n';
  for (const r of rows) csv += keys.map((k) => escape(r[k])).join(',') + '\n';

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
