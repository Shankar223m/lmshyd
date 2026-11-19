import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, type ApiResponse } from "../../../services/api";

export function CreateCampusJobPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<ApiResponse<{ id: string }>>("/institutions/me/campus-jobs", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async (res) => {
      const id = res?.data?.id;
      if (id) {
        await apiFetch(`/jobs/${id}/submit`, { method: "POST" });
      }
      qc.invalidateQueries({ queryKey: ["institution-placements"] });
      nav("/jobs/institution/placements");
    },
    onError: (err: Error) => setError(err.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate({
      title,
      description,
      location,
      employment_type: "FULL_TIME",
      work_mode: "HYBRID",
      openings: 1,
      skills: [],
      requires_moderation: true,
      eligibility: {
        programs: ["B.Tech CSE", "B.Tech Computer Science"],
        graduation_year_min: new Date().getFullYear(),
        graduation_year_max: new Date().getFullYear() + 1,
        min_cgpa: 6,
        required_skills: [],
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Campus job posting</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create a placement role visible only to students at your institution (campus channel). Open-market employer jobs stay separate.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea
            required
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-lg bg-[#635BFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5046E5]"
          >
            {create.isPending ? "Submitting…" : "Submit for review"}
          </button>
          <Link to="/jobs/institution/placements" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}