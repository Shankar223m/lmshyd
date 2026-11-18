import type { NavItem } from "@/app/navigation";

/** A student's tests; authors', employers' and graders' screens each as their own entry (the server's menu decides). */
export const assessmentsNavigation: NavItem[] = [
  { menu: "my_tests", label: "My tests", icon: "fileText", to: "/my-tests", group: "exams", hint: "Tests you can take now, and your results" },
  {
    section: "academics",
    label: "Academic outcomes",
    icon: "chart",
    to: "/academics/outcomes",
    group: "exams",
    hint: "Marks, enrolment progress, grading and attempts in one place",
  },
  { menu: "tests", label: "Tests", icon: "fileText", to: "/tests", group: "exams", hint: "Test definitions, sections and publishing" },
  { menu: "question_bank", label: "Question bank", icon: "archive", to: "/questions", group: "curriculum", hint: "Write and review the questions tests are built from" },
  { menu: "attempts", label: "Attempts", icon: "users", to: "/attempts", group: "exams", hint: "Follow test attempts and step in when needed" },
  { menu: "grading", label: "Grading queue", icon: "check", to: "/grading/queue", group: "exams", hint: "Answers waiting for a person to mark" },
];
