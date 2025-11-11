-- WARNING: This will permanently delete an ingredient and all its references. Only use if you are sure!
-- Replace <ingredient_id> with the actual ID you want to delete.

-- 1. Remove all references in stock_movements (or your history table)
DELETE FROM stock_movements WHERE ingredient_id = <ingredient_id>;

-- 2. Now delete the ingredient itself
DELETE FROM ingredients WHERE id = <ingredient_id>;

-- If you have other tables referencing ingredients, you must delete those references first as well.
-- Always backup your data before running destructive queries!