/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('users', function (table) {
        table.increments('id').primary();
        table.string('email', 100).notNullable();
        table.string('first_name', 100)
        table.string('last_name', 100)
        table.string('password', 50)
        table.string('address', 255);
        table.string('gym_name', 50);
        table.string('phone', 50);
        table.string('otp', 10);
        table.string('device_token', 100);
        table.enu('is_blocked', ['true', 'false']).defaultTo('false');
        table.enu('is_deleted', ['true', 'false']).defaultTo('false');
        table.timestamps(true, true); // created_at, updated_at
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('users');
};
