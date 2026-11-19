import type { ReactNode } from "react";

/** Page title block matching campus-drive-lms-ui (eyebrow + h1 + muted). Parent must use `.lms-ui-kit-catalog`. */
export function CampusPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-title-row">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? (
          <p className="muted" style={{ marginTop: 8 }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="page-title-actions">{actions}</div> : null}
    </div>
  );
}