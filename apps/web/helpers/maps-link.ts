export function buildMapsUrl(location: string): string {
  const trimmed = location.trim();

  if (!trimmed) {
    return "";
  }

  return `https://maps.google.com/?q=${encodeURIComponent(trimmed)}`;
}
