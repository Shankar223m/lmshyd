import { useState } from "react";

import { cn } from "@/core/lib/cn";
import { useListDepartmentsQuery, useListIndustriesQuery, useSearchRolesQuery, type RoleHit } from "@/modules/career/resumes/api/taxonomyApi";
import { Icon, Input } from "@/shared/ui";

export interface RoleChoice {
  industryKey: string;
  departmentKey: string;
  roleKey: string; // empty for a custom role
  roleName: string;
  specialization: string;
}

export const EMPTY_ROLE: RoleChoice = { industryKey: "", departmentKey: "", roleKey: "", roleName: "", specialization: "" };

/**
 * Any profession: type any job title and pick it (or use it as typed), or browse by field and department.
 * Nothing here is a fixed list: the fields, departments and roles come from the role catalogue.
 */
export function RoleStep({ value, onChange }: { value: RoleChoice; onChange: (next: RoleChoice) => void }) {
  const [query, setQuery] = useState("");
  const { data: industries = [] } = useListIndustriesQuery();
  const { data: departments = [] } = useListDepartmentsQuery(value.industryKey, { skip: !value.industryKey });
  const searching = query.trim().length >= 2;
  const { data: hits = [], isFetching } = useSearchRolesQuery(
    { q: searching ? query.trim() : undefined, industry: value.industryKey || undefined, department: value.departmentKey || undefined },
    { skip: !searching && !value.industryKey },
  );

  const pick = (hit: RoleHit) => {
    onChange({ industryKey: hit.industry_key, departmentKey: hit.department_key, roleKey: hit.key, roleName: hit.name, specialization: "" });
    setQuery("");
  };
  const useCustom = () => {
    onChange({ ...value, roleKey: "", roleName: query.trim(), specialization: "" });
    setQuery("");
  };
  const exact = hits.some((h) => h.name.toLowerCase() === query.trim().toLowerCase());
  const chosen = hits.find((h) => h.key === value.roleKey);

  return (
    <div className="space-y-6">
      {value.roleName && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50/70 px-4 py-3 ring-1 ring-brand-200">
          <Icon name="check" size={18} className="text-brand-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-navy-950">{value.roleName}{value.specialization ? ` · ${value.specialization}` : ""}</p>
            <p className="text-xs text-slate-500">{value.roleKey ? "From the role catalogue" : "Your own job title: we will use a general professional layout"}</p>
          </div>
          <button type="button" onClick={() => onChange(EMPTY_ROLE)} className="text-xs font-semibold text-slate-500 hover:text-navy-950">Change</button>
        </div>
      )}

      {value.roleName && (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-navy-950">Specialisation (optional)</span>
          <Input value={value.specialization} maxLength={80} placeholder={chosen?.specializations[0] ? `e.g. ${chosen.specializations[0]}` : "e.g. paediatrics, payroll, embedded systems"} onChange={(e) => onChange({ ...value, specialization: e.target.value })} />
        </label>
      )}

      <div>
        <label htmlFor="role-search" className="mb-1.5 block text-[13px] font-bold text-navy-950">Search any job title</label>
        <Input id="role-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Accountant, nurse, teacher, site engineer, UX designer…" autoComplete="off" />
        {searching && (
          <ul className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white" role="listbox" aria-label="Matching job titles">
            {hits.map((hit) => (
              <li key={hit.key}>
                <button type="button" role="option" aria-selected={hit.key === value.roleKey} onClick={() => pick(hit)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50">
                  <span className="text-sm font-semibold text-navy-950">{hit.name}</span>
                  <span className="truncate text-xs text-slate-500">{hit.industry} · {hit.department}</span>
                </button>
              </li>
            ))}
            {!isFetching && hits.length === 0 && <li className="px-3.5 py-3 text-sm text-slate-500">Not in the catalogue yet. You can still use it.</li>}
            {!exact && (
              <li className="border-t border-slate-100">
                <button type="button" onClick={useCustom} className="w-full px-3.5 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50/50">Use “{query.trim()}” as my job title</button>
              </li>
            )}
          </ul>
        )}
      </div>

      {!searching && (
        <div className="space-y-4">
          <p className="text-[13px] font-bold text-navy-950">Or browse by field</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map((industry) => {
              const on = industry.key === value.industryKey;
              return (
                <button
                  key={industry.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ ...EMPTY_ROLE, industryKey: on ? "" : industry.key })}
                  className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition", on ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600/30" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-600">{industry.name[0]}</span>
                  <span className="text-[13px] font-semibold leading-snug text-navy-950">{industry.name}</span>
                </button>
              );
            })}
          </div>

          {value.industryKey && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Department">
                <button type="button" aria-pressed={!value.departmentKey} onClick={() => onChange({ ...value, departmentKey: "" })} className={cn("min-h-[32px] rounded-full px-3 text-xs font-semibold", !value.departmentKey ? "bg-brand-50 text-brand-800 ring-1 ring-brand-500" : "text-slate-600 ring-1 ring-slate-200 hover:text-navy-950")}>All departments</button>
                {departments.map((d) => (
                  <button key={d.key} type="button" aria-pressed={d.key === value.departmentKey} onClick={() => onChange({ ...value, departmentKey: d.key })} className={cn("min-h-[32px] rounded-full px-3 text-xs font-semibold", d.key === value.departmentKey ? "bg-brand-50 text-brand-800 ring-1 ring-brand-500" : "text-slate-600 ring-1 ring-slate-200 hover:text-navy-950")}>{d.name}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hits.map((hit) => (
                  <button key={hit.key} type="button" aria-pressed={hit.key === value.roleKey} onClick={() => pick(hit)} className={cn("min-h-[34px] rounded-full px-3.5 text-[13px] font-semibold transition", hit.key === value.roleKey ? "bg-brand-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300")}>{hit.name}</button>
                ))}
              </div>
              <p className="text-xs text-slate-500">Your job is not listed? Type it in the search box above and use it as typed.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
