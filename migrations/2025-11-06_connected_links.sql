-- Connected ERD links (nullable columns, indexes, NOT VALID FKs)

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
ALTER TABLE IF EXISTS carwash_services
  ADD COLUMN IF NOT EXISTS order_id_fk INT NULL;

CREATE INDEX IF NOT EXISTS idx_carwash_services_order_id_fk ON carwash_services(order_id_fk);

-- Stock movements: who performed the action
ALTER TABLE IF EXISTS stock_movements
  ADD COLUMN IF NOT EXISTS user_id INT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);

-- Enforce unique ingredient names at DB level (case-insensitive)
-- Note: CONCURRENTLY cannot run inside a transaction block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = ANY (current_schemas(false)) AND indexname = 'uniq_ingredients_lower_name'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX CONCURRENTLY uniq_ingredients_lower_name ON ingredients (LOWER(name))';
  END IF;
END$$;

-- Add NOT VALID foreign keys first, to be validated after backfill
DO $$
BEGIN
  BEGIN
    ALTER TABLE ONLY orders
      ADD CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER TABLE ONLY orders
      ADD CONSTRAINT fk_orders_shift_id FOREIGN KEY (shift_id) REFERENCES shifts(id) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER TABLE ONLY order_items
      ADD CONSTRAINT fk_order_items_product_id FOREIGN KEY (product_id) REFERENCES products(id) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER TABLE ONLY carwash_services
      ADD CONSTRAINT fk_carwash_services_order_id_fk FOREIGN KEY (order_id_fk) REFERENCES orders(id) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER TABLE ONLY stock_movements
      ADD CONSTRAINT fk_stock_movements_user_id FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;

-- To finalize later (manual step):
--   ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user_id;
--   ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_shift_id;
--   ALTER TABLE order_items VALIDATE CONSTRAINT fk_order_items_product_id;
--   ALTER TABLE carwash_services VALIDATE CONSTRAINT fk_carwash_services_order_id_fk;
--   ALTER TABLE stock_movements VALIDATE CONSTRAINT fk_stock_movements_user_id;
