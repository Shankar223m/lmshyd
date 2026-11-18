export function inferCategory(title: string, summary = ""): string {
  const t = `${title} ${summary}`.toLowerCase();
  if (t.includes("python") || t.includes("react") || t.includes("javascript") || t.includes("web")) return "Development";
  if (t.includes("data") || t.includes("ml") || t.includes("ai")) return "Data Science";
  if (t.includes("design") || t.includes("ui") || t.includes("ux")) return "Design";
  if (t.includes("marketing")) return "Marketing";
  if (t.includes("business")) return "Business";
  return "Development";
}