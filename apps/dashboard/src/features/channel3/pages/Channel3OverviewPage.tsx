import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';

export function Channel3OverviewPage() {
  return <div>
    <PageHeader eyebrow="CHANNEL3 INTELLIGENCE" title="Commerce intelligence" description="Catalog and provider reporting are available through the integrated BopIt Channel3 routes." />
    <div className="channel3-overview-links"><Link to="/channel3/products">Search products and price history →</Link><Link to="/channel3/sellers">Compare seller offers →</Link><Link to="/channel3/interest">Load provider reports →</Link><Link to="/channel3/moments">Video moment data status →</Link></div>
    <p className="empty-state">This workspace shows live provider data only after a search or report request. Creator attribution and video moment tracking require additional instrumentation and are not estimated.</p>
  </div>;
}
