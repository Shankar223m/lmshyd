import { describe, it, expect } from "vitest";

import { NAVIGATION, STUDENT_NAVIGATION } from "@/app/navigation";
import { isNavItemEnabled } from "@/app/navPolicy";
import { EMPLOYER_NAVIGATION, INSTITUTION_HEAD_NAVIGATION, STAFF_NAVIGATION } from "@/app/roleNavigation";
import { LEARNER_MENUS } from "@/app/roleNavPolicy";
import { jobsNavChildrenForRole } from "@/modules/jobs/jobsNavChildren";

describe("Role-scoped sidebar policy", () => {
  it("hides learner menus from super admin and institution staff", () => {
    for (const menu of LEARNER_MENUS) {
      expect(isNavItemEnabled({ menu, label: "x", icon: "user", to: "/x", group: "home", hint: "" }, "super_admin")).toBe(false);
      expect(isNavItemEnabled({ menu, label: "x", icon: "user", to: "/x", group: "home", hint: "" }, "staff")).toBe(false);
    }
  });

  it("employer sidebar is jobs + support (+ dashboard) only", () => {
    const menus = EMPLOYER_NAVIGATION.map((i) => i.menu).filter(Boolean);
    expect(menus).toEqual(expect.arrayContaining(["jobs", "support"]));
    expect(menus).not.toContain("courses");
    expect(menus).not.toContain("my_learning");
  });

  it("student nav has no legacy job board or staff catalog entries", () => {
    const studentJobs = STUDENT_NAVIGATION.find((i) => i.menu === "jobs");
    expect(studentJobs?.children?.some((c) => c.to === "/jobs/board")).toBe(false);
    expect(STUDENT_NAVIGATION.some((i) => i.menu === "courses")).toBe(false);
  });

  it("staff nav omits subscriptions and platform admin sections", () => {
    expect(STAFF_NAVIGATION.some((i) => i.menu === "subscriptions")).toBe(false);
    expect(STAFF_NAVIGATION.some((i) => i.section === "admins")).toBe(false);
    expect(STAFF_NAVIGATION.some((i) => i.menu === "my_submissions")).toBe(false);
  });

  it("staff nav includes jobs (visibility still gated by LMS permissions.menu)", () => {
    expect(STAFF_NAVIGATION.some((i) => i.menu === "jobs")).toBe(true);
    expect(jobsNavChildrenForRole("staff")?.every((c) => c.to.startsWith("/jobs/institution/"))).toBe(true);
    expect(isNavItemEnabled({ menu: "jobs", label: "Jobs", icon: "briefcase", to: "/jobs", group: "careers", hint: "" }, "staff")).toBe(
      true,
    );
  });

  it("institution head nav includes placements jobs, not employer registry", () => {
    expect(INSTITUTION_HEAD_NAVIGATION.some((i) => i.menu === "jobs")).toBe(true);
    expect(INSTITUTION_HEAD_NAVIGATION.some((i) => i.section === "employers")).toBe(false);
    expect(INSTITUTION_HEAD_NAVIGATION.some((i) => i.viewRole === "institution_head")).toBe(false);
  });

  it("scopes job submenu per role", () => {
    expect(jobsNavChildrenForRole("student")?.every((c) => c.to.startsWith("/jobs/student/"))).toBe(true);
    expect(jobsNavChildrenForRole("employer_admin")?.every((c) => c.to.startsWith("/jobs/employer/"))).toBe(true);
  });

  it("platform NAVIGATION is not the student careers split legacy", () => {
    expect(NAVIGATION.some((i) => i.to?.startsWith("/career"))).toBe(false);
    expect(NAVIGATION.filter((i) => i.label === "Recruitment")).toHaveLength(0);
  });
});
