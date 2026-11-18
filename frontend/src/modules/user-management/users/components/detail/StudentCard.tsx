import { formatDate } from "@/core/lib/format";
import { RELATIONSHIP_LABELS } from "@/modules/user-management/common/labels";
import type { StudentProfile } from "@/modules/user-management/users/types";
import { Badge, Card, DescriptionList, Icon } from "@/shared/ui";

export function StudentCard({ student }: { student: StudentProfile }) {
  const profileLinks = [
    { name: "LinkedIn", icon: "linkedin" as const, url: student.linkedin_url },
    { name: "GitHub", icon: "github" as const, url: student.github_url },
    { name: "HackerRank", icon: "hackerrank" as const, url: student.hackerrank_url },
    { name: "LeetCode", icon: "leetcode" as const, url: student.leetcode_url },
  ].filter((item) => Boolean(item.url));

  const certifications = student.certifications || [];

  return (
    <Card title="Student">
      <DescriptionList
        items={[
          { label: "Admission number", value: student.admission_number },
          { label: "Admission date", value: student.admission_date && formatDate(student.admission_date) },
          { label: "Program", value: student.program },
          { label: "Branch", value: student.branch },
          { label: "Year of study", value: student.year_of_study },
          { label: "Section", value: student.section },
          { label: "Graduation year", value: student.graduation_year },
          { label: "CGPA", value: student.cgpa },
        ]}
      />

      {/* Professional Profiles */}
      {profileLinks.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Professional Profiles</h3>
          <div className="flex flex-wrap gap-2.5">
            {profileLinks.map((p) => {
              const safeUrl = p.url?.startsWith("http://") || p.url?.startsWith("https://") ? p.url : `https://${p.url}`;
              return (
                <a
                  key={p.name}
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Icon name={p.icon} size={15} className="text-slate-500" />
                  <span>{p.name}</span>
                  <Icon name="arrowUpRight" size={12} className="text-slate-400" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Certifications</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {certifications.map((cert, i) => (
              <li key={cert.id ?? i} className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{cert.name}</p>
                    {cert.issuing_organization && (
                      <p className="mt-0.5 text-xs text-slate-500">{cert.issuing_organization}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 p-1.5 text-slate-500">
                    <Icon name="award" size={16} />
                  </span>
                </div>
                {(cert.issue_date || cert.expiration_date) && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-600">
                    <Icon name="clock" size={13} className="text-slate-400" />
                    <span>
                      {cert.issue_date && `Issued ${formatDate(cert.issue_date)}`}
                      {cert.issue_date && cert.expiration_date && " · "}
                      {cert.expiration_date && `Expires ${formatDate(cert.expiration_date)}`}
                    </span>
                  </p>
                )}
                {cert.credential_id && (
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="text-slate-400">ID:</span> {cert.credential_id}
                  </p>
                )}
                {(cert.credential_url || cert.document_url) && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2.5">
                    {cert.credential_url && (
                      <a
                        href={cert.credential_url.startsWith("http") ? cert.credential_url : `https://${cert.credential_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                      >
                        <span>Verify credential</span>
                        <Icon name="arrowUpRight" size={12} />
                      </a>
                    )}
                    {cert.document_url && (
                      <a
                        href={cert.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        <Icon name="paperclip" size={12} className="text-slate-400" />
                        <span>View certificate</span>
                      </a>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Guardians */}
      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Guardians</h3>
      {student.guardians.length === 0 ? (
        <p className="text-sm text-slate-500">No guardians recorded.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {student.guardians.map((guardian) => (
            <li key={guardian.phone} className="rounded-lg border border-slate-200 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-slate-900">
                {guardian.full_name}
                {guardian.is_primary && <Badge tone="indigo">Primary</Badge>}
              </p>
              <p className="text-slate-500">
                {RELATIONSHIP_LABELS[guardian.relationship]}
                {guardian.occupation && ` · ${guardian.occupation}`}
              </p>
              <p className="mt-2 text-slate-700">{guardian.phone}</p>
              {guardian.email && <p className="text-slate-700">{guardian.email}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
