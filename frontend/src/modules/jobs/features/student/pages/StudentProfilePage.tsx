import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  GraduationCap,
  Phone,
  Code,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { authApi, filesApi } from '../../../services/api';

export function StudentProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: () => authApi.getProfile() });
  const profile = data?.data;
  const sp = profile?.student_profile;
  const [skills, setSkills] = useState('');
  const [skillsInitialized, setSkillsInitialized] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [resumeUploading, setResumeUploading] = useState(false);

  useEffect(() => {
    if (sp && !skillsInitialized) {
      setSkills(Array.isArray(sp.skills) ? sp.skills.join(', ') : '');
      setSkillsInitialized(true);
    }
  }, [sp, skillsInitialized]);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.updateProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setValidationError('');
    },
  });

  const uploadResumeMutation = useMutation({
    mutationFn: async (file: File) => {
      const res = await filesApi.upload(file);
      const fileId = res.data?.id;
      if (!fileId) throw new Error('File upload failed');
      return authApi.updateProfile({ resume_file_id: fileId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setResumeUploading(false);
    },
    onError: (err: Error) => {
      setValidationError(err.message || 'Resume upload failed');
      setResumeUploading(false);
    },
  });

  if (isLoading) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#7DC8F7] border-t-transparent animate-spin" />
        <p className="text-xs text-slate-500">Loading profile data…</p>
      </div>
    );
  }

  const completenessFields = [
    profile?.full_name,
    sp?.program,
    sp?.graduation_year,
    sp?.cgpa,
    sp?.skills?.length,
    sp?.resume_file_id,
  ];
  const filledCount = completenessFields.filter(Boolean).length;
  const completenessPercent = Math.round((filledCount / completenessFields.length) * 100);

  return (
    <div className="flex flex-col w-full space-y-7">
      {/* Header Profile Card */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl font-bold text-[#7DC8F7] shrink-0">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'N'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {profile?.full_name || 'Nagarjuna N'}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {sp?.program || 'B.Tech in Computer Science'} • Class of {sp?.graduation_year || '2026'}
            </p>
          </div>
        </div>

        {/* Readiness Meter */}
        <div className="w-full sm:w-52 space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Profile Completeness</span>
            <span className="font-bold text-[#7DC8F7]">{completenessPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-[#7DC8F7] rounded-full transition-all duration-500"
              style={{ width: `${completenessPercent}%` }}
            />
          </div>
        </div>
      </div>

      {save.isSuccess && (
        <div className="rounded-xl bg-emerald-50 p-4 text-xs text-emerald-800 border border-emerald-200/60 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Profile changes saved successfully.</span>
        </div>
      )}

      {(save.isError || validationError) && (
        <div className="rounded-xl bg-red-50 p-4 text-xs text-red-700 border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError || (save.error instanceof Error ? save.error.message : 'Failed to save profile')}</span>
        </div>
      )}

      {/* Main Grid: Form & Resume */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Form */}
        <form
          className="lg:col-span-8 rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            setValidationError('');
            const fd = new FormData(e.currentTarget);
            const rawCgpa = fd.get('cgpa');
            const numCgpa = rawCgpa !== '' && rawCgpa !== null ? Number(rawCgpa) : null;
            if (numCgpa !== null && (numCgpa < 0 || numCgpa > 10)) {
              setValidationError('CGPA must be between 0.0 and 10.0');
              return;
            }

            const rawGradYear = fd.get('graduation_year');
            const numGradYear = rawGradYear !== '' && rawGradYear !== null ? Number(rawGradYear) : null;
            if (numGradYear !== null && (numGradYear < 1950 || numGradYear > 2035)) {
              setValidationError('Graduation year must be between 1950 and 2035');
              return;
            }

            const parsedSkills = skills
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

            save.mutate({
              full_name: fd.get('full_name') || undefined,
              program: fd.get('program') || undefined,
              department: fd.get('department') || undefined,
              batch: fd.get('batch') || undefined,
              graduation_year: numGradYear,
              cgpa: numCgpa,
              location: fd.get('location') || undefined,
              phone: fd.get('phone') || undefined,
              skills: parsedSkills,
            });
          }}
        >
          {/* Section 1: Academic Information */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#7DC8F7]" />
              <span>Academic &amp; Personal Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Full Name
                </label>
                <input
                  name="full_name"
                  defaultValue={profile?.full_name}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Degree / Program
                </label>
                <input
                  name="program"
                  defaultValue={sp?.program || 'B.Tech in Computer Science'}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Department
                </label>
                <input
                  name="department"
                  defaultValue={sp?.department || 'Computer Science & Engineering'}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Graduation Year
                </label>
                <input
                  name="graduation_year"
                  defaultValue={sp?.graduation_year || 2026}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  CGPA (Scale of 10)
                </label>
                <input
                  name="cgpa"
                  type="number"
                  step="0.01"
                  defaultValue={sp?.cgpa || 8.7}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact Info */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#7DC8F7]" />
              <span>Contact &amp; Location</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Phone Number
                </label>
                <input
                  name="phone"
                  defaultValue={sp?.phone || ''}
                  placeholder="+91 98765 43210"
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Location / City
                </label>
                <input
                  name="location"
                  defaultValue={sp?.location || 'Hyderabad, India'}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Technical Skills */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Code className="w-4 h-4 text-[#7DC8F7]" />
              <span>Technical Skills</span>
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Comma Separated Skills
              </label>
              <textarea
                rows={3}
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="React, TypeScript, Python, Node.js, SQL, AWS..."
                className="w-full p-3.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-400 resize-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {skills
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((sk) => (
                    <span
                      key={sk}
                      className="px-2.5 py-1 rounded-md bg-indigo-50/70 text-[#7DC8F7] text-xs font-medium border border-indigo-100/60"
                    >
                      {sk}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={save.isPending}
              className="h-10 px-6 rounded-lg bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Right: Master CV */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#7DC8F7]" />
              <span>Resume / Master CV</span>
            </h3>

            <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 space-y-3">
              {sp?.resume_file_id ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 truncate">Resume_Master.pdf</span>
                  <button
                    type="button"
                    onClick={() => filesApi.openDownload(sp.resume_file_id!).catch(() => undefined)}
                    className="p-1.5 rounded-lg text-[#7DC8F7] hover:bg-indigo-50"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400">No resume uploaded</div>
              )}

              <label className="w-full py-2.5 px-3 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold text-center cursor-pointer transition flex items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>{resumeUploading ? 'Uploading…' : 'Upload PDF Resume'}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={resumeUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setResumeUploading(true);
                      uploadResumeMutation.mutate(f);
                    }
                  }}
                />
              </label>
            </div>

            <p className="text-xs text-slate-500">
              This master resume is attached by default when applying for new positions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
