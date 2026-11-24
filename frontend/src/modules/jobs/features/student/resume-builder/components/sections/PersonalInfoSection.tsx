import React from 'react';
import { PersonalInfo } from '../../types';
import { User, Briefcase, Mail, Phone, MapPin, Globe, Image as ImageIcon } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from '../Icons';

interface Props {
  data: PersonalInfo;
  onChange: (updated: PersonalInfo) => void;
}

export const PersonalInfoSection: React.FC<Props> = ({ data, onChange }) => {
  const handleChange = (field: keyof PersonalInfo, value: string) => {
    onChange({ ...data, [field]: value });
  };

  // Simple validation helpers
  const isValidEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidUrl = (url: string) => !url || /^https?:\/\/.+/.test(url);

  return (
    <div className="space-y-4">
      <div className="border-b border-[#E5E7EB] pb-3">
        <h3 className="text-base font-bold text-[#111827]">Personal Information</h3>
        <p className="text-xs text-[#64748B]">Add your contact details and links so recruiters can connect with you.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="text"
              value={data.full_name || ''}
              onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-[#111827]"
            />
          </div>
        </div>

        {/* Professional Title */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">Professional Title</label>
          <div className="relative">
            <Briefcase className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="text"
              value={data.professional_title || ''}
              onChange={(e) => handleChange('professional_title', e.target.value)}
              placeholder="e.g. Full-Stack Developer / Software Engineer"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-[#111827]"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">
            Email Address <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="email"
              value={data.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="e.g. rahul.sharma@example.com"
              className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none text-[#111827] ${
                isValidEmail(data.email)
                  ? 'border-[#E5E7EB] focus:border-[#635BFF]'
                  : 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
              }`}
            />
          </div>
          {!isValidEmail(data.email) && (
            <p className="text-[11px] text-rose-500 mt-1">Please enter a valid email address.</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">Phone Number</label>
          <div className="relative">
            <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="tel"
              value={data.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-[#111827]"
            />
          </div>
        </div>

        {/* City */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">City</label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="text"
              value={data.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="e.g. Hyderabad"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-[#111827]"
            />
          </div>
        </div>

        {/* State / Country */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1">State</label>
            <input
              type="text"
              value={data.state || ''}
              onChange={(e) => handleChange('state', e.target.value)}
              placeholder="Telangana"
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-[#111827]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1">Country</label>
            <input
              type="text"
              value={data.country || ''}
              onChange={(e) => handleChange('country', e.target.value)}
              placeholder="India"
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-[#111827]"
            />
          </div>
        </div>

        {/* LinkedIn */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">LinkedIn URL</label>
          <div className="relative">
            <LinkedinIcon className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="url"
              value={data.linkedin_url || ''}
              onChange={(e) => handleChange('linkedin_url', e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none text-[#111827] ${
                isValidUrl(data.linkedin_url) ? 'border-[#E5E7EB] focus:border-[#635BFF]' : 'border-rose-300 bg-rose-50/20'
              }`}
            />
          </div>
        </div>

        {/* GitHub */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">GitHub Profile</label>
          <div className="relative">
            <GithubIcon className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="url"
              value={data.github_url || ''}
              onChange={(e) => handleChange('github_url', e.target.value)}
              placeholder="https://github.com/username"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-[#111827]"
            />
          </div>
        </div>

        {/* Portfolio */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">Portfolio Website</label>
          <div className="relative">
            <Globe className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="url"
              value={data.portfolio_url || ''}
              onChange={(e) => handleChange('portfolio_url', e.target.value)}
              placeholder="https://yourportfolio.dev"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-[#111827]"
            />
          </div>
        </div>

        {/* Optional Photo URL */}
        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">Photo URL (Optional)</label>
          <div className="relative">
            <ImageIcon className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="url"
              value={data.photo_url || ''}
              onChange={(e) => handleChange('photo_url', e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-[#111827]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
