export function GridSearch({ value, onChange, label = 'Search rows' }: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="grid-search">
      <span aria-hidden="true">⌕</span>
      <input
        aria-label={label}
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="Search rows"
      />
    </label>
  );
}
