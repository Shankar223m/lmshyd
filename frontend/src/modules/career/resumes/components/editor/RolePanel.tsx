import { useEffect, useState } from "react";

import { useGetRoleProfileQuery } from "@/modules/career/resumes/api/taxonomyApi";
import { CareerStep, EMPTY_CAREER, type CareerChoice } from "@/modules/career/resumes/components/wizard/CareerStep";
import { EMPTY_ROLE, RoleStep, type RoleChoice } from "@/modules/career/resumes/components/wizard/RoleStep";
import type { Resume, ResumeUpdateBody } from "@/modules/career/resumes/types";

/**
 * Change the target role, career level, purpose or country of an existing resume. Only what the suggestions, the
 * keywords and the score are aimed at changes: the content you wrote stays exactly as it is.
 */
export function RolePanel({ resume, onChange }: {
  resume: Resume;
  onChange: (patch: Pick<ResumeUpdateBody, "target_role" | "role_key" | "career_level" | "purpose" | "locale">) => void;
}) {
  const { data: profile } = useGetRoleProfileQuery({ role: resume.role_key || null, customRole: resume.role_key ? null : resume.target_role }, { skip: !resume.target_role && !resume.role_key });
  const [role, setRole] = useState<RoleChoice>({ ...EMPTY_ROLE, roleKey: resume.role_key ?? "", roleName: resume.target_role ?? "" });
  const locale = resume.locale ?? {};
  const [career, setCareer] = useState<CareerChoice>({ ...EMPTY_CAREER, level: resume.career_level ?? "", purpose: resume.purpose ?? "job", country: locale.country ?? "", language: locale.language ?? "English", dateFormat: locale.date_format ?? "MMM YYYY" });

  useEffect(() => {
    if (profile) setRole((r) => ({ ...r, industryKey: r.industryKey || profile.industry_key || "", departmentKey: r.departmentKey || profile.department_key || "" }));
  }, [profile]);

  const pickRole = (next: RoleChoice) => {
    setRole(next);
    if (next.roleName && (next.roleKey !== role.roleKey || next.roleName !== role.roleName)) onChange({ target_role: next.roleName, role_key: next.roleKey });
  };
  const pickCareer = (next: CareerChoice) => {
    setCareer(next);
    onChange({
      career_level: next.level || undefined,
      purpose: next.purpose,
      locale: { ...(next.country ? { country: next.country } : {}), language: next.language, date_format: next.dateFormat },
    });
  };

  return (
    <div className="space-y-6 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60">
      <p className="rounded-xl bg-brand-50/60 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600 ring-1 ring-brand-200">
        Changing your role keeps everything you wrote. It only changes the skills we suggest, the keywords your score is checked against and the words the AI uses.
        To aim at a different role as well, duplicate this resume first (Finish tab) and change the role on the copy.
      </p>
      <RoleStep value={role} onChange={pickRole} />
      <CareerStep value={career} onChange={pickCareer} />
    </div>
  );
}
