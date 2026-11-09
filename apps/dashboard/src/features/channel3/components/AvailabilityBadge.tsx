interface AvailabilityBadgeProps {
  status: 'InStock' | 'OutOfStock' | null | undefined | string;
}

export function AvailabilityBadge({ status }: AvailabilityBadgeProps) {
  const isInStock = status === 'InStock' || status === 'in_stock' || status === 'available';
  const isOutOfStock = status === 'OutOfStock' || status === 'out_of_stock' || status === 'unavailable';

  let bg = '#f1f5f9';
  let color = '#475569';
  let dotColor = '#94a3b8';
  let text = 'Unknown';

  if (isInStock) {
    bg = '#ecfdf5';
    color = '#065f46';
    dotColor = '#10b981';
    text = 'In Stock';
  } else if (isOutOfStock) {
    bg = '#fef2f2';
    color = '#991b1b';
    dotColor = '#ef4444';
    text = 'Out of Stock';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: bg,
        color
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: dotColor
        }}
      />
      {text}
    </span>
  );
}
