export function calculateOverview({ totalProducts, inventoryByProduct, inventoryRecords, costedInventoryRecords, inventoryValue }) {
  const products = inventoryByProduct.map(item => ({
    available: Number(item.available_quantity),
    threshold: item.reorder_threshold === null ? null : Number(item.reorder_threshold)
  }));
  return {
    total_products: Number(totalProducts),
    inventory_records: Number(inventoryRecords),
    units_in_stock: products.reduce((sum, item) => sum + item.available, 0),
    in_stock_products: products.filter(item => item.available > 0 && (item.threshold === null || item.available > item.threshold)).length,
    out_of_stock_products: products.filter(item => item.available <= 0).length,
    low_stock_products: products.filter(item => item.available > 0 && item.threshold !== null && item.available <= item.threshold).length,
    costed_inventory_records: Number(costedInventoryRecords),
    total_inventory_records: Number(inventoryRecords),
    inventory_value: inventoryValue.map(item => ({ amount: item.amount, currency: item.currency })),
    revenue: null,
    orders: null
  };
}
