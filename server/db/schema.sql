-- Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id VARCHAR(255) PRIMARY KEY,
  supplier VARCHAR(255) NOT NULL,
  order_ref VARCHAR(255),
  final_pod VARCHAR(255),
  latest_status VARCHAR(50),
  week_number VARCHAR(10),
  product_name VARCHAR(500),
  quantity NUMERIC,
  cbm NUMERIC,
  receiving_warehouse VARCHAR(255),
  notes TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  forwarding_agent VARCHAR(255),
  incoterm VARCHAR(50),
  vessel_name VARCHAR(255),
  selected_week_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Post-arrival workflow fields
  unloading_start_date TIMESTAMP,
  unloading_completed_date TIMESTAMP,
  inspection_date TIMESTAMP,
  inspection_status VARCHAR(50),
  inspection_notes TEXT,
  inspected_by VARCHAR(255),
  receiving_date TIMESTAMP,
  receiving_status VARCHAR(50),
  receiving_notes TEXT,
  received_by VARCHAR(255),
  received_quantity NUMERIC,
  discrepancies TEXT
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  country VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Warehouse capacity table
CREATE TABLE IF NOT EXISTS warehouse_capacity (
  warehouse_name VARCHAR(255) PRIMARY KEY,
  bins_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shipments_supplier ON shipments(supplier);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(latest_status);
CREATE INDEX IF NOT EXISTS idx_shipments_week ON shipments(week_number);
CREATE INDEX IF NOT EXISTS idx_shipments_updated ON shipments(updated_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
