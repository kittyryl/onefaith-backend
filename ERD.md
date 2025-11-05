# Database ERD

Below is the current entity-relationship diagram for the OneFaith POS backend. The diagram is written in Mermaid and should render directly on GitHub.

```mermaid
erDiagram
  USERS ||--o{ SHIFTS : "user_id"
  INGREDIENTS ||--o{ STOCK_MOVEMENTS : "ingredient_id"
  ORDERS ||--o{ ORDER_ITEMS : "order_id"
  CARWASH_SERVICES {
    int id PK
    text order_id UK
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
    timestamp start_time
    timestamp end_time
    varchar status "active|ended"
    text notes
    timestamp created_at
  }

  INGREDIENTS {
    int id PK
    text name
    text category
    text unit_of_measure
    numeric required_stock
  }

  STOCK_MOVEMENTS {
    int id PK
    int ingredient_id FK
    numeric quantity
    text movement_type "IN|OUT|AUDIT"
    text notes
    timestamptz created_at
  }

  ORDERS {
    int id PK
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
    text business_unit "Coffee|Carwash"
    text item_type
    numeric unit_price
    int quantity
    numeric line_total
    jsonb item_details
  }
```

## Notes and constraints

- users.username has a UNIQUE constraint (DB-level) in addition to API checks.
- shifts.user_id references users(id) with ON DELETE CASCADE.
- carwash_services.order_id is UNIQUE; there is no FK to orders because carwash tickets may be created before payment.
- order_items.item_details and carwash_services.items are JSONB for flexible payloads.
- Consider adding this index for stronger data integrity:
  - Unique active shift per user: `CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_shift_per_user ON shifts(user_id) WHERE status = 'active';`

## Source of truth

- Defined from the code in:
  - `backend/create_users_table.js`
  - `backend/create_shifts_table.js`
  - `backend/ingredient_routes.js` (implied schema for ingredients and stock_movements)
  - `backend/product_routes.js` (products table is independent and not referenced by orders)
  - `backend/order_routes.js` (orders and order_items)
  - `backend/carwash_routes.js` (carwash_services)
