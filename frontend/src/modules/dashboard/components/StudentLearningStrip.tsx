import { Link } from "react-router-dom";

import { Icon } from "@/shared/ui";

const STEPS = [
  {
    key: "learn",
    title: "Courses",
    text: "Enrolled programs, lessons and practice",
    to: "/courses/my",
    icon: "graduation" as const,
  },
  {
    key: "certify",
    title: "Tests & certificates",
    text: "Assessments and verified credentials",
    to: "/my-tests",
    icon: "shield" as const,
  },
] as const;

/** Student home — academic section only (jobs live in the Careers area). */
export function StudentLearningStrip() {
  return (
    <section
      className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card"
      aria-labelledby="student-learning-section"
    >
      <div className="mb-4">
        <h2 id="student-learning-section" className="text-base font-bold text-navy-950">
          Courses & learning
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">Your classes, labs, tutor, and certifications</p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((step) => (
          <li key={step.key}>
            <Link
              to={step.to}
              className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-brand-200 hover:bg-brand-50/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
                <Icon name={step.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-navy-950 group-hover:text-brand-800">{step.title}</span>
                <span className="mt-0.5 block text-xs text-slate-600">{step.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
