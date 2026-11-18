/** Detect immersive workflow surfaces (course player, jobs hiring) for layout width and chrome. */
export type FlowKind = "default" | "course" | "jobs";

export function flowKind(pathname: string): FlowKind {
  if (pathname.startsWith("/jobs/")) return "jobs";
  if (
    pathname.startsWith("/courses/") &&
    (pathname.includes("/learn") ||
      pathname.includes("/test") ||
      pathname.includes("/exam") ||
      pathname.includes("/final-exam"))
  ) {
    return "course";
  }
  return "default";
}

export function mainMaxWidth(kind: FlowKind): string {
  switch (kind) {
    case "course":
      return "max-w-[1680px]";
    case "jobs":
      return "max-w-[1280px]";
    default:
      return "max-w-7xl";
  }
}
