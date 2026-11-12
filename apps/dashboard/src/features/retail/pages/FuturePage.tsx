import { PageHeader } from '../../../components/PageHeader';

export function FuturePage({ title }: { title: string }) {
  return (
    <>
      <PageHeader eyebrow="FUTURE MODULE" title={title} description="This area is reserved for a separately integrated data source." />
      <section className="panel future-page">
        <span className="future-page-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
        <h2>Not connected</h2>
        <p>This module is not part of the current foundation. No sample customer, payment or AI analysis data is displayed.</p>
      </section>
    </>
  );
}
