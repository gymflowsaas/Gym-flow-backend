

const knex = require('knex');
const config = require('./knexfile');

const db = knex({
    ...config.development,
    debug: true,  // Enable debug mode
});

module.exports = db;
