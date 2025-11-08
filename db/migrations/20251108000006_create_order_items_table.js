exports.up = function(knex) {
  return knex.schema.createTable('order_items', function(table) {
    table.increments('id').primary();
    table.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.integer('product_id').nullable().references('id').inTable('products').onDelete('SET NULL');
    table.string('business_unit').notNullable();
    table.string('item_type').notNullable();
    table.decimal('unit_price').notNullable();
    table.integer('quantity').notNullable();
    table.decimal('line_total').notNullable();
    table.jsonb('item_details');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('order_id', 'idx_order_items_order_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('order_items');
};
