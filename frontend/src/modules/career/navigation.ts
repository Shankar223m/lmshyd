import type { NavItem } from "@/app/navigation";

export const careerNavigation: NavItem[] = [
  {
    menu: "career",
    label: "Resume",
    icon: "fileText",
    to: "/career/resumes",
    group: "careers",
    hint: "AI Resume Builder & ATS Intelligence",
    children: [
      { to: "/career/resumes", label: "My Resumes", icon: "fileText", hint: "View and manage your saved resumes" },
      { to: "/career/resumes/create", label: "Create Resume", icon: "plus", hint: "Build resume step-by-step" },
      { to: "/career/resumes/upload", label: "Upload Resume", icon: "upload", hint: "Upload & parse PDF or DOCX" },
      { to: "/career/resumes/analysis", label: "AI Resume Analysis", icon: "sparkles", hint: "ATS score & job description match" },
      { to: "/career/resumes/templates", label: "Resume Templates", icon: "layers", hint: "ATS-optimized templates gallery" },
    ],
  },
  {
    menu: "career",
    label: "Skill Profile",
    icon: "user",
    to: "/career/profile",
    group: "careers",
    hint: "Verified credentials and career items",
  },
];
