exports.up = function(knex) {
	return knex.schema.table('ingredients', function(table) {
		table.boolean('archived').notNullable().defaultTo(false);
	});
};

exports.down = function(knex) {
	return knex.schema.table('ingredients', function(table) {
		table.dropColumn('archived');
	});
};
