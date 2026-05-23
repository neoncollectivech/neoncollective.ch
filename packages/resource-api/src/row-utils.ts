export function pickFields(
  source: Record<string, unknown>,
  allowed: string[] | undefined,
): Record<string, unknown> {
  if (!allowed?.length) {
    return source;
  }
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in source) {
      out[key] = source[key];
    }
  }
  return out;
}

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
  fields: string[] | "*" | undefined,
): Record<string, unknown> {
  if (!fields || fields === "*") {
    return row;
  }
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in row) {
      out[key] = row[key];
    }
  }
  return out;
}
