exports.up = function(knex) {
  return knex.schema.createTable('carwash_service_line_items', function(table) {
    table.increments('id').primary();
    table.integer('service_ticket_id').notNullable().references('id').inTable('carwash_services').onDelete('CASCADE');
    table.integer('catalog_service_id').nullable().references('id').inTable('carwash_services_catalog').onDelete('SET NULL');
    table.string('vehicle_type');
    table.decimal('unit_price');
    table.integer('quantity');
    table.decimal('line_total');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('carwash_service_line_items');
};
