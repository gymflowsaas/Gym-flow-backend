var fs = require('fs');
var parseString = require('xml2js').parseString;

var config = {

    jwt_secret: process.env.JWT_SECRET,
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT,
    smtp_user: process.env.SMTP_USER,
    smtp_password: process.env.SMTP_PASSWORD

}

module.exports = config;