import { Link } from "react-router-dom";

import { Button, Icon } from "@/shared/ui";

/** Student home — placements section separate from courses. */
export function StudentCareersStrip() {
  return (
    <section
      className="mb-8 rounded-2xl border border-navy-100 bg-gradient-to-r from-navy-50/80 via-white to-white p-5 shadow-card"
      aria-labelledby="student-careers-section"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 id="student-careers-section" className="text-base font-bold text-navy-950">
            Jobs & placements
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Search openings, track applications, interviews, offers, and campus placement — separate from your course
            work.
          </p>
        </div>
        <Link to="/jobs/student/dashboard">
          <Button type="button" icon="briefcase" size="sm">
            Open careers hub
          </Button>
        </Link>
      </div>
      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        {[
          { label: "Find jobs", to: "/jobs/student/jobs", icon: "search" as const },
          { label: "Applications", to: "/jobs/student/applications", icon: "clipboardCheck" as const },
          { label: "Placement", to: "/jobs/student/placement", icon: "graduation" as const },
        ].map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 font-medium text-slate-700 transition hover:border-brand-200 hover:text-brand-800"
            >
              <Icon name={item.icon} size={16} className="text-brand-700" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
