import type { NavItem } from "@/app/navigation";

export const codeExecutionNavigation: NavItem[] = [
  {
    menu: "compiler",
    label: "Compiler",
    icon: "terminal",
    to: "/compiler",
    group: "curriculum",
    hint: "Online compiler for different languages",
  },
];
