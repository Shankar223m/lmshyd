import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { cn } from "@/core/lib/cn";
import { controlClass } from "@/shared/ui/controlStyles";
import { Icon } from "@/shared/ui";

import { JobThumbnail } from "./JobThumbnail";

export type EmployerOrgOption = { id: string; name: string };

type Props = {
  options: EmployerOrgOption[];
  value: string;
  onChange: (organizationId: string) => void;
  invalid?: boolean;
  placeholder?: string;
};

export function EmployerOrgPicker({
  options,
  value,
  onChange,
  invalid,
  placeholder = "Search verified employers…",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => options.find((o) => o.id === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (selected && !open) {
      setQuery(selected.name);
    }
    if (!value && !open) setQuery("");
  }, [selected, value, open]);

  const pick = (id: string, name: string) => {
    onChange(id);
    setQuery(name);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Employer organisation <span className="text-red-500">*</span>
      </label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          className={controlClass(
            invalid,
            cn("h-11 w-full truncate py-2 pl-9 pr-10 text-sm", open && "rounded-b-none border-b-0"),
          )}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onChange("");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown" && !open) setOpen(true);
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle employer list"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => {
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
        >
          <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
        </button>
      </div>

      {selected && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#7DC8F7]/30 bg-[#7DC8F7]/5 px-3 py-2.5">
          <JobThumbnail fallbackLabel={selected.name} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{selected.name}</p>
            <p className="flex items-center gap-1 text-xs text-emerald-700">
              <Icon name="checkCircle" size={14} />
              Verified employer
            </p>
          </div>
        </div>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 max-h-56 w-full overflow-auto rounded-b-xl border border-t-0 border-slate-200 bg-white py-1 shadow-pop"
        >
          {options.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">No verified employers yet.</li>
          ) : filtered.length === 0 ? (
            <li className="px-4 py-4 text-center text-sm text-slate-500">No matches for “{query.trim()}”.</li>
          ) : (
            filtered.map((o) => {
              const active = value === o.id;
              return (
                <li key={o.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50",
                      active && "bg-[#7DC8F7]/10",
                    )}
                    onClick={() => pick(o.id, o.name)}
                  >
                    <JobThumbnail fallbackLabel={o.name} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{o.name}</span>
                    {active ? <Icon name="check" size={16} className="shrink-0 text-[#7DC8F7]" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}