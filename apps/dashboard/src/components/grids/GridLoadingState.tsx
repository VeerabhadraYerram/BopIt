export function GridLoadingState({ label = 'Loading rows…' }: { label?: string }) {
  return <div className="grid-loading-state" role="status" aria-live="polite"><span className="grid-spinner" aria-hidden="true" />{label}</div>;
}
