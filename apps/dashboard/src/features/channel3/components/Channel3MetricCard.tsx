interface Channel3MetricCardProps {
  label: string;
  value: string | number;
  icon: string;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  caption?: string;
  trend?: string;
}

export function Channel3MetricCard({
  label,
  value,
  icon,
  tone = 'purple',
  caption,
  trend
}: Channel3MetricCardProps) {
  const toneClass = tone === 'purple' ? 'blue' : tone;
  return (
    <section className="metric-card">
      <div
        className={`metric-icon ${toneClass}`}
        style={tone === 'purple' ? { background: '#f3e8ff', color: '#7e22ce' } : undefined}
      >
        {icon}
      </div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-caption" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{caption}</span>
        {trend && <span style={{ color: '#10b981', fontWeight: 600 }}>{trend}</span>}
      </span>
    </section>
  );
}

