export function inferCategory(title: string, summary = ""): string {
  const t = `${title} ${summary}`.toLowerCase();
  if (t.includes("machine learning") || t.includes("deep learning") || t.includes("artificial intelligence") || t.includes("ai ") || t.includes(" ai") || t.includes("llm") || t.includes("neural")) {
    return "AI & Machine Learning";
  }
  if (t.includes("data science") || t.includes("analytics") || t.includes("big data") || t.includes("data ")) {
    return "Data Science";
  }
  if (t.includes("design") || t.includes("ui") || t.includes("ux") || t.includes("figma") || t.includes("creative")) {
    return "Design";
  }
  if (t.includes("marketing") || t.includes("seo") || t.includes("growth") || t.includes("branding")) {
    return "Marketing";
  }
  if (t.includes("business") || t.includes("management") || t.includes("finance") || t.includes("startup") || t.includes("leadership")) {
    return "Business";
  }
  if (t.includes("python") || t.includes("react") || t.includes("javascript") || t.includes("typescript") || t.includes("web") || t.includes("programming") || t.includes("software") || t.includes("coding")) {
    return "Development";
  }
  return "Development";
}
