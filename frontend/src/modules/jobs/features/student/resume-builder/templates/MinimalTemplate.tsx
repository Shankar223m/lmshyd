import React from 'react';
import { ResumeDocument } from '../types';

interface TemplateProps {
  resume: ResumeDocument;
}

export const MinimalTemplate: React.FC<TemplateProps> = ({ resume }) => {
  const { personal_info: pi, section_order } = resume;
  const isVisible = (id: string) => {
    const sec = section_order?.find(s => s.id === id);
    return sec ? sec.visible : true;
  };

  return (
    <div className="w-full bg-white text-zinc-900 p-8 text-xs leading-relaxed min-h-[1050px] flex flex-col font-sans">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-light tracking-wide text-zinc-900">
          {pi.full_name ? (
            pi.full_name
          ) : (
            <span className="text-zinc-300 italic">Enter Your Full Name</span>
          )}
        </h1>
        {(pi.professional_title || resume.target_role) && (
          <p className="text-xs text-zinc-500 font-medium tracking-wider uppercase mt-0.5">
            {pi.professional_title || resume.target_role}
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 text-[11px] text-zinc-500 mt-2">
          {pi.email && <span>{pi.email}</span>}
          {pi.phone && <span>• {pi.phone}</span>}
          {(pi.city || pi.country) && <span>• {[pi.city, pi.country].filter(Boolean).join(', ')}</span>}
          {pi.linkedin_url && (
            <span>• <a href={pi.linkedin_url} target="_blank" rel="noreferrer" className="text-zinc-700 underline">LinkedIn</a></span>
          )}
          {pi.github_url && (
            <span>• <a href={pi.github_url} target="_blank" rel="noreferrer" className="text-zinc-700 underline">GitHub</a></span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isVisible('professional_summary') && resume.professional_summary && (
          <section>
            <p className="text-zinc-700 text-xs leading-relaxed">
              {resume.professional_summary}
            </p>
          </section>
        )}

        {isVisible('skills') && resume.skills?.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">
              Skills
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {resume.skills.map(s => (
                <span key={s.id} className="text-zinc-800 bg-zinc-50 px-2 py-0.5 border border-zinc-200 rounded text-[11px]">
                  {s.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {isVisible('experience') && resume.experience?.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
              Experience
            </h2>
            <div className="space-y-3">
              {resume.experience.map(exp => (
                <div key={exp.id}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium text-zinc-900">{exp.job_title}</span>
                    <span className="text-[10px] text-zinc-400">
                      {exp.start_date} – {exp.currently_working ? 'Present' : exp.end_date}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mb-1">{exp.company} {exp.location && `· ${exp.location}`}</div>
                  {exp.responsibilities && (
                    <div className="text-zinc-600 text-[11px] space-y-0.5">
                      {exp.responsibilities.split('\n').filter(Boolean).map((line, idx) => (
                        <p key={idx} className="flex items-start gap-1.5">
                          <span className="text-zinc-400">—</span>
                          <span>{line.replace(/^[•\-*]\s*/, '')}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {isVisible('projects') && resume.projects?.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
              Projects
            </h2>
            <div className="space-y-2.5">
              {resume.projects.map(proj => (
                <div key={proj.id}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium text-zinc-900">{proj.name}</span>
                    {proj.github_url && (
                      <a href={proj.github_url} target="_blank" rel="noreferrer" className="text-[10px] text-zinc-500 underline">
                        View Code
                      </a>
                    )}
                  </div>
                  {proj.description && (
                    <p className="text-zinc-600 text-[11px] mt-0.5">{proj.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {isVisible('education') && resume.education?.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">
              Education
            </h2>
            <div className="space-y-1.5">
              {resume.education.map(edu => (
                <div key={edu.id} className="flex justify-between text-[11px]">
                  <div>
                    <span className="font-medium text-zinc-900">{edu.degree}</span>
                    {edu.specialization && <span>, {edu.specialization}</span>}
                    <div className="text-zinc-500">{edu.institution}</div>
                  </div>
                  <span className="text-zinc-400 text-[10px]">{edu.start_year} – {edu.end_year}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
