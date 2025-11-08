exports.up = function(knex) {
  return knex.schema.createTable('products', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('category').notNullable();
    table.decimal('price').notNullable();
    table.boolean('needs_temp').defaultTo(false);
    table.string('image_url');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('products');
};
