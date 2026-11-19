import type { NavItem } from "@/app/navigation";

/** Staff / admin catalog entries (students use sidebarByRole → My courses). */
export const catalogNavigation: NavItem[] = [
  { menu: "courses", label: "Courses", icon: "fileText", to: "/courses", group: "curriculum", hint: "The course catalogue, learning content and assessments" },
];