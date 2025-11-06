-- Connected ERD links - Step 1: Columns and Indexes
-- Run this first in Neon SQL Editor

-- Orders: user and shift linkage
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS user_id INT NULL,
  ADD COLUMN IF NOT EXISTS shift_id INT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id);

-- Order items: optional link to products
ALTER TABLE IF EXISTS order_items
  ADD COLUMN IF NOT EXISTS product_id INT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Carwash services: optional FK to orders (keep existing text ticket id)
-- Note: order_id_fk must match orders.id type (UUID in this case)
ALTER TABLE IF EXISTS carwash_services
  ADD COLUMN IF NOT EXISTS order_id_fk UUID NULL;

CREATE INDEX IF NOT EXISTS idx_carwash_services_order_id_fk ON carwash_services(order_id_fk);

-- Stock movements: who performed the action
ALTER TABLE IF EXISTS stock_movements
  ADD COLUMN IF NOT EXISTS user_id INT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);
