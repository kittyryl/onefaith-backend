exports.up = function(knex) {
  return knex.schema.createTable('shifts', function(table) {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('start_time').notNullable().defaultTo(knex.fn.now());
    table.timestamp('end_time');
    table.string('status', 20).notNullable().defaultTo('active').checkIn(['active', 'ended']);
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('user_id', 'idx_shifts_user_id');
    table.index('status', 'idx_shifts_status');
  }).then(() => {
    return knex.raw('CREATE UNIQUE INDEX idx_shifts_active_per_user ON shifts(user_id) WHERE status = \'active\'');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('shifts');
};
