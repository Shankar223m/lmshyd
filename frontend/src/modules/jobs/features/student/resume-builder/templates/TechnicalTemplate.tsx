import React from 'react';
import { ResumeDocument } from '../types';
import { Terminal, Globe, Mail, Phone, MapPin } from 'lucide-react';
import { GithubIcon } from '../components/Icons';

interface TemplateProps {
  resume: ResumeDocument;
}

export const TechnicalTemplate: React.FC<TemplateProps> = ({ resume }) => {
  const { personal_info: pi, section_order } = resume;
  const isVisible = (id: string) => {
    const sec = section_order?.find(s => s.id === id);
    return sec ? sec.visible : true;
  };

  return (
    <div className="w-full bg-white text-slate-800 p-8 text-xs leading-relaxed min-h-[1050px] flex flex-col font-sans">
      {/* Tech Header */}
      <div className="border-l-4 border-cyan-600 pl-4 py-1 mb-5">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-cyan-600" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
            {pi.full_name ? (
              pi.full_name
            ) : (
              <span className="text-slate-300 italic">Enter Your Full Name</span>
            )}
          </h1>
        </div>
        {(pi.professional_title || resume.target_role) && (
          <p className="text-sm font-semibold text-cyan-700 font-mono mt-0.5">
            &gt; {pi.professional_title || resume.target_role}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 mt-2 font-mono">
          {pi.email && (
            <a href={`mailto:${pi.email}`} className="flex items-center gap-1 hover:text-cyan-600">
              <Mail className="w-3 h-3 text-cyan-600" /> {pi.email}
            </a>
          )}
          {pi.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-cyan-600" /> {pi.phone}
            </span>
          )}
          {pi.github_url && (
            <a href={pi.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-800 hover:text-cyan-600 font-bold">
              <GithubIcon className="w-3 h-3 text-slate-900" /> GitHub
            </a>
          )}
          {pi.portfolio_url && (
            <a href={pi.portfolio_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-800 hover:text-cyan-600 font-bold">
              <Globe className="w-3 h-3 text-slate-900" /> Portfolio
            </a>
          )}
          {(pi.city || pi.country) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-cyan-600" /> {[pi.city, pi.country].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Technical Summary */}
        {isVisible('professional_summary') && resume.professional_summary && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono mb-1.5 flex items-center justify-between">
              <span>// Technical Summary</span>
            </h2>
            <p className="text-slate-700 text-xs leading-relaxed">
              {resume.professional_summary}
            </p>
          </section>
        )}

        {/* Technical Skills - Stack Grid */}
        {isVisible('skills') && resume.skills?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono mb-2">
              <span>// Core Tech Stack & Tools</span>
            </h2>
            <div className="grid grid-cols-1 gap-1.5 text-xs font-mono">
              {Object.entries(
                resume.skills.reduce((acc, skill) => {
                  const cat = skill.category || 'Tech';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(skill.name);
                  return acc;
                }, {} as Record<string, string[]>)
              ).map(([category, skillList]) => (
                <div key={category} className="flex items-start gap-2">
                  <span className="text-cyan-800 font-bold w-32 shrink-0">{category}:</span>
                  <div className="flex flex-wrap gap-1">
                    {skillList.map(name => (
                      <span key={name} className="bg-cyan-50 text-cyan-900 px-1.5 py-0.2 border border-cyan-200 rounded text-[11px]">
                        `{name}`
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects - Emphasized */}
        {isVisible('projects') && resume.projects?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono mb-2">
              <span>// Open Source & Featured Projects</span>
            </h2>
            <div className="space-y-3">
              {resume.projects.map(proj => (
                <div key={proj.id} className="text-xs border-l-2 border-slate-200 pl-3">
                  <div className="flex justify-between items-baseline font-mono">
                    <span className="font-bold text-slate-900 text-sm">{proj.name}</span>
                    <div className="space-x-3 text-[11px]">
                      {proj.github_url && (
                        <a href={proj.github_url} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">
                          [src]
                        </a>
                      )}
                      {proj.demo_url && (
                        <a href={proj.demo_url} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">
                          [live]
                        </a>
                      )}
                    </div>
                  </div>
                  {proj.technologies?.length > 0 && (
                    <div className="text-[11px] text-slate-500 font-mono mb-1">
                      stack: {proj.technologies.join(' / ')}
                    </div>
                  )}
                  {proj.description && (
                    <div className="text-slate-700 space-y-0.5">
                      {proj.description.split('\n').filter(Boolean).map((line, idx) => (
                        <p key={idx} className="flex items-start gap-1.5 leading-normal">
                          <span className="text-cyan-600">&gt;</span>
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

        {/* Experience */}
        {isVisible('experience') && resume.experience?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono mb-2">
              <span>// Work History</span>
            </h2>
            <div className="space-y-3">
              {resume.experience.map(exp => (
                <div key={exp.id} className="text-xs border-l-2 border-slate-200 pl-3">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">{exp.job_title} @ {exp.company}</span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {exp.start_date} – {exp.currently_working ? 'Present' : exp.end_date}
                    </span>
                  </div>
                  {exp.technologies?.length > 0 && (
                    <div className="text-[11px] text-cyan-700 font-mono mb-1">
                      env: {exp.technologies.join(', ')}
                    </div>
                  )}
                  {exp.responsibilities && (
                    <div className="text-slate-700 space-y-0.5">
                      {exp.responsibilities.split('\n').filter(Boolean).map((line, idx) => (
                        <p key={idx} className="flex items-start gap-1.5 leading-normal">
                          <span className="text-cyan-600">&gt;</span>
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

        {/* Education */}
        {isVisible('education') && resume.education?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono mb-1.5">
              <span>// Education & Credentials</span>
            </h2>
            <div className="space-y-2 text-xs">
              {resume.education.map(edu => (
                <div key={edu.id} className="flex justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{edu.degree}</span>
                    {edu.specialization && <span> in {edu.specialization}</span>}
                    <div className="text-slate-600">{edu.institution}</div>
                  </div>
                  <div className="text-right text-slate-500 font-mono text-[11px]">
                    {edu.start_year} – {edu.end_year}
                    {edu.gpa && <div className="text-cyan-700 font-bold">GPA: {edu.gpa}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
