exports.up = function(knex) {
  return knex.schema.createTable('carwash_services_catalog', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('category');
    table.text('description');
    table.boolean('is_active').defaultTo(true);
    table.integer('display_order').defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('carwash_services_catalog');
};
