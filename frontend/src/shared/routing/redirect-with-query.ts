export function computeRedirectUrl(
  queryString: string,
  destination: string,
  defaults?: Record<string, string>,
): string {
  const parsed = new URL(destination, "http://localhost");
  const params = new URLSearchParams(queryString);
  if (defaults) {
    for (const [key, value] of Object.entries(defaults)) {
      if (!params.has(key)) {
        params.set(key, value);
      }
    }
  }
  parsed.search = params.toString();
  const normalizedQuery = parsed.search ? "?" + parsed.search.slice(1) : "";
  return parsed.pathname + normalizedQuery;
}
