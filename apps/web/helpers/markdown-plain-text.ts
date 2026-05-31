import stripMarkdown from "strip-markdown";
import { remark } from "remark";

const plainTextProcessor = remark().use(stripMarkdown);

export function markdownPlainText(source: string): string {
  const trimmed = source.trim();

  if (!trimmed) {
    return "";
  }

  const result = plainTextProcessor.processSync(trimmed);
  const text = String(result).replace(/\s+/g, " ").trim();

  return text;
}
