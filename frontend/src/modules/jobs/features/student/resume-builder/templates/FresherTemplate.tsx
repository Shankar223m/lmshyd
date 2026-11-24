import React from 'react';
import { ResumeDocument } from '../types';
import { GraduationCap, Mail, Phone, MapPin, ExternalLink, Award } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from '../components/Icons';

interface TemplateProps {
  resume: ResumeDocument;
}

export const FresherTemplate: React.FC<TemplateProps> = ({ resume }) => {
  const { personal_info: pi, section_order } = resume;
  const isVisible = (id: string) => {
    const sec = section_order?.find(s => s.id === id);
    return sec ? sec.visible : true;
  };

  return (
    <div className="w-full bg-white text-slate-800 p-8 text-xs leading-relaxed min-h-[1050px] flex flex-col font-sans">
      {/* Header */}
      <div className="border-b-2 border-[#635BFF] pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {pi.full_name ? (
                pi.full_name
              ) : (
                <span className="text-slate-300 italic">Enter Your Full Name</span>
              )}
            </h1>
            {(pi.professional_title || resume.target_role) && (
              <p className="text-sm font-semibold text-[#635BFF] mt-0.5">
                {pi.professional_title || resume.target_role}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#635BFF] bg-[#F5F3FF] px-2.5 py-1 rounded-full border border-[#635BFF]/30 font-medium">
            <GraduationCap className="w-4 h-4 text-[#635BFF]" />
            <span>Entry-Level / Graduate</span>
          </div>
        </div>

        {/* Contacts */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 mt-2.5">
          {pi.email && (
            <a href={`mailto:${pi.email}`} className="flex items-center gap-1 hover:text-[#635BFF]">
              <Mail className="w-3.5 h-3.5 text-[#635BFF]" /> {pi.email}
            </a>
          )}
          {pi.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-[#635BFF]" /> {pi.phone}
            </span>
          )}
          {(pi.city || pi.country) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#635BFF]" /> {[pi.city, pi.country].filter(Boolean).join(', ')}
            </span>
          )}
          {pi.linkedin_url && (
            <a href={pi.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#635BFF]">
              <LinkedinIcon className="w-3.5 h-3.5 text-[#635BFF]" /> LinkedIn
            </a>
          )}
          {pi.github_url && (
            <a href={pi.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#635BFF]">
              <GithubIcon className="w-3.5 h-3.5 text-[#635BFF]" /> GitHub
            </a>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Career Objective / Summary */}
        {isVisible('professional_summary') && resume.professional_summary && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5046E5] border-b border-[#635BFF]/30 pb-0.5 mb-1.5">
              Career Objective
            </h2>
            <p className="text-slate-700 leading-relaxed text-[11px]">
              {resume.professional_summary}
            </p>
          </section>
        )}

        {/* EDUCATION FIRST - Tailored for Freshers */}
        {isVisible('education') && resume.education?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5046E5] border-b border-[#635BFF]/30 pb-0.5 mb-2">
              Education
            </h2>
            <div className="space-y-2.5">
              {resume.education.map(edu => (
                <div key={edu.id} className="text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900 text-sm">
                      {edu.degree} {edu.specialization && <span className="font-semibold text-slate-700">– {edu.specialization}</span>}
                    </span>
                    <span className="text-slate-500 font-medium text-[11px]">
                      {edu.start_year} – {edu.currently_studying ? 'Present' : edu.end_year}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>{edu.institution}{edu.location && `, ${edu.location}`}</span>
                    {edu.gpa && <span className="font-bold text-[#635BFF]">CGPA: {edu.gpa}</span>}
                    {!edu.gpa && edu.percentage && <span className="font-bold text-[#635BFF]">{edu.percentage}%</span>}
                  </div>
                  {edu.description && (
                    <p className="text-slate-500 text-[11px] mt-0.5 italic">{edu.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Technical & Core Skills */}
        {isVisible('skills') && resume.skills?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5046E5] border-b border-[#635BFF]/30 pb-0.5 mb-2">
              Skills & Competencies
            </h2>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {Object.entries(
                resume.skills.reduce((acc, skill) => {
                  const cat = skill.category || 'Technical Skills';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(skill.name);
                  return acc;
                }, {} as Record<string, string[]>)
              ).map(([category, skillList]) => (
                <div key={category} className="flex items-baseline gap-2">
                  <span className="font-semibold text-slate-800 w-36 shrink-0">{category}:</span>
                  <div className="flex flex-wrap gap-1">
                    {skillList.map(name => (
                      <span key={name} className="bg-[#F5F3FF] text-[#5046E5] px-2 py-0.5 rounded text-[11px] font-medium border border-[#635BFF]/30">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Academic & Personal Projects */}
        {isVisible('projects') && resume.projects?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5046E5] border-b border-[#635BFF]/30 pb-0.5 mb-2">
              Academic & Practical Projects
            </h2>
            <div className="space-y-3">
              {resume.projects.map(proj => (
                <div key={proj.id} className="text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900 text-sm">{proj.name}</span>
                    <div className="flex gap-2 text-[11px] text-[#635BFF] font-medium">
                      {proj.github_url && (
                        <a href={proj.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:underline">
                          GitHub <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {proj.demo_url && (
                        <a href={proj.demo_url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:underline">
                          Demo <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  {proj.technologies?.length > 0 && (
                    <div className="text-[11px] text-slate-500 font-medium mb-1">
                      Tools: {proj.technologies.join(', ')}
                    </div>
                  )}
                  {proj.description && (
                    <div className="text-slate-700 space-y-0.5">
                      {proj.description.split('\n').filter(Boolean).map((line, idx) => (
                        <p key={idx} className="flex items-start gap-1 leading-normal">
                          <span className="text-[#635BFF] font-bold">•</span>
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

        {/* Internships or Work Experience */}
        {((isVisible('experience') && resume.experience?.length > 0) ||
          (isVisible('internships') && resume.internships?.length > 0)) && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5046E5] border-b border-[#635BFF]/30 pb-0.5 mb-2">
              Internships & Practical Training
            </h2>
            <div className="space-y-2.5">
              {resume.experience.map(exp => (
                <div key={exp.id} className="text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900">{exp.job_title} – {exp.company}</span>
                    <span className="text-slate-500 text-[11px]">{exp.start_date} – {exp.end_date}</span>
                  </div>
                  {exp.responsibilities && (
                    <div className="text-slate-700 mt-0.5">
                      {exp.responsibilities.split('\n').slice(0, 2).map((l, i) => (
                        <p key={i}>• {l.replace(/^[•\-*]\s*/, '')}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {resume.internships?.map(intn => (
                <div key={intn.id} className="text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900">{intn.role} – {intn.company}</span>
                    <span className="text-slate-500 text-[11px]">{intn.start_date} – {intn.end_date}</span>
                  </div>
                  {intn.description && <p className="text-slate-700 mt-0.5">{intn.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completed Courses & Certifications */}
        {((isVisible('completed_courses') && resume.completed_courses?.length > 0) ||
          (isVisible('certifications') && resume.certifications?.length > 0)) && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5046E5] border-b border-[#635BFF]/30 pb-0.5 mb-1.5">
              Relevant Certifications & Coursework
            </h2>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {resume.certifications?.map(c => (
                <div key={c.id}>
                  <strong>{c.name}</strong> – {c.issuing_organization} ({c.issue_date})
                </div>
              ))}
              {resume.completed_courses?.map(crs => (
                <div key={crs.id}>
                  <strong>{crs.course_name}</strong> – {crs.institution} ({crs.completion_date})
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Achievements */}
        {isVisible('achievements') && resume.achievements?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5046E5] border-b border-[#635BFF]/30 pb-0.5 mb-1.5">
              Awards & Extracurricular Achievements
            </h2>
            <div className="space-y-1 text-[11px] text-slate-700">
              {resume.achievements.map(ach => (
                <div key={ach.id} className="flex items-start gap-1">
                  <Award className="w-3.5 h-3.5 text-[#635BFF] shrink-0 mt-0.5" />
                  <span><strong>{ach.title}</strong>: {ach.description}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
