import { useEffect, useRef, useState } from "react";

import { ResumeDocumentView, type ResumeDocumentViewProps } from "@/modules/career/common/components/ResumeDocumentView";
import { Icon } from "@/shared/ui";

const PAGE_WIDTH = 760;
const PAGE_HEIGHT = Math.round((PAGE_WIDTH * 297) / 210); // A4
const ZOOMS = [0.6, 0.8, 1, 1.2];

/** The resume on A4 pages with zoom and a page count, so it can be judged the way it will print. */
export function PagePreview(props: ResumeDocumentViewProps) {
  const [zoom, setZoom] = useState(0.8);
  const [height, setHeight] = useState(PAGE_HEIGHT);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = inner.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pages = Math.max(1, Math.ceil(height / PAGE_HEIGHT));
  const step = (delta: number) => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(z) + delta))] ?? z);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span aria-live="polite">{pages === 1 ? "1 page" : `${pages} pages`} · A4{pages > 2 ? " · long: most employers prefer 1–2 pages" : ""}</span>
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Zoom out" disabled={zoom === ZOOMS[0]} onClick={() => step(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-slate-200 hover:bg-white disabled:opacity-40"><Icon name="minus" size={14} /></button>
          <span className="w-10 text-center font-semibold tabular-nums text-slate-700">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" disabled={zoom === ZOOMS[ZOOMS.length - 1]} onClick={() => step(1)} className="flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-slate-200 hover:bg-white disabled:opacity-40"><Icon name="plus" size={14} /></button>
        </span>
      </div>
      <div className="overflow-auto rounded-2xl bg-slate-100 p-3 sm:p-5">
        <div className="mx-auto" style={{ width: PAGE_WIDTH * zoom, height: Math.max(height, PAGE_HEIGHT) * zoom }}>
          <div ref={inner} className="relative origin-top-left bg-white shadow-lift" style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT, transform: `scale(${zoom})` }}>
            <ResumeDocumentView {...props} />
            {pages > 1 && Array.from({ length: pages - 1 }, (_, i) => (
              <div key={i} aria-hidden className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-slate-300" style={{ top: PAGE_HEIGHT * (i + 1) }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
