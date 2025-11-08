const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();

  const adminPassword = await bcrypt.hash('admin123', 10);
  const staffPassword = await bcrypt.hash('staff123', 10);

  await knex('users').insert([
    {
      username: 'admin',
      password_hash: adminPassword,
      full_name: 'Administrator',
      role: 'manager'
    },
    {
      username: 'staff',
      password_hash: staffPassword,
      full_name: 'Staff User',
      role: 'staff'
    }
  ]);
};
