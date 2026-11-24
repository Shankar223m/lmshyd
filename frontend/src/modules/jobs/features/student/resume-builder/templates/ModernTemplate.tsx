import React from 'react';
import { ResumeDocument } from '../types';
import { Mail, Phone, MapPin, Globe, ExternalLink } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from '../components/Icons';

interface TemplateProps {
  resume: ResumeDocument;
}

export const ModernTemplate: React.FC<TemplateProps> = ({ resume }) => {
  const { personal_info: pi, section_order } = resume;
  const isVisible = (id: string) => {
    const sec = section_order?.find(s => s.id === id);
    return sec ? sec.visible : true;
  };

  return (
    <div className="w-full bg-white text-slate-800 p-8 text-sm leading-relaxed min-h-[1050px] flex flex-col font-sans">
      {/* Header */}
      <div className="border-b-2 border-blue-600 pb-5 mb-5">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {pi.full_name ? (
            pi.full_name
          ) : (
            <span className="text-slate-300 font-normal italic">Enter Your Full Name</span>
          )}
        </h1>
        {(pi.professional_title || resume.target_role) && (
          <p className="text-lg font-semibold text-blue-600 mt-1">
            {pi.professional_title || resume.target_role}
          </p>
        )}

        {/* Contacts */}
        <div className="flex flex-wrap gap-y-1.5 gap-x-4 mt-3 text-xs text-slate-600">
          {pi.email && (
            <a href={`mailto:${pi.email}`} className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>{pi.email}</span>
            </a>
          )}
          {pi.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-600" />
              <span>{pi.phone}</span>
            </span>
          )}
          {(pi.city || pi.country) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>{[pi.city, pi.state, pi.country].filter(Boolean).join(', ')}</span>
            </span>
          )}
          {pi.linkedin_url && (
            <a href={pi.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
              <LinkedinIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>LinkedIn</span>
            </a>
          )}
          {pi.github_url && (
            <a href={pi.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
              <GithubIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>GitHub</span>
            </a>
          )}
          {pi.portfolio_url && (
            <a href={pi.portfolio_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>Portfolio</span>
            </a>
          )}
        </div>
      </div>

      {/* Dynamic Sections based on order */}
      <div className="space-y-5">
        {/* Professional Summary */}
        {isVisible('professional_summary') && resume.professional_summary && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-1 mb-2">
              Professional Summary
            </h2>
            <p className="text-slate-700 text-xs leading-relaxed text-justify">
              {resume.professional_summary}
            </p>
          </section>
        )}

        {/* Skills */}
        {isVisible('skills') && resume.skills?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-1 mb-2.5">
              Technical Skills
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(
                resume.skills.reduce((acc, skill) => {
                  const cat = skill.category || 'Core Skills';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(skill.name);
                  return acc;
                }, {} as Record<string, string[]>)
              ).map(([category, skillList]) => (
                <div key={category} className="text-xs flex items-start gap-2">
                  <span className="font-semibold text-slate-800 w-36 shrink-0">{category}:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {skillList.map(name => (
                      <span key={name} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Work Experience */}
        {isVisible('experience') && resume.experience?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-1 mb-3">
              Work Experience
            </h2>
            <div className="space-y-3.5">
              {resume.experience.map(exp => (
                <div key={exp.id} className="text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900 text-sm">{exp.job_title}</span>
                    <span className="text-slate-500 font-medium text-[11px]">
                      {exp.start_date} – {exp.currently_working ? 'Present' : exp.end_date}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 font-medium text-xs mb-1">
                    <span>{exp.company} {exp.location && `• ${exp.location}`}</span>
                    <span className="text-slate-400 text-[11px]">{exp.employment_type}</span>
                  </div>
                  {exp.technologies?.length > 0 && (
                    <div className="text-[11px] text-blue-600 mb-1 font-medium">
                      Technologies: {exp.technologies.join(', ')}
                    </div>
                  )}
                  {exp.responsibilities && (
                    <div className="text-slate-700 space-y-1 mt-1">
                      {exp.responsibilities.split('\n').filter(Boolean).map((line, idx) => (
                        <p key={idx} className="flex items-start gap-1.5 leading-normal">
                          <span className="text-blue-500 font-bold">•</span>
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

        {/* Internships */}
        {isVisible('internships') && resume.internships?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-1 mb-2.5">
              Internships
            </h2>
            <div className="space-y-3">
              {resume.internships.map(intn => (
                <div key={intn.id} className="text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">{intn.role}</span>
                    <span className="text-slate-500 text-[11px]">
                      {intn.start_date} – {intn.currently_working ? 'Present' : intn.end_date}
                    </span>
                  </div>
                  <div className="text-slate-600 mb-1">{intn.company} {intn.location && `• ${intn.location}`}</div>
                  {intn.description && <p className="text-slate-700 leading-normal">{intn.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {isVisible('projects') && resume.projects?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-1 mb-3">
              Key Projects
            </h2>
            <div className="space-y-3">
              {resume.projects.map(proj => (
                <div key={proj.id} className="text-xs">
                  <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{proj.name}</span>
                      {proj.project_type && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          {proj.project_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-blue-600 font-medium">
                      {proj.github_url && (
                        <a href={proj.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:underline">
                          GitHub <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {proj.demo_url && (
                        <a href={proj.demo_url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:underline">
                          Live Demo <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  {proj.technologies?.length > 0 && (
                    <div className="text-[11px] text-slate-500 mb-1 font-mono">
                      {proj.technologies.join(' • ')}
                    </div>
                  )}
                  {proj.description && (
                    <div className="text-slate-700 space-y-1">
                      {proj.description.split('\n').filter(Boolean).map((line, idx) => (
                        <p key={idx} className="flex items-start gap-1.5 leading-normal">
                          <span className="text-blue-500 font-bold">•</span>
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
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-1 mb-2.5">
              Education
            </h2>
            <div className="space-y-2.5">
              {resume.education.map(edu => (
                <div key={edu.id} className="text-xs flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900">{edu.degree}</span>
                    {edu.specialization && <span className="text-slate-700 font-medium"> in {edu.specialization}</span>}
                    <div className="text-slate-600">{edu.institution}{edu.location && `, ${edu.location}`}</div>
                    {edu.description && <p className="text-slate-500 text-[11px] mt-0.5">{edu.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-slate-500 font-medium text-[11px]">
                      {edu.start_year} – {edu.currently_studying ? 'Present' : edu.end_year}
                    </div>
                    {edu.gpa && <div className="text-blue-600 font-semibold text-[11px]">GPA: {edu.gpa}</div>}
                    {!edu.gpa && edu.percentage && <div className="text-blue-600 font-semibold text-[11px]">{edu.percentage}%</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications & Courses */}
        {((isVisible('certifications') && resume.certifications?.length > 0) ||
          (isVisible('completed_courses') && resume.completed_courses?.length > 0)) && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-1 mb-2">
              Certifications & Courses
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {resume.certifications?.map(cert => (
                <div key={cert.id} className="border-l-2 border-blue-400 pl-2">
                  <div className="font-semibold text-slate-800">{cert.name}</div>
                  <div className="text-[11px] text-slate-500">{cert.issuing_organization} • {cert.issue_date}</div>
                </div>
              ))}
              {resume.completed_courses?.map(course => (
                <div key={course.id} className="border-l-2 border-slate-300 pl-2">
                  <div className="font-semibold text-slate-800">{course.course_name}</div>
                  <div className="text-[11px] text-slate-500">{course.institution} • {course.completion_date}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Achievements */}
        {isVisible('achievements') && resume.achievements?.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-1 mb-2">
              Honors & Achievements
            </h2>
            <div className="space-y-1.5 text-xs">
              {resume.achievements.map(ach => (
                <div key={ach.id} className="flex items-start gap-1.5 text-slate-700">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>
                    <strong className="text-slate-900">{ach.title}</strong>
                    {ach.organization && ` (${ach.organization})`}: {ach.description}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Languages & Interests */}
        {((isVisible('languages') && resume.languages?.length > 0) ||
          (isVisible('interests') && resume.interests?.length > 0)) && (
          <div className="grid grid-cols-2 gap-4 pt-1">
            {isVisible('languages') && resume.languages?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Languages</h3>
                <p className="text-xs text-slate-700">
                  {resume.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
                </p>
              </div>
            )}
            {isVisible('interests') && resume.interests?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Interests</h3>
                <p className="text-xs text-slate-700">{resume.interests.join(' • ')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
