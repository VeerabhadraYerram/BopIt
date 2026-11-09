import { useMemo } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgCartesianChartOptions } from 'ag-charts-community';
import type { PriceHistoryPoint } from '../services/channel3-types';

interface PriceHistoryChartProps {
  data: PriceHistoryPoint[];
  productTitle?: string;
  currency?: string;
  height?: number;
}

export function PriceHistoryChart({
  data,
  productTitle = 'Product',
  currency = 'USD',
  height = 240
}: PriceHistoryChartProps) {
  const chartOptions = useMemo<AgCartesianChartOptions>(() => {
    const formattedData = data.map(d => ({
      date: d.timestamp.split('T')[0],
      price: d.price
    }));

    const prices = formattedData.map(d => d.price);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 100;
    const padding = (maxPrice - minPrice) * 0.15 || 10;

    return {
      data: formattedData,
      title: {
        text: `90-Day Price Trend – ${productTitle.slice(0, 38)}${productTitle.length > 38 ? '…' : ''}`
      },
      series: [
        {
          type: 'line',
          xKey: 'date',
          yKey: 'price',
          yName: `Price (${currency})`,
          stroke: '#7c3aed',
          strokeWidth: 2.5,
          marker: {
            size: 5,
            fill: '#7c3aed',
            stroke: '#ffffff',
            strokeWidth: 1.5
          }
        }
      ],
      axes: [
        {
          type: 'category',
          position: 'bottom',
          label: {
            rotation: -30,
            fontSize: 10
          }
        },
        {
          type: 'number',
          position: 'left',
          min: Math.max(0, Math.floor(minPrice - padding)),
          max: Math.ceil(maxPrice + padding),
          label: {
            formatter: (params) => `$${params.value}`
          }
        }
      ],
      legend: {
        enabled: false
      }
    };
  }, [data, productTitle, currency]);

  if (!data || !data.length) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '12px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px dashed #cbd5e1'
        }}
      >
        No 90-day price tracking history recorded for this listing.
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <AgCharts options={chartOptions} />
    </div>
  );
}
