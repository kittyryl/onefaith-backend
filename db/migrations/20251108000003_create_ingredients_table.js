exports.up = function(knex) {
  return knex.schema.createTable('ingredients', function(table) {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.string('category').notNullable();
    table.string('unit_of_measure');
    table.decimal('required_stock').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('ingredients');
};
