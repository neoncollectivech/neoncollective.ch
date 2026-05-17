/** Row shape for POST /admin/events/:id/invitees */
export type InviteeUpsertPayload = {
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
  maxRedemptions: number | null;
  notes: string | null;
};

export class ParseInviteesCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseInviteesCsvError";
  }
}

const HEADER_ALIASES: Record<string, keyof InviteeUpsertPayload> = {
  givenname: "givenName",
  firstname: "givenName",
  given_name: "givenName",
  first_name: "givenName",
  familyname: "familyName",
  lastname: "familyName",
  family_name: "familyName",
  last_name: "familyName",
  email: "email",
  phone: "phoneE164",
  phonee164: "phoneE164",
  phone_e164: "phoneE164",
  notes: "notes",
  note: "notes",
  maxredemptions: "maxRedemptions",
  max_redemptions: "maxRedemptions",
};

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvRecord(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += c;
      }
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") {
        i++;
      }
      if (current.trim()) {
        records.push(current);
      }
      current = "";
    } else {
      current += c;
    }
  }
  if (current.trim()) {
    records.push(current);
  }
  return records;
}

function cellToPayloadField(
  key: keyof InviteeUpsertPayload,
  raw: string,
): string | number | null {
  const trimmed = raw.trim();
  if (key === "maxRedemptions") {
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      throw new ParseInviteesCsvError(`Invalid maxRedemptions: "${raw}"`);
    }
    return n;
  }
  if (key === "email" || key === "phoneE164" || key === "notes") {
    return trimmed || null;
  }
  return trimmed;
}

function emptyRow(): InviteeUpsertPayload {
  return {
    givenName: "",
    familyName: "",
    email: null,
    phoneE164: null,
    maxRedemptions: null,
    notes: null,
  };
}

/**
 * Parse invitee roster CSV. First row must be a header with recognized column names.
 */
export function parseInviteesCsv(text: string): InviteeUpsertPayload[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const records = splitCsvRecords(trimmed);
  if (records.length === 0) {
    return [];
  }

  const headerCells = parseCsvRecord(records[0]!);
  const columnKeys = headerCells.map((h) => {
    const normalized = normalizeHeader(h);
    const key = HEADER_ALIASES[normalized];
    if (!key) {
      throw new ParseInviteesCsvError(`Unknown column "${h}".`);
    }
    return key;
  });

  const required = new Set(["givenName", "familyName"]);
  for (const req of required) {
    if (!columnKeys.includes(req)) {
      throw new ParseInviteesCsvError(`Missing required column: ${req}.`);
    }
  }
  if (!columnKeys.includes("email") && !columnKeys.includes("phoneE164")) {
    throw new ParseInviteesCsvError("CSV must include an email or phoneE164 column.");
  }

  const rows: InviteeUpsertPayload[] = [];

  for (let i = 1; i < records.length; i++) {
    const lineNum = i + 1;
    const cells = parseCsvRecord(records[i]!);
    if (cells.every((c) => !c.trim())) {
      continue;
    }

    const row = emptyRow();
    for (let col = 0; col < columnKeys.length; col++) {
      const key = columnKeys[col]!;
      const value = cells[col] ?? "";
      row[key] = cellToPayloadField(key, value) as never;
    }

    if (!row.email && !row.phoneE164) {
      throw new ParseInviteesCsvError(
        `Row ${lineNum}: each invitee needs email or phoneE164.`,
      );
    }

    rows.push(row);
  }

  if (rows.length === 0) {
    throw new ParseInviteesCsvError("No data rows found below the header.");
  }

  return rows;
}

export const INVITEES_CSV_TEMPLATE = `givenName,familyName,email,phoneE164,notes
Alice,Smith,alice@example.com,,VIP guest
Bob,Jones,,+41791234567,`;
