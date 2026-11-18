import type { NavItem } from "@/app/navigation";

export const storeNavigation: NavItem[] = [
  {
    menu: "store",
    label: "Browse courses",
    icon: "graduation",
    to: "/browse-courses",
    group: "learn",
    hint: "Full catalog — purchase to unlock access",
  },
  {
    menu: "store",
    label: "My purchases",
    icon: "fileText",
    to: "/store",
    group: "learn",
    hint: "Receipts and checkout history",
  },
];
