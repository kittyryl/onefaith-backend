-- Migration: Add carwash_service_line_items table to link service tickets to catalog items
-- Date: 2025-11-06
-- Purpose: Enable analytics on which carwash services are most popular

-- Step 1: Create the line items table
CREATE TABLE IF NOT EXISTS carwash_service_line_items (
  id SERIAL PRIMARY KEY,
  service_ticket_id INT NOT NULL,
  catalog_service_id INT NULL,  -- nullable for backward compatibility
  vehicle_type VARCHAR(50) NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_carwash_line_items_ticket_id 
  ON carwash_service_line_items(service_ticket_id);

CREATE INDEX IF NOT EXISTS idx_carwash_line_items_catalog_id 
  ON carwash_service_line_items(catalog_service_id);

-- Step 3: Add foreign keys (NOT VALID for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_carwash_line_items_ticket'
  ) THEN
    ALTER TABLE carwash_service_line_items
      ADD CONSTRAINT fk_carwash_line_items_ticket
      FOREIGN KEY (service_ticket_id)
      REFERENCES carwash_services(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_carwash_line_items_catalog'
  ) THEN
    ALTER TABLE carwash_service_line_items
      ADD CONSTRAINT fk_carwash_line_items_catalog
      FOREIGN KEY (catalog_service_id)
      REFERENCES carwash_services_catalog(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- Step 4 (Optional): Validate constraints after data is clean
-- Run this later after verifying app is writing line items correctly
-- ALTER TABLE carwash_service_line_items VALIDATE CONSTRAINT fk_carwash_line_items_ticket;
-- ALTER TABLE carwash_service_line_items VALIDATE CONSTRAINT fk_carwash_line_items_catalog;
