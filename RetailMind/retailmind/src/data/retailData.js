/**
 * RetailMind Sample Datasets for AG Studio
 * Includes Products, Sales Transactions, and Store Locations
 */

export const productsData = [
  { productId: 'P101', name: 'Ultra Noise-Cancelling Headphones', category: 'Audio', brand: 'SonicWave', unitPrice: 299.99, costPrice: 140.00, stockLevel: 85, reorderPoint: 20, rating: 4.8, status: 'In Stock' },
  { productId: 'P102', name: 'Wireless Ergonomic Keyboard', category: 'Accessories', brand: 'KeyCraft', unitPrice: 129.99, costPrice: 55.00, stockLevel: 142, reorderPoint: 30, rating: 4.6, status: 'In Stock' },
  { productId: 'P103', name: 'Pro Precision Gaming Mouse', category: 'Accessories', brand: 'KeyCraft', unitPrice: 79.99, costPrice: 32.00, stockLevel: 210, reorderPoint: 50, rating: 4.7, status: 'In Stock' },
  { productId: 'P104', name: '4K Ultra-Wide Monitor 34"', category: 'Displays', brand: 'VisionPro', unitPrice: 599.99, costPrice: 310.00, stockLevel: 28, reorderPoint: 15, rating: 4.9, status: 'Low Stock' },
  { productId: 'P105', name: 'Smart Fitness Tracker Watch', category: 'Wearables', brand: 'PulseFit', unitPrice: 199.99, costPrice: 85.00, stockLevel: 94, reorderPoint: 25, rating: 4.5, status: 'In Stock' },
  { productId: 'P106', name: 'USB-C Multiport Hub 8-in-1', category: 'Accessories', brand: 'KeyCraft', unitPrice: 49.99, costPrice: 18.00, stockLevel: 320, reorderPoint: 60, rating: 4.4, status: 'In Stock' },
  { productId: 'P107', name: 'Studio Monitoring Earbuds', category: 'Audio', brand: 'SonicWave', unitPrice: 149.99, costPrice: 65.00, stockLevel: 12, reorderPoint: 20, rating: 4.3, status: 'Low Stock' },
  { productId: 'P108', name: 'Mechanical RGB Numpad', category: 'Accessories', brand: 'KeyCraft', unitPrice: 39.99, costPrice: 15.00, stockLevel: 75, reorderPoint: 20, rating: 4.2, status: 'In Stock' },
  { productId: 'P109', name: 'Curved OLED Gaming Display 27"', category: 'Displays', brand: 'VisionPro', unitPrice: 749.99, costPrice: 420.00, stockLevel: 18, reorderPoint: 10, rating: 4.9, status: 'In Stock' },
  { productId: 'P110', name: 'Active Stylus Pen Pro', category: 'Accessories', brand: 'VisionPro', unitPrice: 89.99, costPrice: 35.00, stockLevel: 160, reorderPoint: 40, rating: 4.6, status: 'In Stock' },
  { productId: 'P111', name: 'Smart Home Speaker & Hub', category: 'Smart Home', brand: 'SonicWave', unitPrice: 119.99, costPrice: 50.00, stockLevel: 68, reorderPoint: 25, rating: 4.4, status: 'In Stock' },
  { productId: 'P112', name: 'Titanium Smart Ring Gen 2', category: 'Wearables', brand: 'PulseFit', unitPrice: 249.99, costPrice: 110.00, stockLevel: 44, reorderPoint: 15, rating: 4.7, status: 'In Stock' }
];

export const salesData = [
  { orderId: 'ORD-5001', productId: 'P101', productName: 'Ultra Noise-Cancelling Headphones', category: 'Audio', channel: 'In-Store', storeLocation: 'New York Flagship', units: 3, unitPrice: 299.99, discount: 0, netRevenue: 899.97, profit: 479.97, customerSegment: 'Consumer', date: '2026-03-01' },
  { orderId: 'ORD-5002', productId: 'P104', productName: '4K Ultra-Wide Monitor 34"', category: 'Displays', channel: 'Online', storeLocation: 'Online Fulfillment East', units: 2, unitPrice: 599.99, discount: 50.00, netRevenue: 1149.98, profit: 529.98, customerSegment: 'Corporate', date: '2026-03-01' },
  { orderId: 'ORD-5003', productId: 'P102', productName: 'Wireless Ergonomic Keyboard', category: 'Accessories', channel: 'In-Store', storeLocation: 'San Francisco Downtown', units: 4, unitPrice: 129.99, discount: 20.00, netRevenue: 499.96, profit: 279.96, customerSegment: 'SMB', date: '2026-03-02' },
  { orderId: 'ORD-5004', productId: 'P105', productName: 'Smart Fitness Tracker Watch', category: 'Wearables', channel: 'Online', storeLocation: 'Online Fulfillment West', units: 5, unitPrice: 199.99, discount: 50.00, netRevenue: 949.95, profit: 524.95, customerSegment: 'Consumer', date: '2026-03-02' },
  { orderId: 'ORD-5005', productId: 'P103', productName: 'Pro Precision Gaming Mouse', category: 'Accessories', channel: 'In-Store', storeLocation: 'Chicago Loop', units: 6, unitPrice: 79.99, discount: 0, netRevenue: 479.94, profit: 287.94, customerSegment: 'Consumer', date: '2026-03-03' },
  { orderId: 'ORD-5006', productId: 'P109', productName: 'Curved OLED Gaming Display 27"', category: 'Displays', channel: 'In-Store', storeLocation: 'Austin Tech Center', units: 1, unitPrice: 749.99, discount: 0, netRevenue: 749.99, profit: 329.99, customerSegment: 'Consumer', date: '2026-03-03' },
  { orderId: 'ORD-5007', productId: 'P106', productName: 'USB-C Multiport Hub 8-in-1', category: 'Accessories', channel: 'Online', storeLocation: 'Online Fulfillment East', units: 10, unitPrice: 49.99, discount: 30.00, netRevenue: 469.90, profit: 289.90, customerSegment: 'Enterprise', date: '2026-03-04' },
  { orderId: 'ORD-5008', productId: 'P112', productName: 'Titanium Smart Ring Gen 2', category: 'Wearables', channel: 'In-Store', storeLocation: 'New York Flagship', units: 2, unitPrice: 249.99, discount: 0, netRevenue: 499.98, profit: 279.98, customerSegment: 'Consumer', date: '2026-03-04' },
  { orderId: 'ORD-5009', productId: 'P101', productName: 'Ultra Noise-Cancelling Headphones', category: 'Audio', channel: 'Online', storeLocation: 'Online Fulfillment West', units: 4, unitPrice: 299.99, discount: 40.00, netRevenue: 1159.96, profit: 599.96, customerSegment: 'SMB', date: '2026-03-05' },
  { orderId: 'ORD-5010', productId: 'P111', productName: 'Smart Home Speaker & Hub', category: 'Smart Home', channel: 'In-Store', storeLocation: 'Seattle Pike Place', units: 3, unitPrice: 119.99, discount: 10.00, netRevenue: 349.97, profit: 199.97, customerSegment: 'Consumer', date: '2026-03-05' },
  { orderId: 'ORD-5011', productId: 'P107', productName: 'Studio Monitoring Earbuds', category: 'Audio', channel: 'In-Store', storeLocation: 'San Francisco Downtown', units: 2, unitPrice: 149.99, discount: 0, netRevenue: 299.98, profit: 169.98, customerSegment: 'Consumer', date: '2026-03-06' },
  { orderId: 'ORD-5012', productId: 'P104', productName: '4K Ultra-Wide Monitor 34"', category: 'Displays', channel: 'In-Store', storeLocation: 'Chicago Loop', units: 3, unitPrice: 599.99, discount: 75.00, netRevenue: 1724.97, profit: 794.97, customerSegment: 'Corporate', date: '2026-03-06' },
  { orderId: 'ORD-5013', productId: 'P105', productName: 'Smart Fitness Tracker Watch', category: 'Wearables', channel: 'In-Store', storeLocation: 'Austin Tech Center', units: 4, unitPrice: 199.99, discount: 20.00, netRevenue: 779.96, profit: 439.96, customerSegment: 'Consumer', date: '2026-03-07' },
  { orderId: 'ORD-5014', productId: 'P110', productName: 'Active Stylus Pen Pro', category: 'Accessories', channel: 'Online', storeLocation: 'Online Fulfillment East', units: 8, unitPrice: 89.99, discount: 35.00, netRevenue: 684.92, profit: 404.92, customerSegment: 'Education', date: '2026-03-07' },
  { orderId: 'ORD-5015', productId: 'P102', productName: 'Wireless Ergonomic Keyboard', category: 'Accessories', channel: 'In-Store', storeLocation: 'Seattle Pike Place', units: 5, unitPrice: 129.99, discount: 25.00, netRevenue: 624.95, profit: 349.95, customerSegment: 'SMB', date: '2026-03-08' }
];

export const storesData = [
  { storeId: 'STR-01', storeName: 'New York Flagship', city: 'New York', region: 'East', squareFeet: 12500, footTrafficMonthly: 45000, monthlySales: 320000, targetSales: 300000, manager: 'Sarah Jenkins' },
  { storeId: 'STR-02', storeName: 'San Francisco Downtown', city: 'San Francisco', region: 'West', squareFeet: 9800, footTrafficMonthly: 38000, monthlySales: 285000, targetSales: 275000, manager: 'David Chen' },
  { storeId: 'STR-03', storeName: 'Chicago Loop', city: 'Chicago', region: 'Midwest', squareFeet: 11000, footTrafficMonthly: 34000, monthlySales: 240000, targetSales: 250000, manager: 'Marcus Vance' },
  { storeId: 'STR-04', storeName: 'Austin Tech Center', city: 'Austin', region: 'South', squareFeet: 8500, footTrafficMonthly: 29000, monthlySales: 215000, targetSales: 200000, manager: 'Elena Rodriguez' },
  { storeId: 'STR-05', storeName: 'Seattle Pike Place', city: 'Seattle', region: 'West', squareFeet: 9200, footTrafficMonthly: 32000, monthlySales: 260000, targetSales: 240000, manager: 'Liam O’Connor' },
  { storeId: 'STR-06', storeName: 'Online Fulfillment East', city: 'Newark', region: 'Online', squareFeet: 85000, footTrafficMonthly: 0, monthlySales: 680000, targetSales: 650000, manager: 'Rachel Adams' },
  { storeId: 'STR-07', storeName: 'Online Fulfillment West', city: 'Reno', region: 'Online', squareFeet: 92000, footTrafficMonthly: 0, monthlySales: 740000, targetSales: 700000, manager: 'Kevin Patel' }
];

export const retailDataSources = {
  sources: [
    {
      id: 'sales_transactions',
      name: 'Sales Transactions',
      description: 'Customer purchases, revenues, product quantities, and profit margins',
      primaryKeyField: 'orderId',
      data: salesData
    },
    {
      id: 'products_inventory',
      name: 'Products & Inventory',
      description: 'Catalog items, categories, brands, price points, and live stock levels',
      primaryKeyField: 'productId',
      data: productsData
    },
    {
      id: 'store_locations',
      name: 'Store Locations & KPIs',
      description: 'Physical and digital fulfillment stores, regional revenue targets, and foot traffic',
      primaryKeyField: 'storeId',
      data: storesData
    }
  ]
};

