/**
 * Minimal RFC-4180 CSV writer for admin exports (AUC-71).
 *
 * Deliberately not a dependency: the export is a handful of flat columns, and
 * the only genuinely tricky parts are quoting and the formula-injection guard
 * below.
 */

function cell(value: unknown): string {
  if (value == null) return '';
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === 'bigint') s = value.toString();
  else if (typeof value === 'object') s = JSON.stringify(value);
  else if (typeof value === 'string') s = value;
  else if (typeof value === 'number' || typeof value === 'boolean')
    s = value.toString();
  else s = '';

  // A leading =, +, - or @ makes Excel and Sheets treat the cell as a formula.
  // Shop names and free-text reasons are user-supplied, so prefix a quote to
  // neutralise it rather than shipping a spreadsheet that executes them.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;

  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns?: string[],
): string {
  if (!rows.length) return columns?.length ? columns.join(',') + '\r\n' : '';
  const cols = columns?.length ? columns : Object.keys(rows[0]);
  const head = cols.map(cell).join(',');
  const body = rows
    .map((r) => cols.map((c) => cell(r[c])).join(','))
    .join('\r\n');
  return `${head}\r\n${body}\r\n`;
}

/** Flatten nested objects one level so `shop.shopName` becomes a column. */
export function flatten(
  row: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      !(v instanceof Date)
    ) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}
