exports.up = function(knex) {
  return knex.schema.createTable('carwash_services', function(table) {
    table.increments('id').primary();
    table.text('order_id').unique().notNullable();
    table.integer('order_id_fk').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.text('status').notNullable().defaultTo('queue');
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamp('cancelled_at').nullable();
    table.text('vehicle_type').nullable();
    table.text('plate_number').nullable();
    table.text('customer_name').nullable();
    table.text('customer_phone').nullable();
    table.text('cancel_reason').nullable();
    table.text('payment_method').nullable();
    table.decimal('total', 12, 2).notNullable().defaultTo(0);
    table.jsonb('items').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('carwash_services');
};
