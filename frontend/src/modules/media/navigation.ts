import type { NavItem } from "@/app/navigation";

export const mediaNavigation: NavItem[] = [
  {
    menu: "media_library",
    label: "Media library",
    icon: "fileText",
    to: "/media-library",
    group: "curriculum",
    hint: "Uploaded videos, PDFs and assets used in courses",
  },
];
