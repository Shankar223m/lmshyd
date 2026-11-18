import type { ResumeDocument } from "@/modules/career/common/types";
import { Badge } from "@/shared/ui";
import { cn } from "@/core/lib/cn";

export interface ResumeDocumentViewProps {
  document: ResumeDocument;
  showVerified?: boolean;
  templateKey?: string;
  fontFamily?: "sans" | "serif" | "mono";
  fontSize?: "sm" | "base" | "lg";
  accentColor?: "indigo" | "navy" | "emerald" | "slate" | "black";
  spacing?: "compact" | "normal" | "spacious";
}

/** Professional ATS-shaped rendering with template layout, typography, and accent customization. */
export function ResumeDocumentView({
  document,
  showVerified = true,
  templateKey = "modern",
  fontFamily = "sans",
  fontSize = "sm",
  accentColor = "indigo",
  spacing = "normal",
}: ResumeDocumentViewProps) {
  const { personal } = document;
  const contact = [personal.email, personal.phone, personal.location].filter(Boolean).join(" • ");

  const fontClass =
    fontFamily === "serif"
      ? "font-serif"
      : fontFamily === "mono"
      ? "font-mono"
      : "font-sans";

  const sizeClass =
    fontSize === "sm"
      ? "text-xs"
      : fontSize === "lg"
      ? "text-base"
      : "text-sm";

  const spacingClass =
    spacing === "compact"
      ? "space-y-3 p-5"
      : spacing === "spacious"
      ? "space-y-6 p-8"
      : "space-y-4 p-6 sm:p-7";

  const isClassic = templateKey === "classic";
  const isCompact = templateKey === "compact";
  const isExecutive = templateKey === "executive";

  const accentColorMap: Record<string, string> = {
    indigo: "text-brand-700 border-brand-600",
    navy: "text-navy-900 border-navy-800",
    emerald: "text-emerald-700 border-emerald-600",
    slate: "text-slate-800 border-slate-700",
    black: "text-black border-black",
  };

  const accentClasses = accentColorMap[accentColor] ?? "text-brand-700 border-brand-600";
  const [accentTextClass = "text-brand-700", accentBorderClass = "border-brand-600"] = accentClasses.split(" ");

  return (
    <article
      id="printable-resume-document"
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm transition-all [overflow-wrap:anywhere]",
        fontClass,
        sizeClass,
        spacingClass
      )}
    >
      {/* Header */}
      {isClassic ? (
        <header className="border-b-2 border-slate-900 pb-3 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{personal.name}</h1>
          {personal.headline && <p className="mt-0.5 italic text-slate-700">{personal.headline}</p>}
          {contact && <p className="mt-1 text-xs text-slate-600">{contact}</p>}
          {personal.links.length > 0 && (
            <p className="mt-1 flex flex-wrap justify-center gap-x-3 text-xs">
              {personal.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-slate-800 hover:underline"
                >
                  {link.label}
                </a>
              ))}
            </p>
          )}
        </header>
      ) : isExecutive ? (
        <header className="rounded-lg bg-slate-900 p-5 text-white shadow-xs">
          <h1 className="text-2xl font-black tracking-tight">{personal.name}</h1>
          {personal.headline && <p className="mt-0.5 text-xs text-slate-300 font-medium">{personal.headline}</p>}
          {contact && <p className="mt-1.5 text-xs text-slate-400">{contact}</p>}
          {personal.links.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-3 text-xs">
              {personal.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-300 underline hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </p>
          )}
        </header>
      ) : (
        <header className={cn("border-b-2 pb-3", isCompact ? "border-slate-300" : accentBorderClass)}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h1 className="text-2xl font-black text-navy-950 tracking-tight">{personal.name}</h1>
              {personal.headline && (
                <p className={cn("mt-0.5 font-medium", accentTextClass)}>{personal.headline}</p>
              )}
            </div>
          </div>
          {contact && <p className="mt-1 text-xs text-slate-500">{contact}</p>}
          {personal.links.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
              {personal.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 font-medium hover:underline"
                >
                  {link.label}
                </a>
              ))}
            </p>
          )}
        </header>
      )}

      {/* Summary */}
      {document.summary && (
        <section className="space-y-1">
          <h2
            className={cn(
              "text-xs font-bold uppercase tracking-wider",
              isClassic
                ? "border-b border-slate-300 pb-0.5 text-slate-900"
                : isExecutive
                ? "border-b border-slate-200 pb-1 text-slate-900"
                : accentTextClass
            )}
          >
            Professional Summary
          </h2>
          <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{document.summary}</p>
        </section>
      )}

      {/* Dynamic Sections */}
      {document.sections.map((section) => (
        <section key={section.key} className="space-y-2">
          <h2
            className={cn(
              "text-xs font-bold uppercase tracking-wider",
              isClassic
                ? "border-b border-slate-300 pb-0.5 text-slate-900"
                : isExecutive
                ? "border-b border-slate-200 pb-1 text-slate-900"
                : cn("border-b border-slate-100 pb-1", accentTextClass)
            )}
          >
            {section.title}
          </h2>

          {section.key === "skills" ? (
            <p className="leading-relaxed text-slate-800 font-medium">
              {section.entries.map((entry) => entry.heading).join(" • ")}
            </p>
          ) : (
            <ul className={cn("space-y-3", spacing === "compact" && "space-y-2")}>
              {section.entries.map((entry) => (
                <li key={entry.item_id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {entry.heading}
                      {entry.subheading && (
                        <span className="font-normal text-slate-600"> — {entry.subheading}</span>
                      )}
                      {showVerified && entry.verified && (
                        <Badge tone="green" className="ml-2 text-[10px]">
                          Verified
                        </Badge>
                      )}
                    </p>
                    {(entry.dates || entry.location) && (
                      <span className="text-xs text-slate-500">
                        {[entry.location, entry.dates].filter(Boolean).join(" • ")}
                      </span>
                    )}
                  </div>
                  {entry.bullets.length > 0 && (
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700 leading-relaxed">
                      {entry.bullets.map((bullet, index) => (
                        <li key={index}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}
