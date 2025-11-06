# Proposed Connected ERD (Enhanced Linking)

This is an optional, more connected design that links sales, inventory, users, and carwash records end‑to‑end. It keeps historical prices safe while enabling richer reporting. Note: automatic inventory deduction is NOT included; inventory remains manual via stock movements.

```mermaid
erDiagram
  USERS ||--o{ SHIFTS : "user_id"
  USERS ||--o{ ORDERS : "user_id"
  SHIFTS ||--o{ ORDERS : "shift_id"

  ORDERS ||--o{ ORDER_ITEMS : "order_id"
  PRODUCTS ||--o{ ORDER_ITEMS : "product_id (nullable)"

  INGREDIENTS ||--o{ STOCK_MOVEMENTS : "ingredient_id"
  USERS ||--o{ STOCK_MOVEMENTS : "user_id"

  CARWASH_SERVICES_CATALOG ||--o{ CARWASH_SERVICE_PRICES : "service_id"
  ORDERS ||--o{ CARWASH_SERVICES : "order_id (nullable)"

  USERS {
    int id PK
    varchar username UK
    text password_hash
    varchar full_name
    varchar role  "manager|staff"
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  SHIFTS {
    int id PK
    int user_id FK
    timestamptz start_time
    timestamptz end_time
    varchar status "active|ended"
    text notes
    timestamptz created_at
  }

  PRODUCTS {
    int id PK
    text name
    text category
    numeric price
    boolean needs_temp
    text image_url
    timestamptz created_at
  }

  INGREDIENTS {
    int id PK
    text name
    text category
    text unit_of_measure
    numeric required_stock
    timestamptz created_at
  }

  STOCK_MOVEMENTS {
    int id PK
    int ingredient_id FK
    int user_id FK
    numeric quantity
    text movement_type "IN|OUT|AUDIT"
    text notes
    timestamptz created_at
  }

  ORDERS {
    int id PK
    int user_id FK
    int shift_id FK
    numeric subtotal
    numeric discount
    numeric total
    text payment_method
    numeric cash_tendered
    numeric change_due
    text order_type
    text discount_type
    timestamptz created_at
  }

  ORDER_ITEMS {
    int id PK
    int order_id FK
    int product_id FK  "nullable"
    text business_unit "Coffee|Carwash"
    text item_type
    numeric unit_price
    int quantity
    numeric line_total
    jsonb item_details
    timestamptz created_at
  }

  CARWASH_SERVICES_CATALOG {
    int id PK
    varchar name
    varchar category
    text description
    boolean is_active
    int display_order
    timestamptz created_at
    timestamptz updated_at
  }

  CARWASH_SERVICE_PRICES {
    int id PK
    int service_id FK
    varchar vehicle_type
    numeric price
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  CARWASH_SERVICES {
    int id PK
    int order_id FK  "nullable"
    timestamptz created_at
    text status
    timestamptz started_at
    timestamptz completed_at
    timestamptz cancelled_at
    text vehicle_type
    text plate_number
    text customer_name
    text customer_phone
    text cancel_reason
    text payment_method
    numeric total
    jsonb items
  }
```

## What this enables

- Traceability and reporting

  - Attribute orders to users and shifts (sales per cashier/shift).
  - Join order items to products for analytics while preserving price snapshots (unit_price stays on order_items).
  - Link carwash service jobs to orders after payment, keeping operational timelines separate.

- Manual inventory control

  - Inventory adjustments are recorded via IN/OUT/AUDIT stock movements only (no automatic deduction from sales).

- Cleaner auditing
  - STOCK_MOVEMENTS have user_id for who performed the action.
  - Foreign keys prevent orphan rows and allow safe cascades where appropriate.

## Constraints and indexes

- New FKs/indexes (recommended):

  - orders.user_id → users(id), index on orders(user_id)
  - orders.shift_id → shifts(id), index on orders(shift_id)
  - order_items.product_id → products(id) (NULL allowed), index on order_items(product_id)
  - carwash_services.order_id → orders(id) (NULL allowed), index on carwash_services(order_id)
  - stock_movements.user_id → users(id), index on stock_movements(user_id)
  - DB-level uniqueness for ingredients: unique index on LOWER(name)

- Keep these existing constraints:
  - shifts: partial unique index one active shift per user
  - carwash_service_prices: unique(service_id, vehicle_type)
  - check constraints for enums (role, status, movement_type, business_unit)

## Migration approach (safe rollout)

1. Schema changes (add columns nullable):

- orders.user_id, orders.shift_id
- order_items.product_id (nullable)
- carwash_services.order_id (nullable)
- stock_movements.user_id (nullable)

2. Add FKs as NOT VALID, then VALIDATE to avoid long locks.
3. Backfill values where known (e.g., current active shift to orders).
4. Update app to write new columns.
5. Keep inventory adjustments manual via stock movements.

## Notes

- History safety: even with product_id, keep unit_price and item_type on order_items to preserve the exact sale value at the time of purchase.
- Optional links: carwash_services.order_id and order_items.product_id can remain NULL for legacy data or workflows where linkage isn’t applicable.
- Soft deletes: prefer deactivating products/services instead of hard deletes to keep FK integrity for historical orders.
- No automatic inventory: sales do not impact ingredient stock automatically; continue to use IN/OUT/AUDIT entries.
