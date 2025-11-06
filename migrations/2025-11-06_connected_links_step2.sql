-- Connected ERD links - Step 2: Unique Index (CONCURRENTLY)
-- Run this second in Neon SQL Editor (separate from step 1)

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_ingredients_lower_name
ON ingredients (LOWER(name));
