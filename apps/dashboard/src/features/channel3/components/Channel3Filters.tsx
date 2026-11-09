interface Channel3FiltersProps {
  categories: string[];
  brands: string[];
  selectedCategory: string;
  selectedBrand: string;
  selectedAvailability: string;
  onCategoryChange: (cat: string) => void;
  onBrandChange: (brand: string) => void;
  onAvailabilityChange: (avail: string) => void;
  onReset: () => void;
}

export function Channel3Filters({
  categories,
  brands,
  selectedCategory,
  selectedBrand,
  selectedAvailability,
  onCategoryChange,
  onBrandChange,
  onAvailabilityChange,
  onReset
}: Channel3FiltersProps) {
  const hasActive = selectedCategory !== 'ALL' || selectedBrand !== 'ALL' || selectedAvailability !== 'ALL';

  return (
    <div className="creator-overview-filters">
      <div className="creator-filter-item">
        <label htmlFor="filter-cat">Product Category</label>
        <select
          id="filter-cat"
          value={selectedCategory}
          onChange={e => onCategoryChange(e.target.value)}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
          ))}
        </select>
      </div>

      <div className="creator-filter-item">
        <label htmlFor="filter-brand">Brand</label>
        <select
          id="filter-brand"
          value={selectedBrand}
          onChange={e => onBrandChange(e.target.value)}
        >
          {brands.map(b => (
            <option key={b} value={b}>{b === 'ALL' ? 'All Brands' : b}</option>
          ))}
        </select>
      </div>

      <div className="creator-filter-item">
        <label htmlFor="filter-avail">Stock Availability</label>
        <select
          id="filter-avail"
          value={selectedAvailability}
          onChange={e => onAvailabilityChange(e.target.value)}
        >
          <option value="ALL">All Stock Statuses</option>
          <option value="InStock">In Stock Only</option>
          <option value="OutOfStock">Out of Stock Only</option>
        </select>
      </div>

      {hasActive && (
        <button
          type="button"
          onClick={onReset}
          className="creator-filter-reset-btn"
        >
          ✕ Reset Filters
        </button>
      )}
    </div>
  );
}

