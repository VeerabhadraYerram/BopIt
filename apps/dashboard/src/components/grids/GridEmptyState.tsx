import type { ReactNode } from 'react';

export function GridEmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="grid-empty-state" role="status">
      <span className="grid-empty-icon" aria-hidden="true">▤</span>
      <strong>{title}</strong>
      <p>{message}</p>
      {action}
    </div>
  );
}
