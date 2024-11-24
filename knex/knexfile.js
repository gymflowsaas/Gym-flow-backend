// Update with your config settings.
require('dotenv').config();

module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'Mohid@94',
      database: 'gym-sass'
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    }, seeds: {
      directory: './seeds'  // Updated seeds path
    }
  }
};

