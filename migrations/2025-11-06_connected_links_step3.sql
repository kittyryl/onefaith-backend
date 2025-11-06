-- Connected ERD links - Step 3: Foreign Keys (NOT VALID)
-- Run this third in Neon SQL Editor
-- These are NOT VALID so they don't block if data is missing
-- Wrapped in DO blocks to ignore "already exists" errors

DO $$
BEGIN
  ALTER TABLE ONLY orders
    ADD CONSTRAINT fk_orders_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE ONLY orders
    ADD CONSTRAINT fk_orders_shift_id
    FOREIGN KEY (shift_id) REFERENCES shifts(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE ONLY order_items
    ADD CONSTRAINT fk_order_items_product_id
    FOREIGN KEY (product_id) REFERENCES products(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE ONLY carwash_services
    ADD CONSTRAINT fk_carwash_services_order_id_fk
    FOREIGN KEY (order_id_fk) REFERENCES orders(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE ONLY stock_movements
    ADD CONSTRAINT fk_stock_movements_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
