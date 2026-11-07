import type { GridApi } from 'ag-grid-community';

export function GridExport<T>({ api, fileName }: { api: GridApi<T> | null; fileName: string }) {
  return (
    <button className="button button-secondary grid-action" type="button" disabled={!api} onClick={() => api?.exportDataAsCsv({ fileName })}>
      <span aria-hidden="true">↓</span> Export CSV
    </button>
  );
}
