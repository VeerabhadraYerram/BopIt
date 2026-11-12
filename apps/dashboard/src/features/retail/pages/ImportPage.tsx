import { useMemo, useState, type ChangeEvent } from 'react';
import type { ColDef, ICellRendererParams, RowSelectionOptions } from 'ag-grid-community';
import { DataGrid } from '../../../components/grids/DataGrid';
import { PageHeader } from '../../../components/PageHeader';
import { apiErrorMessage } from '../../../lib/api';
import type { ImportPreviewRow } from '../types/grids';
import { confirmCsvImport, previewCsvImport, type CsvImportResult, type CsvPreview } from '../services/retail-service';

type Dataset = 'products' | 'inventory' | 'sales';
interface MappingField {
  key: string;
  label: string;
  required: boolean;
}

const fieldsByDataset: Record<Dataset, MappingField[]> = {
  products: [
    { key: 'title', label: 'Product name', required: true },
    { key: 'sku', label: 'SKU', required: true },
    { key: 'brand', label: 'Brand', required: false },
    { key: 'category', label: 'Category', required: false }
  ],
  inventory: [
    { key: 'sku', label: 'SKU', required: true },
    { key: 'location', label: 'Location', required: true },
    { key: 'quantity_on_hand', label: 'Quantity on hand', required: true },
    { key: 'reorder_threshold', label: 'Reorder threshold', required: false },
    { key: 'unit_cost', label: 'Unit cost', required: false },
    { key: 'currency', label: 'Currency', required: false }
  ],
  sales: [
    { key: 'order_id', label: 'Order ID', required: true },
    { key: 'transaction_date', label: 'Transaction date', required: true },
    { key: 'status', label: 'Transaction status', required: true },
    { key: 'product_sku', label: 'Product SKU', required: true },
    { key: 'quantity', label: 'Quantity', required: true },
    { key: 'unit_price', label: 'Unit price', required: true },
    { key: 'line_total', label: 'Line total (if supplied)', required: false },
    { key: 'currency', label: 'Currency', required: true }
  ]
};

function firstCsvRecord(input: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value === '') {
      quoted = true;
    } else if (character === ',') {
      cells.push(value.trim());
      value = '';
    } else if (character === '\n' || character === '\r') {
      break;
    } else {
      value += character;
    }
  }
  cells.push(value.trim().replace(/^\uFEFF/, ''));
  return cells;
}

function defaultMapping(dataset: Dataset, headers: string[]) {
  const normalized = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, string[]> = {
    title: ['title', 'name', 'product', 'productname'],
    sku: ['sku', 'productsku', 'itemsku'],
    brand: ['brand', 'manufacturer'],
    category: ['category', 'productcategory'],
    location: ['location', 'warehouse', 'store'],
    quantity_on_hand: ['quantityonhand', 'onhand', 'quantity', 'stock', 'availablequantity'],
    reorder_threshold: ['reorderthreshold', 'reorderlevel'],
    unit_cost: ['unitcost', 'cost'],
    currency: ['currency', 'currencycode'],
    order_id: ['orderid', 'order', 'transactionid', 'transaction'],
    transaction_date: ['transactiondate', 'orderdate', 'date'],
    status: ['status', 'transactionstatus', 'paymentstatus'],
    product_sku: ['productsku', 'sku', 'itemsku'],
    quantity: ['quantity', 'units', 'unitssold'],
    unit_price: ['unitprice', 'price', 'saleprice'],
    line_total: ['linetotal', 'lineamount', 'extendedprice', 'subtotal']
  };
  return Object.fromEntries(fieldsByDataset[dataset].flatMap(field => {
    const options = aliases[field.key] || [normalized(field.key)];
    const header = headers.find(candidate => options.includes(normalized(candidate)));
    return header ? [[field.key, header]] : [];
  }));
}

function previewRecord(preview: CsvPreview): ImportPreviewRow[] {
  return preview.rows.map(row => {
    const values = row.mapped;
    return {
      ...row,
      product: String(values.title ?? values.product_sku ?? values.order_id ?? ''),
      sku: String(values.sku ?? values.product_sku ?? '—'),
      quantity: typeof values.quantity_on_hand === 'number' ? values.quantity_on_hand
        : typeof values.quantity === 'number' ? values.quantity : null,
      validation_status: row.valid ? row.will_update ? 'Update' : 'Valid' : 'Invalid',
      validation_message: [...row.errors, ...(row.will_update ? ['Existing record will be updated.'] : [])].join(' · ')
    };
  });
}

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
const getRowId = (row: ImportPreviewRow) => row.id;

export function ImportPage() {
  const [dataset, setDataset] = useState<Dataset>('products');
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fields = fieldsByDataset[dataset];
  const rows = useMemo(() => preview ? previewRecord(preview) : [], [preview]);
  const rowSelection = useMemo<RowSelectionOptions<ImportPreviewRow>>(() => ({
    mode: 'multiRow',
    selectAll: 'filtered',
    isRowSelectable: node => Boolean(node.data?.valid)
  }), []);
  const columns = useMemo<ColDef<ImportPreviewRow>[]>(() => [
    { field: 'source_row', headerName: 'Source row', minWidth: 105 },
    { field: 'product', headerName: 'Product / order', minWidth: 180, flex: 1, cellClass: 'product-cell', valueFormatter: params => params.value || '—' },
    { field: 'sku', headerName: 'SKU', minWidth: 115, valueFormatter: params => params.value || '—' },
    { field: 'quantity', headerName: 'Quantity', minWidth: 100, valueFormatter: params => params.value === null ? '—' : number.format(params.value) },
    { field: 'validation_status', headerName: 'Validation', minWidth: 120, cellRenderer: (params: ICellRendererParams<ImportPreviewRow, string>) => <span className={`grid-status ${params.data?.valid ? 'valid' : 'invalid'}`}><i />{params.value}</span> },
    { field: 'validation_message', headerName: 'Details', minWidth: 220, flex: 1.2, valueFormatter: params => params.value || '—' }
  ], []);

  function resetImport() {
    setFileName('');
    setCsv('');
    setHeaders([]);
    setMapping({});
    setPreview(null);
    setSelectedIds([]);
    setResult(null);
    setError('');
  }

  function changeDataset(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Dataset;
    setDataset(next);
    setMapping(defaultMapping(next, headers));
    setPreview(null);
    setSelectedIds([]);
    setResult(null);
    setError('');
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setError('');
    setFileName('');
    setCsv('');
    setHeaders([]);
    setMapping({});
    setPreview(null);
    setSelectedIds([]);
    setResult(null);
    if (!file.name.toLocaleLowerCase().endsWith('.csv')) {
      setError('Choose a CSV file.');
      return;
    }
    if (file.size > 4_500_000) {
      setError('CSV files must be 4.5 MB or smaller.');
      return;
    }
    try {
      const contents = await file.text();
      const sourceHeaders = firstCsvRecord(contents);
      if (!sourceHeaders.length || sourceHeaders.some(header => !header)) throw new Error('The first CSV row must contain column headers.');
      if (new Set(sourceHeaders.map(header => header.toLocaleLowerCase())).size !== sourceHeaders.length) throw new Error('CSV column names must be unique.');
      setFileName(file.name);
      setCsv(contents);
      setHeaders(sourceHeaders);
      setMapping(defaultMapping(dataset, sourceHeaders));
    } catch (reason) {
      setError(apiErrorMessage(reason));
    }
  }

  async function createPreview() {
    setBusy(true);
    setError('');
    try {
      const next = await previewCsvImport(dataset, fileName, csv, mapping);
      setPreview(next);
      setSelectedIds([]);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview || !selectedIds.length) return;
    setBusy(true);
    setError('');
    try {
      const imported = await confirmCsvImport(preview.jobId, selectedIds);
      setResult(imported);
      setPreview(null);
      setSelectedIds([]);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="DATA MANAGEMENT"
        title="Import retailer data"
        description="Map a retailer CSV, review every row, then confirm the records to persist."
        action={result ? <button className="button button-secondary" onClick={resetImport}>New import</button> : undefined}
      />
      {result ? (
        <section className="panel import-result" aria-live="polite">
          <div className="import-result-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="eyebrow">IMPORT {result.status.toLocaleUpperCase()}</p>
            <h2>{result.fileName}</h2>
            <p>{result.dataset} · {result.source_rows} source rows</p>
            <div className="import-result-counts">
              <span><strong>{result.imported_rows}</strong> inserted</span>
              <span><strong>{result.updated_rows}</strong> updated</span>
              <span><strong>{result.skipped_rows}</strong> skipped</span>
              <span><strong>{result.rejected_rows}</strong> rejected</span>
            </div>
            {result.dataset === 'sales' && <p className="import-warning">Imported sales are retailer-provided records, not independently verified payment data.</p>}
          </div>
        </section>
      ) : (
        <section className="panel import-workflow">
          <div className="import-steps" aria-label="Import steps">
            <span className={fileName ? 'complete' : 'current'}>1 <b>Choose data</b></span>
            <span className={preview ? 'complete' : fileName ? 'current' : ''}>2 <b>Map &amp; review</b></span>
            <span className={result ? 'complete' : ''}>3 <b>Confirm import</b></span>
          </div>
          <div className="import-controls">
            <label>Dataset
              <select value={dataset} onChange={changeDataset} disabled={busy}>
                <option value="products">Products</option>
                <option value="inventory">Inventory</option>
                <option value="sales">Sales</option>
              </select>
            </label>
            <label className="import-file-field">CSV file
              <input type="file" accept=".csv,text/csv" onChange={selectFile} disabled={busy} />
            </label>
            {fileName && <span className="import-file-name">{fileName}</span>}
          </div>
          {headers.length > 0 && !preview && (
            <div className="mapping-panel">
              <div><h2>Map source columns</h2><p>Required BopIt fields are marked. Column names may be different in your export.</p></div>
              <div className="mapping-grid">
                {fields.map(field => (
                  <label key={field.key}>
                    <span>{field.label}{field.required && <b>Required</b>}</span>
                    <select value={mapping[field.key] || ''} onChange={event => setMapping(current => ({ ...current, [field.key]: event.target.value }))}>
                      {!field.required && <option value="">Not mapped</option>}
                      {headers.map(header => <option value={header} key={`${field.key}-${header}`}>{header}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              {dataset === 'inventory' && <p className="import-hint">Import products first. Inventory rows must match an existing product SKU.</p>}
              {dataset === 'sales' && <p className="import-hint">Import products first. Sales rows require an explicit transaction status and currency. Map a source line total if available; otherwise amounts use quantity × unit price. Taxes, discounts and refunds are not inferred. Only completed, paid, settled or succeeded statuses contribute to revenue.</p>}
              <button className="button button-primary" disabled={busy} onClick={createPreview}>{busy ? 'Validating…' : 'Preview & validate'}</button>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {preview && (
            <div className="import-preview">
              <div className="import-preview-heading">
                <div>
                  <h2>Preview and validation</h2>
                  <p>{preview.validRows} valid · {preview.invalidRows} invalid · select the valid rows to import</p>
                </div>
                <div className="import-preview-actions">
                  <button className="button button-secondary" disabled={busy} onClick={resetImport}>Start over</button>
                  <button className="button button-primary" disabled={busy || selectedIds.length === 0} onClick={confirmImport}>
                    {busy ? 'Importing…' : `Import ${selectedIds.length} selected`}
                  </button>
                </div>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <DataGrid
                rows={rows}
                columns={columns}
                getRowId={getRowId}
                fileName="bopit-import-preview"
                rowSelection={rowSelection}
                onSelectionChanged={selected => setSelectedIds(selected.map(row => row.id))}
                emptyTitle="No CSV records"
                emptyMessage="The selected CSV does not contain data rows."
                height="min(57vh, 560px)"
              />
            </div>
          )}
        </section>
      )}
      {!preview && !result && (
        <section className="panel import-guidance">
          <strong>Data handling</strong>
          <p>Products and inventory with matching identifiers update existing records. Repeated sales order IDs are rejected to prevent double-counting. Currency totals remain separate.</p>
          <p>Imported sales are not independently payment-verified. No demo rows or fabricated records are included.</p>
        </section>
      )}
    </>
  );
}
