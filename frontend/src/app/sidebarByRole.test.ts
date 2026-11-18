import { describe, expect, it } from "vitest";

import { sidebarItemsForRole } from "@/app/sidebarByRole";

describe("sidebarByRole", () => {
  it("student sees Jobs & career with discover links", () => {
    const items = sidebarItemsForRole("student") ?? [];
    const jobs = items.find((i) => i.menu === "jobs");
    expect(jobs?.label).toMatch(/Jobs/i);
    expect(jobs?.children?.some((c) => c.to === "/jobs/student/jobs")).toBe(true);
  });

  it("employer sees jobs tabs and pipeline", () => {
    const items = sidebarItemsForRole("employer_admin") ?? [];
    const jobs = items.find((i) => i.menu === "jobs" && i.label === "Jobs");
    expect(jobs?.children?.some((c) => c.to === "/jobs/employer/jobs")).toBe(true);
    expect(items.some((i) => i.to === "/jobs/employer/pipeline")).toBe(true);
  });

  it("scoped admin with careers.manage gets platform JCMS nav", () => {
    const items = sidebarItemsForRole("admin", { jobsModerator: true }) ?? [];
    expect(items).toHaveLength(5);
    expect(items[0]?.to).toBe("/jobs/admin/dashboard");
    expect(items.some((i) => i.label === "Review inbox")).toBe(true);
  });

  it("super admin sees Jobs moderation group", () => {
    const items = sidebarItemsForRole("super_admin") ?? [];
    const jobs = items.find((i) => i.menu === "jobs" && i.label.includes("moderation"));
    expect(jobs?.children?.some((c) => c.to === "/jobs/admin/postings")).toBe(true);
  });

  it("no PLATFORM_ADMINISTRATOR label in sidebar", () => {
    for (const role of ["student", "super_admin", "employer_admin"] as const) {
      const json = JSON.stringify(sidebarItemsForRole(role));
      expect(json).not.toContain("PLATFORM_ADMINISTRATOR");
    }
  });
});