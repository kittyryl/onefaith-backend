-- Connected ERD links - Step 4: Validate FKs (OPTIONAL - run later)
-- Only run this after the app has been writing these columns for a while
-- and you've verified data is clean

ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user_id;
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_shift_id;
ALTER TABLE order_items VALIDATE CONSTRAINT fk_order_items_product_id;
ALTER TABLE carwash_services VALIDATE CONSTRAINT fk_carwash_services_order_id_fk;
ALTER TABLE stock_movements VALIDATE CONSTRAINT fk_stock_movements_user_id;
