import React from 'react';
import { ResumeDocument } from '../types';

interface TemplateProps {
  resume: ResumeDocument;
}

export const ProfessionalTemplate: React.FC<TemplateProps> = ({ resume }) => {
  const { personal_info: pi, section_order } = resume;
  const isVisible = (id: string) => {
    const sec = section_order?.find(s => s.id === id);
    return sec ? sec.visible : true;
  };

  return (
    <div className="w-full bg-white text-slate-900 p-8 text-xs leading-normal min-h-[1050px] flex flex-col font-serif">
      {/* Header - Centered & Formal */}
      <div className="text-center pb-3 border-b-2 border-slate-900 mb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-950 font-serif">
          {pi.full_name ? (
            pi.full_name
          ) : (
            <span className="text-slate-300 font-normal italic">Enter Your Full Name</span>
          )}
        </h1>
        {(pi.professional_title || resume.target_role) && (
          <p className="text-xs font-semibold tracking-widest text-slate-700 uppercase mt-1">
            {pi.professional_title || resume.target_role}
          </p>
        )}
        <div className="flex justify-center flex-wrap gap-x-2 text-[11px] text-slate-700 mt-2 font-sans">
          {[pi.city, pi.state, pi.country].filter(Boolean).join(', ') && (
            <span>{[pi.city, pi.state, pi.country].filter(Boolean).join(', ')} • </span>
          )}
          {pi.phone && <span>{pi.phone} • </span>}
          {pi.email && <a href={`mailto:${pi.email}`} className="underline">{pi.email}</a>}
          {pi.linkedin_url && <span> • <a href={pi.linkedin_url} className="underline">LinkedIn</a></span>}
          {pi.github_url && <span> • <a href={pi.github_url} className="underline">GitHub</a></span>}
          {pi.portfolio_url && <span> • <a href={pi.portfolio_url} className="underline">Portfolio</a></span>}
        </div>
      </div>

      <div className="space-y-4">
        {/* Professional Summary */}
        {isVisible('professional_summary') && resume.professional_summary && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-300 pb-0.5 mb-1.5 text-slate-950">
              Professional Summary
            </h2>
            <p className="text-slate-800 leading-relaxed font-sans text-[11px] text-justify">
              {resume.professional_summary}
            </p>
          </section>
        )}

        {/* Experience */}
        {isVisible('experience') && resume.experience?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-300 pb-0.5 mb-2 text-slate-950">
              Experience
            </h2>
            <div className="space-y-3 font-sans">
              {resume.experience.map(exp => (
                <div key={exp.id}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900 text-xs">{exp.job_title}</span>
                    <span className="text-[11px] text-slate-600">
                      {exp.start_date} – {exp.currently_working ? 'Present' : exp.end_date}
                    </span>
                  </div>
                  <div className="flex justify-between italic text-[11px] text-slate-700 mb-1">
                    <span>{exp.company} {exp.location && `(${exp.location})`}</span>
                    <span>{exp.employment_type}</span>
                  </div>
                  {exp.responsibilities && (
                    <div className="text-[11px] text-slate-800 space-y-0.5">
                      {exp.responsibilities.split('\n').filter(Boolean).map((line, idx) => (
                        <p key={idx} className="flex items-start gap-1">
                          <span>•</span>
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

        {/* Projects */}
        {isVisible('projects') && resume.projects?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-300 pb-0.5 mb-2 text-slate-950">
              Projects
            </h2>
            <div className="space-y-2.5 font-sans">
              {resume.projects.map(proj => (
                <div key={proj.id}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900 text-xs">{proj.name}</span>
                    <div className="text-[11px] space-x-2">
                      {proj.github_url && <a href={proj.github_url} className="underline text-blue-700">Code</a>}
                      {proj.demo_url && <a href={proj.demo_url} className="underline text-blue-700">Demo</a>}
                    </div>
                  </div>
                  {proj.technologies?.length > 0 && (
                    <div className="text-[10px] text-slate-600 italic">
                      Tech: {proj.technologies.join(', ')}
                    </div>
                  )}
                  {proj.description && (
                    <div className="text-[11px] text-slate-800 space-y-0.5 mt-0.5">
                      {proj.description.split('\n').filter(Boolean).map((line, idx) => (
                        <p key={idx} className="flex items-start gap-1">
                          <span>•</span>
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

        {/* Technical Skills */}
        {isVisible('skills') && resume.skills?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-300 pb-0.5 mb-1.5 text-slate-950">
              Skills
            </h2>
            <div className="font-sans text-[11px] space-y-1">
              {Object.entries(
                resume.skills.reduce((acc, skill) => {
                  const cat = skill.category || 'Competencies';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(skill.name);
                  return acc;
                }, {} as Record<string, string[]>)
              ).map(([category, skillList]) => (
                <p key={category}>
                  <strong className="text-slate-900">{category}:</strong> {skillList.join(', ')}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {isVisible('education') && resume.education?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-300 pb-0.5 mb-1.5 text-slate-950">
              Education
            </h2>
            <div className="space-y-2 font-sans">
              {resume.education.map(edu => (
                <div key={edu.id} className="flex justify-between items-start text-[11px]">
                  <div>
                    <span className="font-bold text-slate-900">{edu.degree}</span>
                    {edu.specialization && <span> in {edu.specialization}</span>}
                    <div className="text-slate-700 italic">{edu.institution}{edu.location && `, ${edu.location}`}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-600">{edu.start_year} – {edu.currently_studying ? 'Present' : edu.end_year}</span>
                    {edu.gpa && <div className="font-semibold text-slate-800">GPA: {edu.gpa}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications */}
        {isVisible('certifications') && resume.certifications?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-300 pb-0.5 mb-1 text-slate-950">
              Certifications
            </h2>
            <div className="font-sans text-[11px] space-y-1">
              {resume.certifications.map(cert => (
                <div key={cert.id} className="flex justify-between">
                  <span><strong>{cert.name}</strong> – {cert.issuing_organization}</span>
                  <span className="text-slate-600">{cert.issue_date}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
