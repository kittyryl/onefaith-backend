exports.up = function(knex) {
  return knex.schema.createTable('stock_movements', function(table) {
    table.increments('id').primary();
    table.integer('ingredient_id').notNullable().references('id').inTable('ingredients').onDelete('CASCADE');
    table.integer('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.decimal('quantity').notNullable();
    table.string('movement_type').notNullable().checkIn(['IN', 'OUT', 'AUDIT']);
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('ingredient_id', 'idx_stock_movements_ingredient_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('stock_movements');
};
