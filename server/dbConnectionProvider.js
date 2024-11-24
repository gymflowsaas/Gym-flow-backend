const mysql = require('mysql2');
const connectionString = require('./dbConnectionString');
const dbConnectionProvider = {

	getMysqlConnection: function () {
		const connection = mysql.createConnection(connectionString.dbConnectionString.connection);
		connection.connect(function (err) {
			if (err) { throw err; }

		});
		return connection;
	},
	closeMysqlConnection: function (currentConnection) {

		if (currentConnection) {
			currentConnection.end(function (err) {
				if (err) { throw err; }

			})
		}

	}

}

module.exports.dbConnectionProvider = dbConnectionProvider;