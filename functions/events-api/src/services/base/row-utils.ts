export function pickWritable(
  data: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in data && data[key] !== undefined) {
      out[key] = data[key];
    }
  }
  return out;
}

export function projectRow(
  row: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in row) {
      out[key] = row[key];
    }
  }
  return out;
}
