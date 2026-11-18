import { Link } from "react-router-dom";

import { Icon } from "@/shared/ui";

const STEPS = [
  {
    key: "learn",
    title: "Learn",
    text: "Courses, labs and AI tutor",
    to: "/courses/my",
    icon: "graduation" as const,
  },
  {
    key: "certify",
    title: "Certify",
    text: "Tests and verifiable certificates",
    to: "/my-tests",
    icon: "shield" as const,
  },
  {
    key: "hire",
    title: "Get hired",
    text: "Jobs, interviews and placement",
    to: "/jobs/student/dashboard",
    icon: "briefcase" as const,
  },
] as const;

/** Product differentiator: one journey strip instead of three disconnected modules. */
export function CampusToCareerStrip() {
  return (
    <section
      className="mb-8 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50/90 via-white to-accent-50/80 p-5 shadow-card"
      aria-labelledby="campus-career-journey"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="campus-career-journey" className="text-base font-bold text-navy-950">
          Campus to career
        </h2>
        <p className="text-xs font-medium text-slate-600">What makes this LMS different from content-only platforms</p>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.key}>
            <Link
              to={step.to}
              className="group flex items-start gap-3 rounded-xl border border-white/80 bg-white/70 p-4 transition hover:border-brand-200 hover:bg-white"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-800">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold text-navy-950 group-hover:text-brand-800">
                  <Icon name={step.icon} size={16} className="text-brand-600" />
                  {step.title}
                </span>
                <span className="mt-0.5 block text-xs text-slate-600">{step.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
