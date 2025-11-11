-- WARNING: This will permanently delete ALL order, order item, and shift data!
-- Run this in a transaction if you want to be able to roll back.

BEGIN;

-- Delete all order items
DELETE FROM order_items;

-- Delete all orders
DELETE FROM orders;

-- Optionally, delete all shifts (if you want a full reset)
DELETE FROM shifts;

COMMIT;
