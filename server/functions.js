var nodemailer = require('nodemailer');
var config = require('./config');
var connectionProvider = require("./dbConnectionProvider");
var crypto = require('crypto');
var merge = require('merge');
var fs = require('fs');
var ses = require('node-ses');

var functions = {
	get: function (table, cond, callb) {
		var self = this;
		var sql = "SELECT * FROM " + table;
		if (typeof (cond) == "object") {
			sql += " WHERE 1";
			for (var key in cond) {
				sql += " AND ";
				sql += key + " = '" + cond[key] + "'";
			}
		}

		self.selectQuery(sql, function (result) {
			callb(result);
		});
	},
	getCount: function (table, cond, callb) {
		var self = this;
		var sql = "SELECT count(*) as cnt FROM " + table;
		if (typeof (cond) == "object") {
			sql += " WHERE 1";
			for (var key in cond) {
				sql += " AND ";
				sql += key + " = '" + cond[key] + "'";
			}
		}

		self.selectQuery(sql, function (result) {
			callb(result[0]['cnt']);
		});
	},
	insert: function (table, data, callb) {
		var self = this;
		var sql = "INSERT INTO " + table + " SET ?";
		if (typeof (data) == "object") {
			self.processQuery(sql, data, function (result) {
				callb(result);
			})
		} else {
			callb(null);
		}
	},
	update: function (table, fields, cond, callb) {
		var self = this;
		var sql = "UPDATE " + table + " SET ";
		for (var key in fields) {
			sql += key + " = ?,";
		}
		sql = sql.substring(0, sql.length - 1) + " WHERE ";

		for (var ky in cond) {
			sql += ky + " = ? AND ";
		}
		sql = sql.substring(0, sql.length - 4);

		var original = merge(fields, cond);
		var data = [];
		for (var attr in original) {
			data.push(original[attr]);
		}
		self.processQuery(sql, data, function (result) {
			callb(result);
		});
	},
	delete_row: function (table, cond, callb) {
		var self = this;
		var sql = "delete  FROM " + table;
		if (typeof (cond) == "object") {
			sql += " WHERE 1 ";
			for (var key in cond) {
				sql += " AND ";
				sql += key + " = '" + cond[key] + "'";
			}
		}
		self.selectQuery(sql, function (result) {
			callb(result);
		});
	},
	selectQuery: function (sql, callb) {

		try {

			var connection = connectionProvider.dbConnectionProvider.getMysqlConnection();

			connection.query(sql, function (err, result) {
				if (err) { //throw err;
					console.log(err);
					callb({ err: err });
				} else {
					result['err'] = null;
					callb(result);
				}
				connectionProvider.dbConnectionProvider.closeMysqlConnection(connection);

			})
		} catch (e) {

			callb(e);
		}
	},
	processQuery: function (sql, data, callb) {
		try {
			var connection = connectionProvider.dbConnectionProvider.getMysqlConnection();
			var qry = connection.query(sql, data, function (err, result) {
				if (err) { //throw err;
					callb({ err: err });
				} else {
					result['err'] = null;
					callb(result);
				}
				connectionProvider.dbConnectionProvider.closeMysqlConnection(connection);
			})
		} catch (e) {
			callb(e);
		}
	},
	encryptPass: function (password, callb) {
		var cipher = crypto.createCipher(config.encrypt_pass, config.encrypt_algorithm);
		var crypted = cipher.update(password, 'utf8', 'hex');
		crypted += cipher.final('hex');
		callb(crypted);
	},
	decryptPass: function (encrypted, callb) {
		var decipher = crypto.createDecipher(config.encrypt_pass, config.encrypt_algorithm);
		var dec = decipher.update(encrypted, 'hex', 'utf8');
		dec += decipher.final('utf8');
		callb(dec);
	},
	unlinkFiles: function (path) {
		var files = fs.readdirSync(path);
		files.forEach(function (filename, index) {
			fs.unlinkSync(path + filename);
		})
		return;
	}, send_email: function (toEmail, type, email_array, attachments, email_template) {
		//toEmail = 'surya@newagesmb.com';
		functions.get("general_emails", { name: type }, function (result) {
			if (result.length) {
				var email = result[0];
				for (var key in email_array) {
					email['email_template'] = email['email_template'].replace("##" + key + "##", email_array[key]);
					email['email_template'] = email['email_template'].replace("##" + key + "##", email_array[key]);
					email['email_template'] = email['email_template'].replace("##" + key + "##", email_array[key]);
					email['email_subject'] = email['email_subject'].replace("##" + key + "##", email_array[key]);
				}
				if (email_template != '' && email_template != undefined) {
					email['email_template'] = email_template;
				}
				client.sendEmail({
					to: toEmail
					//	, bcc: ['basil@newagesmb.com']
					, from: ' "Matrix" <support@uspowersavers.com>'
					, subject: email['email_subject']
					, message: email['email_template']
					, attachments: attachments
				}, function (err, data, result) {
					if (err) {
						console.log(err);
					}

				});

				// var rawMessage = '';
				// rawMessage += 'To: "BaSIL" <basil@newagesmb.com>\n';
				// rawMessage += 'From: "US Power Savers" <support@uspowersavers.com>\n';
				// rawMessage += "Subject: Hello, World!\n";
				// rawMessage += "Content-Type: multipart/mixed;";
				// rawMessage += "\n";
				// rawMessage += email['email_template'];

				// client.sendRawEmail({
				// 	from: '"US Power Savers" <support@uspowersavers.com>'
				// 	, rawMessage: rawMessage
				// }, function (err, data, res) {
				// 	console.log(err);
				// 	// ...
				// });

			} else {
				console.log("Email Template not found");
			}
		})
	}, send_pushnotification: function (device_token, message, data) {

		if (device_token != '') {

			functions.get('user_device_tokens', { user_id: device_token }, (results) => {
				if (results.length) {
					for (let key in results) {
						functions.send_pushnotification_now(results[key]['fcm_id'], message, data);
					}

				} else {
					functions.send_pushnotification_now(device_token, message, data);
				}

			})

		}
	}, send_pushnotification_now: function (device_token, message, data) {

		if (device_token != '') {

			var FCM = require('fcm-push');
			var serverKey = 'AIzaSyCaTYsYIH6r813H_M4ywMucYFBdiQ_9pR0';
			var fcm = new FCM(serverKey);

			var message = {
				to: device_token,
				data: data,
				priority: "high",
				notification: {
					title: data.title,
					body: message,
					sound: "default",
					icon: "logo_img"
				}
			};

			fcm.send(message)
				.then(function (response) {
					console.log("Successfully sent with response: ", response);
				}).catch(function (err) {
					console.log("Something has gone wrong!");
					console.error(err);
					console.error("device_token:  ", device_token);

				})
		} else {
			console.log("No device token");
		}
	}
}

module.exports = functions;