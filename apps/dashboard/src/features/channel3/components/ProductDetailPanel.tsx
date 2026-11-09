import { useEffect, useState } from 'react';
import type { Channel3Product, PriceHistoryPoint } from '../services/channel3-types';
import { channel3Service } from '../services/channel3-service';
import { AvailabilityBadge } from './AvailabilityBadge';
import { PriceHistoryChart } from './PriceHistoryChart';

interface ProductDetailPanelProps {
  product: Channel3Product | null;
  onClose?: () => void;
  demoPriceHistory?: PriceHistoryPoint[];
  isDemo?: boolean;
}

export function ProductDetailPanel({ product, onClose, demoPriceHistory, isDemo = false }: ProductDetailPanelProps) {
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    if (!product) {
      setHistory([]);
      return;
    }
    if (isDemo) {
      setHistory(demoPriceHistory || []);
      setHistoryError('');
      setLoadingHistory(false);
      return;
    }

    let isCurrent = true;
    setLoadingHistory(true);
    setHistoryError('');

    channel3Service.getPriceHistory(product.id)
      .then(points => {
        if (!isCurrent) return;
        setHistory(points);
      })
      .catch(() => {
        if (!isCurrent) return;
        setHistory([]);
        setHistoryError('Price history could not be loaded from Channel3.');
      })
      .finally(() => {
        if (isCurrent) setLoadingHistory(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [product, demoPriceHistory, isDemo]);

  if (!product) {
    return (
      <div
        style={{
          padding: '28px',
          textAlign: 'center',
          color: '#64748b',
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0'
        }}
      >
        <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>🔍</span>
          <strong>Select a product to view {isDemo ? 'demo product intelligence' : 'Channel3 Intelligence'}</strong>
        <p style={{ fontSize: '12px', margin: '6px 0 0', color: '#94a3b8' }}>
          {isDemo ? 'Inspect clearly labeled sample seller offers and seeded price history.' : 'Inspect live seller offers, stock status and recorded price fluctuations.'}
        </p>
      </div>
    );
  }

  const discount = product.compareAtPrice && product.price && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          {product.image && (
            <img
              src={product.image}
              alt={product.title}
              style={{
                width: '64px',
                height: '64px',
                objectFit: 'contain',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                padding: '4px'
              }}
            />
          )}
          <div>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {product.brand || 'Channel3 Identified'}
            </span>
            <h3 style={{ margin: '2px 0 4px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
              {product.title}
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {product.category || 'General Merchandise'}
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px'
            }}
            aria-label="Close detail panel"
          >
            ✕
          </button>
        )}
      </div>

      {/* Quick pricing & stock bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          padding: '10px 14px',
          background: '#f8fafc',
          borderRadius: '8px',
          marginBottom: '16px'
        }}
      >
        <div>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Best Price</span>
            <strong style={{ fontSize: '18px', color: '#0f172a' }}>
            {product.price == null ? 'Price unavailable' : `${product.currency || ''} ${product.price.toFixed(2)}`}
          </strong>
        </div>

        {product.compareAtPrice && product.compareAtPrice > (product.price || 0) && (
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Compare At</span>
            <span style={{ fontSize: '14px', textDecoration: 'line-through', color: '#94a3b8' }}>
              ${product.compareAtPrice.toFixed(2)}
            </span>
          </div>
        )}

        {discount > 0 && (
          <span
            style={{
              background: '#dcfce7',
              color: '#15803d',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            {discount}% OFF
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AvailabilityBadge status={product.availability} />
          {product.purchaseUrl && (
            <a
              href={product.purchaseUrl}
              target="_blank"
              rel="noreferrer"
              className="button button-primary"
              style={{
                textDecoration: 'none',
                height: '30px',
                fontSize: '11px',
                background: '#7c3aed'
              }}
            >
              View Offer ↗
            </a>
          )}
        </div>
      </div>

      {/* AG Charts Price History Section */}
      <div style={{ marginBottom: '18px' }}>
        <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 8px' }}>
          {isDemo ? `Demo Price History · ${product.retailer || 'Selected seller'}` : 'Channel3 Price Intelligence (Last 90 Days)'}
        </h4>
        {loadingHistory ? (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px' }}>
            Loading {isDemo ? 'demo' : 'Channel3'} price history…
          </div>
        ) : (
            historyError ? <p role="alert" className="notice error">{historyError}</p> : <PriceHistoryChart
            data={history}
            productTitle={product.title}
            currency={product.currency || ''}
            height={220}
          />
        )}
      </div>

      <p className="muted">{isDemo ? 'Demo dataset: prices and seller offers are synthetic examples, not Channel3 provider responses.' : 'Subscription status is not linked to this web session. Existing alerts are owned by the paired extension installation.'}</p>

      {/* Multi-seller offers list */}
      {product.offers && product.offers.length > 0 && (
        <div>
          <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 8px' }}>
            Available Seller Offers ({product.offers.length})
          </h4>
          <div style={{ display: 'grid', gap: '8px' }}>
            {product.offers.map((offer, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              >
                <div>
                  <strong>{offer.retailer}</strong>
                  <span style={{ color: '#64748b', marginLeft: '8px' }}>
                    {offer.condition || 'Condition not supplied'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AvailabilityBadge status={offer.availability} />
                  <strong style={{ color: '#0f172a' }}>
                    {offer.currency || product.currency || ''} {offer.price.toFixed(2)}
                  </strong>
                  {offer.url && (
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}
                    >
                      Store ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
