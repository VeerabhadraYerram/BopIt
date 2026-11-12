import type { ReactNode } from 'react';

interface Channel3MetricCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'sage' | 'peach';
  caption?: string;
  trend?: string;
}

export function Channel3MetricCard({
  label,
  value,
  icon,
  tone = 'sage',
  caption,
  trend
}: Channel3MetricCardProps) {
  const toneClass = tone === 'purple' ? 'blue' : tone === 'sage' ? 'green' : tone === 'peach' ? 'amber' : tone;
  return (
    <section className="metric-card" style={{ minHeight: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div
          className={`metric-icon ${toneClass}`}
          style={tone === 'sage' ? { background: 'var(--sage-light, #e8f1eb)', color: 'var(--sage, #4a7c59)' } : undefined}
        >
          {icon}
        </div>
        <span
          className="metric-label"
          style={{ paddingRight: '38px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={label}
        >
          {label}
        </span>
        <strong className="metric-value" style={{ fontSize: '22px', marginTop: '8px', lineHeight: 1.2 }}>
          {value}
        </strong>
      </div>
      <span className="metric-caption" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'nowrap' }}>
        <span
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}
          title={caption}
        >
          {caption}
        </span>
        {trend && (
          <span style={{ color: 'var(--sage, #4a7c59)', fontWeight: 600, fontSize: '10.5px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {trend}
          </span>
        )}
      </span>
    </section>
  );
}

