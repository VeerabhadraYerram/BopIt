export function ConnectionState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <section className="connection-state" role="status">
      <span className="connection-icon" aria-hidden="true">!</span>
      <div>
        <strong>Data unavailable</strong>
        <p>{message}</p>
      </div>
      {retry && <button className="button button-secondary" onClick={retry}>Retry</button>}
    </section>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state-mark" aria-hidden="true">—</span>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
