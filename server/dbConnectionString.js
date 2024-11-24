
const dbConnectionString = {

	connection:
	{
		port: '13438',
		host: process.env.HOST,

		user: process.env.USER,

		password: process.env.PASSWORD,

		database: process.env.DATABASE

	}

}

module.exports.dbConnectionString = dbConnectionString;