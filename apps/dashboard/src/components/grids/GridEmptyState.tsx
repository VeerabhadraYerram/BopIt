import type { ReactNode } from 'react';

export function GridEmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="grid-empty-state" role="status">
      <span className="grid-empty-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      </span>
      <strong>{title}</strong>
      <p>{message}</p>
      {action}
    </div>
  );
}
