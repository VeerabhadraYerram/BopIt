import { ApiError } from './errors.mjs';

export function parseCsv(input) {
  if (typeof input !== 'string' || !input.trim()) throw new ApiError(400, 'INVALID_CSV', 'The CSV file is empty.');
  if (input.length > 4_500_000) throw new ApiError(413, 'IMPORT_TOO_LARGE', 'CSV files must be 4.5 MB or smaller.');

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === '') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new ApiError(400, 'INVALID_CSV', 'The CSV file contains an unterminated quoted field.');
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  if (rows.length < 2) throw new ApiError(400, 'INVALID_CSV', 'The CSV file must include a header and at least one data row.');
  if (rows.length > 5_001) throw new ApiError(413, 'TOO_MANY_ROWS', 'An import can contain at most 5,000 data rows.');

  const headers = rows[0].map((value, index) => {
    const header = value.replace(/^\uFEFF/, '').trim();
    if (!header) throw new ApiError(400, 'INVALID_CSV_HEADER', `Column ${index + 1} has no header.`);
    return header;
  });
  if (new Set(headers.map(header => header.toLocaleLowerCase())).size !== headers.length) {
    throw new ApiError(400, 'DUPLICATE_CSV_HEADER', 'CSV column names must be unique.');
  }

  return {
    headers,
    rows: rows.slice(1).map((values, index) => ({
      sourceRow: index + 2,
      values,
      errors: values.length === headers.length ? [] : [`Expected ${headers.length} columns but found ${values.length}.`]
    }))
  };
}
