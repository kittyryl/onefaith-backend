exports.up = function(knex) {
  return knex.schema.createTable('orders', function(table) {
    table.increments('id').primary();
    table.decimal('subtotal').notNullable();
    table.decimal('discount').defaultTo(0);
    table.decimal('total').notNullable();
    table.string('payment_method').notNullable();
    table.decimal('cash_tendered');
    table.decimal('change_due');
    table.string('order_type');
    table.string('discount_type');
    table.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.integer('shift_id').references('id').inTable('shifts').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('orders');
};
