let connectionProvider = require('../server/dbConnectionProvider'),
  crypto = require('crypto'),
  merge = require('merge'),
  mysql = require('mysql'),
  //config = require('../helpers/config'),
  config = require('.././server/config'),
  Password = require('node-php-password'),
  nodemailer = require('nodemailer'),
  jwt = require('jsonwebtoken')

let functions = {
  encryptStr(str) {
    var cipher = crypto.createCipher('aes-256-cbc', 'newagesmb')
    var crypted = cipher.update(str, 'utf8', 'hex')
    crypted += cipher.final('hex')
    return crypted
  },
  drecryptStr(enc_data) {
    if (enc_data.length > 22) {
      var decipher = crypto.createDecipher('aes-256-cbc', 'newagesmb')
      var dec = decipher.update(enc_data, 'hex', 'utf8')
      dec += decipher.final('utf8')
      return dec
    } else {
      return enc_data;
    }

  },
  get(table, cond, field = '*', sort = '') {
    var self = this
    var sql = 'SELECT ' + field + ' FROM ' + table
    if (typeof cond == 'object') {
      sql += ' WHERE '
      for (var key in cond) {
        sql += key + " = '" + cond[key] + "' AND "
      }

      sql = sql.substring(0, sql.length - 4)
    }
    if (sort != '') {
      sql += ' ORDER BY ' + sort
    }
    console.log('get-qry', sql)
    return self.selectQuery(sql)
  },
  insert(table, data) {
    var self = this
    var sql = 'INSERT INTO ' + table + ' SET ?'
    if (typeof data == 'object') {
      console.log('insertqry', sql)
      return self.processQuery(sql, data)
    } else {
      return false
    }
  },
  insertMultiple(table, fields, data) {
    var self = this
    var sql = 'INSERT INTO ' + table + ' (' + fields + ') VALUES  ?'
    //if (typeof (data) == "object") {
    return self.processQuery(sql, [data])
    // } else {
    // 	return false;
    // }
  },
  update(table, fields, cond) {
    var self = this
    var sql = 'UPDATE ' + table + ' SET '
    for (var key in fields) {
      sql += key + ' = ?,'
    }
    sql = sql.substring(0, sql.length - 1) + ' WHERE '

    for (var ky in cond) {
      sql += ky + ' = ? AND '
    }
    sql = sql.substring(0, sql.length - 4)

    var original = merge(fields, cond)
    var data = []
    for (var attr in original) {
      data.push(original[attr])
    }
    console.log(sql)
    return self.processQuery(sql, data)
  },
  delete(table, cond) {
    console.log(cond)
    var self = this
    var sql = 'DELETE FROM ' + table + ' WHERE 1'
    if (typeof cond == 'object') {
      for (var key in cond) {
        sql += ' AND ' + key + "='" + cond[key] + "'"
      }
      console.log(sql)
      return self.selectQuery(sql)
    } else {
      return false
    }
  },
  selectQuery(sql) {
    return new Promise((resolve, reject) => {
      let connection = connectionProvider.dbConnectionProvider.getMysqlConnection()
      connection.query(sql, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
      connectionProvider.dbConnectionProvider.closeMysqlConnection(connection)
    })
  },
  processQuery(sql, data) {
    return new Promise((resolve, reject) => {
      let connection = connectionProvider.dbConnectionProvider.getMysqlConnection()
      connection.query(sql, data, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
      connectionProvider.dbConnectionProvider.closeMysqlConnection(connection)
    })
  },
  getCount(table, cond) {
    var self = this
    var sql = 'SELECT count(*) as count FROM ' + table
    if (typeof cond == 'object') {
      sql += ' WHERE '
      for (var key in cond) {
        sql += key + " = '" + cond[key] + "' AND "
      }
      sql = sql.substring(0, sql.length - 4)
    }
    return self.selectQuery(sql)
  },
  encryptPass(password, callb) {
    var cipher = crypto.createCipher(
      config.encrypt_algorithm,
      config.encrypt_pass
    )
    var crypted = cipher.update(password, 'utf8', 'hex')
    crypted += cipher.final('hex')
    callb(crypted)
  },
  decryptPass(user_password, callb) {
    var user_password = '123456'
    var hash = Password.hash(user_password, 'PASSWORD_DEFAULT', { cost: 10 })

    if (Password.verify('123456', hash)) {
      console.log('true')
    } else {
      console.log('false')
    }

    var decipher = crypto.createDecipher(
      config.encrypt_algorithm,
      config.encrypt_pass
    )
    var dec = decipher.update(user_password, 'hex', 'utf8')
    dec += decipher.final('utf8')

    callb(dec)
  },

  sendMail: function (to, subject, email, isEmailTemplate, callback) {
    try {

      const poolConfig = {
        pool: true,
        host: config.smtp_host,
        port: config.smtp_port,
        secure: true, // use SSL
        auth: {
          user: config.smtp_user,
          pass: config.smtp_password
        }
      }

      const transporter = nodemailer.createTransport(poolConfig)

      transporter.verify(function (error, success) {
        if (error) {
          console.log(error)
          callback(error)
        } else {
          if (!isEmailTemplate) {
            var mailOptions = {
              from:
                '"' + Fitbilsass + '" <' + config.smtp_user + '>',
              to: to,
              subject: subject,
              html: email
            }

            transporter.sendMail(mailOptions, function (err, info) {
              if (err) {
                throw err
              } else {
                var response = {
                  status: 'success',
                  message: 'Message sent successfully.'
                }
                callback(response)
              }
            })
          } else {
            const template = email.email_template
            //var template = config.email_header + email.email_template + config.email_footer;

            const mailOptions = {
              from:
                '"' + 'Fitbilsass' + '" <' + config.smtp_user + '>',
              to: to,
              subject: subject,
              html: template
            }

            if (email.cc == 'Y') {
              mailOptions.cc = ''
            }

            if (email.bcc == 'Y') {
              mailOptions.bcc = prefs.adminEmail[0]
            }

            if (email.admin_only == 'Y') {
              mailOptions.to = prefs.adminEmail[0]
            }
            if ((email.attachments == 'Y')) {
              mailOptions.attachments = [
                {
                  // utf-8 string as an attachment
                  filename: email.filename_attachments,
                  path: email.path_attachments
                }
              ]
            }
            transporter.sendMail(mailOptions, function (err, info) {

              if (err) {
                console.log(err)
                throw err
              } else {
                var response = {
                  status: 'success',
                  message: 'Message sent successfully.'
                }

                callback(response)
              }
            })
          }
        }
      })

    } catch (e) {
      callback(e)
    }
  },

  sendMailAttachment: function (
    to,
    subject,
    email,
    isEmailTemplate,
    isattachment,
    callback
  ) {
    try {
      config.getConfig(function (prefs) {
        var poolConfig = {
          pool: true,
          host: prefs.smtpHost[0],
          port: prefs.smtpPort[0],
          secure: true, // use SSL
          auth: {
            user: prefs.smtpUser[0],
            pass: prefs.smtpPass[0]
          }
        }

        var transporter = nodemailer.createTransport(poolConfig)

        transporter.verify(function (error, success) {
          if (error) {
            throw error
          } else {
            if (!isEmailTemplate) {
              var mailOptions = {
                from:
                  '"' + prefs.fromName[0] + '" <' + prefs.fromEmail[0] + '>',
                to: to,
                subject: subject,
                html: email
              }

              transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                  throw err
                } else {
                  var response = {
                    status: 'success',
                    message: 'Message sent successfully.'
                  }
                  callback(response)
                }
              })
            } else {
              var template = email.email_template
              //var template = config.email_header + email.email_template + config.email_footer;

              var mailOptions = {
                from:
                  '"' + prefs.fromName[0] + '" <' + prefs.fromEmail[0] + '>',
                to: to,
                subject: subject,
                html: template,
                attachments: [
                  { filename: 'SignUp Code.PDF', content: isattachment }
                ]
              }

              if (email.cc == 'Y') {
                mailOptions.cc = prefs.adminEmail[0]
              }

              if (email.bcc == 'Y') {
                mailOptions.bcc = prefs.adminEmail[0]
              }

              if (email.admin_only == 'Y') {
                mailOptions.to = prefs.adminEmail[0]
              }

              transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                  throw err
                } else {
                  var response = {
                    status: 'success',
                    message: 'Message sent successfully.'
                  }

                  callback(response)
                }
              })
            }
          }
        })
      })
    } catch (e) {
      callback(e)
    }
  },

  middleware(req, res, next) {
    let token = req.headers['authtoken'] || ''

    let method = req.method

    token = token.replace(/^Bearer\s/, '')

    let verify_response = function (err, decoded) {
      if (!err) {
        req.decoded = decoded
        next()
      } else if (err.name == 'TokenExpiredError') {
        let originalDecoded = jwt.decode(token, { complete: true })

        req.decoded = originalDecoded.payload

        let user = req.decoded

        delete user['exp']
        delete user['iat']

        let jsonFilePath =
          'public/uploads/users/' +
          originalDecoded.payload.user_id +
          '/refreshtoken.json'

        let refreshToken = req.headers['refreshtoken'] || ''

        let jsonObj

        if (fs.existsSync(jsonFilePath))
          jsonObj = jsonfile.readFileSync(jsonFilePath)

        if (jsonObj[refreshToken] == originalDecoded.payload.email) {
          var refreshed = jwt.sign(user, config.secret, {
            expiresIn: 3600
          })
          res.setHeader('AuthToken', refreshed)
          next()
        } else {
          return res.json({
            status: 'fail',
            error: 'Token expired.',
            statusCode: 'TokenExpired'
          })
        }
      } else {
        return res.json({
          status: 'fail',
          error: 'Failed to authenticate token.',
          statusCode: 'TokenInvalid'
        })
      }
    }

    if (method != 'OPTIONS') {
      if (token) {
        jwt.verify(token, config.secret, verify_response)
      } else {
        return res.status(403).send({
          status: 'fail',
          error: 'No token provided.',
          statusCode: 'TokenMissing'
        })
      }
    } else {
      return res.json({
        status: 'success',
        message: 'Server preflight verification success.'
      })
    }
  }
}

module.exports = functions
