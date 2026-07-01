import type { ReactNode } from "react";

// Shared empty-state panel: a centered dashed-border block with a title, optional
// description, and an optional action (CTA button/link). Built from existing tokens
// only — no new colors. Used for first-run and "nothing here yet" states.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
