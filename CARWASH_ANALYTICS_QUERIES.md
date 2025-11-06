# Carwash Analytics Queries

Now that `carwash_service_line_items` links service tickets to the catalog, you can run powerful analytics queries.

## Popular Services Report (Completed Orders Only)

Find the most requested carwash services (excluding cancelled):

```sql
SELECT 
  cat.name AS service_name,
  cat.category,
  COUNT(*) AS times_ordered,
  SUM(li.quantity) AS total_quantity,
  SUM(li.line_total) AS total_revenue,
  AVG(li.unit_price) AS avg_price
FROM carwash_service_line_items li
JOIN carwash_services cs ON li.service_ticket_id = cs.id
JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
WHERE cs.status != 'cancelled'  -- Exclude cancellations
GROUP BY cat.id, cat.name, cat.category
ORDER BY times_ordered DESC
LIMIT 10;
```

## All Services (Including Cancelled)

See total demand including cancelled orders:

```sql
SELECT 
  cat.name AS service_name,
  cat.category,
  COUNT(*) AS total_requested,
  SUM(CASE WHEN cs.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
  SUM(CASE WHEN cs.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
  SUM(li.line_total) AS total_potential_revenue,
  SUM(CASE WHEN cs.status != 'cancelled' THEN li.line_total ELSE 0 END) AS actual_revenue
FROM carwash_service_line_items li
JOIN carwash_services cs ON li.service_ticket_id = cs.id
JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
GROUP BY cat.id, cat.name, cat.category
ORDER BY total_requested DESC
LIMIT 10;
```

## Services by Vehicle Type (Completed Only)

See which services are popular for each vehicle type:

```sql
SELECT 
  li.vehicle_type,
  cat.name AS service_name,
  COUNT(*) AS times_ordered,
  SUM(li.line_total) AS revenue
FROM carwash_service_line_items li
JOIN carwash_services cs ON li.service_ticket_id = cs.id
JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
WHERE li.vehicle_type IS NOT NULL
  AND cs.status != 'cancelled'  -- Exclude cancellations
GROUP BY li.vehicle_type, cat.name
ORDER BY li.vehicle_type, times_ordered DESC;
```

## Cancellation Analysis

Find which services get cancelled most often:

```sql
SELECT 
  cat.name AS service_name,
  COUNT(*) AS times_cancelled,
  SUM(li.line_total) AS revenue_lost,
  STRING_AGG(DISTINCT cs.cancel_reason, ', ') AS common_reasons
FROM carwash_service_line_items li
JOIN carwash_services cs ON li.service_ticket_id = cs.id
JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
WHERE cs.status = 'cancelled'
GROUP BY cat.name
ORDER BY times_cancelled DESC;
```

## Revenue by Service Over Time (Completed Only)

Track service revenue trends:

```sql
SELECT 
  DATE(cs.created_at) AS date,
  cat.name AS service_name,
  COUNT(DISTINCT cs.id) AS tickets,
  SUM(li.line_total) AS daily_revenue
FROM carwash_service_line_items li
JOIN carwash_services cs ON li.service_ticket_id = cs.id
JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
WHERE cs.created_at >= NOW() - INTERVAL '30 days'
  AND cs.status != 'cancelled'  -- Exclude cancellations
GROUP BY DATE(cs.created_at), cat.name
ORDER BY date DESC, daily_revenue DESC;
```

## Unused Catalog Items

Find services that are never ordered (candidates for removal):

```sql
SELECT 
  cat.id,
  cat.name,
  cat.category,
  cat.is_active
FROM carwash_services_catalog cat
LEFT JOIN carwash_service_line_items li ON cat.id = li.catalog_service_id
WHERE li.id IS NULL
  AND cat.is_active = true
ORDER BY cat.display_order;
```

## Complete Service Details

Get full details with cashier and catalog info:

```sql
SELECT 
  cs.order_id,
  cs.created_at,
  cs.status,
  cs.vehicle_type,
  cs.plate_number,
  cs.customer_name,
  u.full_name AS cashier_name,
  cat.name AS service_name,
  li.unit_price,
  li.quantity,
  li.line_total
FROM carwash_services cs
LEFT JOIN orders o ON cs.order_id_fk = o.id
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN carwash_service_line_items li ON cs.id = li.service_ticket_id
LEFT JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
ORDER BY cs.created_at DESC
LIMIT 50;
```

## Price Changes Detection

Compare current catalog prices vs historical sales prices:

```sql
SELECT 
  cat.name AS service_name,
  li.vehicle_type,
  AVG(li.unit_price) AS avg_historical_price,
  cp.price AS current_catalog_price,
  cp.price - AVG(li.unit_price) AS price_difference
FROM carwash_service_line_items li
JOIN carwash_services_catalog cat ON li.catalog_service_id = cat.id
JOIN carwash_service_prices cp ON cat.id = cp.service_id AND li.vehicle_type = cp.vehicle_type
WHERE cp.is_active = true
GROUP BY cat.name, li.vehicle_type, cp.price
HAVING ABS(cp.price - AVG(li.unit_price)) > 0.01
ORDER BY price_difference DESC;
```
