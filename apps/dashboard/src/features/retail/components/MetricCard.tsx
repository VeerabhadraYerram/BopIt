export function MetricCard({ label, value, icon, tone, caption = 'Owned inventory' }: {
  label: string;
  value: string;
  icon: string;
  tone: string;
  caption?: string;
}) {
  return (
    <section className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-caption">{value === 'Not connected' ? 'Connect data to view' : caption}</span>
    </section>
  );
}
