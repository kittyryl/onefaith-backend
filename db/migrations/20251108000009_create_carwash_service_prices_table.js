exports.up = function(knex) {
  return knex.schema.createTable('carwash_service_prices', function(table) {
    table.increments('id').primary();
    table.integer('service_id').notNullable().references('id').inTable('carwash_services_catalog').onDelete('CASCADE');
    table.string('vehicle_type').notNullable();
    table.decimal('price').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.unique(['service_id', 'vehicle_type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('carwash_service_prices');
};
