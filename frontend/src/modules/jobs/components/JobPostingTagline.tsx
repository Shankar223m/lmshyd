type Props = {
  postingChannel?: string | null;
  tagline?: string | null;
};

export function JobPostingTagline({ postingChannel, tagline }: Props) {
  const channel = (postingChannel || "OPEN").toUpperCase();
  const text =
    tagline ||
    (channel === "CAMPUS"
      ? "Campus placement role — part of your institution's placement drive."
      : "Open market role — hiring outside your campus placement program.");

  return (
    <p
      className={`rounded-lg border px-3 py-2 text-xs font-medium leading-relaxed ${
        channel === "CAMPUS"
          ? "border-indigo-200 bg-indigo-50/80 text-indigo-900"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {text}
    </p>
  );
}