import { useState } from 'react';
import type { GridApi } from 'ag-grid-community';
import { GridExport } from './GridExport';
import { GridSearch } from './GridSearch';

export interface ServerPage {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function GridToolbar<T>({ api, fileName, search, onSearch, serverPage }: {
  api: GridApi<T> | null;
  fileName: string;
  search: string;
  onSearch: (value: string) => void;
  serverPage?: ServerPage;
}) {
  const [columnsVersion, setColumnsVersion] = useState(0);
  const columns = api?.getAllGridColumns() ?? [];
  return (
    <div className="grid-toolbar">
      <GridSearch value={search} onChange={onSearch} />
      <div className="grid-toolbar-actions">
        <details className="grid-columns-control">
          <summary aria-label="Choose visible columns">Columns</summary>
          <div className="grid-columns-menu">
            <strong>Visible columns</strong>
            {columns.map(column => (
              <label key={column.getColId()}>
                <input
                  type="checkbox"
                  checked={column.isVisible()}
                  disabled={column.getColDef().lockVisible}
                  onChange={event => {
                    api?.setColumnsVisible([column], event.target.checked);
                    setColumnsVersion(version => version + 1);
                  }}
                />
                <span>{column.getColDef().headerName || column.getColId()}</span>
              </label>
            ))}
            {!columns.length && <span className="grid-columns-placeholder">Available after the grid loads</span>}
          </div>
        </details>
        <GridExport api={api} fileName={fileName} />
      </div>
      {serverPage && (
        <div className="grid-server-pagination" aria-label="Server pagination">
          <span>{serverPage.total ? `${(serverPage.page - 1) * serverPage.pageSize + 1}–${Math.min(serverPage.page * serverPage.pageSize, serverPage.total)} of ${serverPage.total}` : 'No rows'}</span>
          <button type="button" className="grid-page-button" aria-label="Previous page" disabled={serverPage.page <= 1} onClick={() => serverPage.onPageChange(serverPage.page - 1)}>‹</button>
          <span>Page {serverPage.page}</span>
          <button type="button" className="grid-page-button" aria-label="Next page" disabled={serverPage.page * serverPage.pageSize >= serverPage.total} onClick={() => serverPage.onPageChange(serverPage.page + 1)}>›</button>
        </div>
      )}
      <span className="sr-only" aria-live="polite">{columnsVersion ? 'Column visibility updated' : ''}</span>
    </div>
  );
}
