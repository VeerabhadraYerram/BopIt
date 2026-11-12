import { memo, useCallback, useMemo, useState } from 'react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { ColDef, GetRowIdParams, GridApi, GridReadyEvent, RowSelectionOptions, SelectionChangedEvent } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { GridEmptyState } from './GridEmptyState';
import { GridLoadingState } from './GridLoadingState';
import { GridToolbar, type ServerPage } from './GridToolbar';

const gridTheme = themeQuartz.withParams({
  accentColor: '#4a7c59',
  browserColorScheme: 'inherit',
  spacing: 8,
  headerHeight: 44,
  rowHeight: 52
});
ModuleRegistry.registerModules([AllCommunityModule]);

export interface DataGridProps<T> {
  rows: T[];
  columns: ColDef<T>[];
  getRowId: (row: T) => string;
  fileName: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  search?: string;
  onSearchChange?: (search: string) => void;
  serverPage?: ServerPage;
  rowSelection?: RowSelectionOptions<T>;
  onSelectionChanged?: (rows: T[]) => void;
  height?: string;
  noRowsOverlay?: string;
  floatingFilter?: boolean;
  paginationPageSize?: number;
  paginationPageSizeSelector?: number[] | boolean;
}

function DataGridView<T>({
  rows, columns, getRowId, fileName, loading = false, error, onRetry,
  emptyTitle = 'No rows to display', emptyMessage = 'There is no data available for this grid.',
  search, onSearchChange, serverPage, rowSelection, onSelectionChanged, height = 'min(61vh, 610px)', noRowsOverlay,
  floatingFilter = true, paginationPageSize = 25, paginationPageSizeSelector = [10, 25, 50, 100]
}: DataGridProps<T>) {
  const [api, setApi] = useState<GridApi<T> | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const searchValue = search ?? localSearch;
  const updateSearch = onSearchChange ?? setLocalSearch;
  const defaultColDef = useMemo<ColDef<T>>(() => ({
    sortable: true,
    filter: true,
    floatingFilter,
    resizable: true,
    minWidth: 115,
    wrapHeaderText: false,
    autoHeaderHeight: false
  }), [floatingFilter]);
  const handleGridReady = useCallback((event: GridReadyEvent<T>) => setApi(event.api), []);
  const handleGridDestroy = useCallback(() => setApi(null), []);
  const stableRowId = useCallback((params: GetRowIdParams<T>) => getRowId(params.data), [getRowId]);
  const handleSelectionChanged = useCallback((event: SelectionChangedEvent<T>) => {
    onSelectionChanged?.(event.api.getSelectedRows());
  }, [onSelectionChanged]);

  return (
    <section className="data-grid" aria-label={`${fileName} data grid`}>
      <GridToolbar api={api} fileName={fileName} search={searchValue} onSearch={updateSearch} serverPage={serverPage} />
      {loading
        ? <GridLoadingState />
        : error
          ? <GridEmptyState title="Could not load data" message={error} action={onRetry && <button className="button button-secondary" onClick={onRetry}>Retry</button>} />
          : rows.length === 0
            ? <GridEmptyState title={emptyTitle} message={emptyMessage} />
            : <div className="bopit-grid-theme" style={{ height }}>
              <AgGridReact<T>
                theme={gridTheme}
                rowData={rows}
                columnDefs={columns}
                defaultColDef={defaultColDef}
                rowHeight={52}
                headerHeight={44}
                floatingFiltersHeight={36}
                getRowId={stableRowId}
                quickFilterText={searchValue}
                rowSelection={rowSelection}
                onSelectionChanged={handleSelectionChanged}
                pagination={!serverPage}
                paginationPageSize={paginationPageSize}
                paginationPageSizeSelector={paginationPageSizeSelector}
                multiSortKey="ctrl"
                enableCellTextSelection
                suppressCellFocus
                onGridReady={handleGridReady}
                onGridPreDestroyed={handleGridDestroy}
                overlayNoRowsTemplate={noRowsOverlay || 'No rows match the current search or filters.'}
              />
            </div>}
    </section>
  );
}

export const DataGrid = memo(DataGridView) as typeof DataGridView;
