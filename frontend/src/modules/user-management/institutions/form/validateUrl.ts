/** Validates an optional URL field. Empty values pass. Invalid URLs return an error message string. */
export function validateUrl(value: unknown): true | string {
  if (!value || typeof value !== "string" || !value.trim()) return true;
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "URL must start with https:// or http://";
    }
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return "Enter a valid website address, e.g. https://example.com";
    }
    return true;
  } catch {
    return "Enter a valid website address, e.g. https://example.com";
  }
}
