import { PageHeader } from '../../../components/PageHeader';

export function FuturePage({ title }: { title: string }) {
  return (
    <>
      <PageHeader eyebrow="FUTURE MODULE" title={title} description="This area is reserved for a separately integrated data source." />
      <section className="panel future-page">
        <span className="future-page-icon">✳</span>
        <h2>Not connected</h2>
        <p>This module is not part of the current foundation. No sample customer, payment or AI analysis data is displayed.</p>
      </section>
    </>
  );
}
