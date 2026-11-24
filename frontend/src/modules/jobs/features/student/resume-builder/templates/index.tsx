import React from 'react';
import { ResumeDocument } from '../types';
import { ModernTemplate } from './ModernTemplate';
import { ProfessionalTemplate } from './ProfessionalTemplate';
import { MinimalTemplate } from './MinimalTemplate';
import { TechnicalTemplate } from './TechnicalTemplate';
import { FresherTemplate } from './FresherTemplate';

export {
  ModernTemplate,
  ProfessionalTemplate,
  MinimalTemplate,
  TechnicalTemplate,
  FresherTemplate,
};

export const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern Clean',
    tag: 'Recommended',
    description: 'Contemporary layout with accent bars and optimal balance for software engineering and tech roles.',
  },
  {
    id: 'professional',
    name: 'Executive Corporate',
    tag: 'Corporate ATS',
    description: 'Single-column executive layout emphasizing career milestones and quantifiable business outcomes.',
  },
  {
    id: 'minimal',
    name: 'Minimalist Tech',
    tag: 'Clean Signal',
    description: 'High-signal monochromatic typography prioritizing readability without visual noise.',
  },
  {
    id: 'technical',
    name: 'Engineering & Cloud',
    tag: 'Tech Heavy',
    description: 'Highlighted tech proficiencies, cloud infrastructure, architectures, and open-source contributions.',
  },
  {
    id: 'fresher',
    name: 'Entry-Level & Graduate',
    tag: 'Campus / Junior',
    description: 'Built for students and early-career engineers, prioritizing academic honors, projects, and skills.',
  },
  {
    id: 'elegant',
    name: 'Creative Elegant',
    tag: 'Creative Pro',
    description: 'Polished two-column layout with bold section headings and clear hierarchy.',
  },
];

export const ResumeTemplateRenderer: React.FC<{ resume: ResumeDocument }> = ({ resume }) => {
  const templateId = resume.template_id?.toLowerCase() || 'modern';
  const styling = resume.styling || {
    font_family: 'Plus Jakarta Sans',
    font_size: 'md',
    line_spacing: 1.3,
    margins: 'normal',
    accent_color: '#635BFF',
    section_spacing: 'normal',
  };

  const getMarginPadding = () => {
    switch (styling.margins) {
      case 'compact':
        return '12mm 14mm';
      case 'spacious':
        return '24mm 24mm';
      default:
        return '18mm 20mm';
    }
  };

  const getBaseFontSize = () => {
    switch (styling.font_size) {
      case 'sm':
        return '12px';
      case 'lg':
        return '14.5px';
      default:
        return '13px';
    }
  };

  const renderTemplate = () => {
    switch (templateId) {
      case 'professional':
        return <ProfessionalTemplate resume={resume} />;
      case 'minimal':
        return <MinimalTemplate resume={resume} />;
      case 'technical':
        return <TechnicalTemplate resume={resume} />;
      case 'fresher':
        return <FresherTemplate resume={resume} />;
      case 'elegant':
        return <ProfessionalTemplate resume={resume} />;
      case 'modern':
      default:
        return <ModernTemplate resume={resume} />;
    }
  };

  return (
    <div
      className="resume-content w-full box-border"
      style={{
        fontFamily: `'${styling.font_family || 'Plus Jakarta Sans'}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
        fontSize: getBaseFontSize(),
        lineHeight: styling.line_spacing || 1.3,
        padding: getMarginPadding(),
        ['--theme-accent' as any]: styling.accent_color || '#635BFF',
      }}
    >
      {renderTemplate()}
    </div>
  );
};
