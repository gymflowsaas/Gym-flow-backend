const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const validator = require('../helpers/validator');
const config = require('../server/config');
const jwt = require('jsonwebtoken');
const commonController = require('../controllers/commonController');

router.use(function (req, res, next) {
  var token = req.headers['x-access-token']
  var refreshtoken = req.headers['refresh-token']

  if (refreshtoken) {
    jwt.verify(refreshtoken, config.jwt_secret, function (err, decoded) {
      if (err) {
        res.setHeader('Authentication', false)
        return res.json({
          status: false,
          Authentication: false,
          message: 'Failed to authenticate token.',
          invalidToken: true
        })
      } else {
        res.setHeader('Authentication', true)
        req.decoded = decoded
        var newtoken = jwt.sign(
          { email: req.decoded.email, user_id: req.decoded.user_id },
          config.jwt_secret,
          {
            expiresIn: '24h'
          }
        )
        var newrefreshtoken = jwt.sign(
          { email: req.decoded.email, user_id: req.decoded.user_id },
          config.jwt_secret,
          {
            expiresIn: '240000h'
          }
        )
        res.setHeader('AuthToken', newtoken)
        res.setHeader('RefreshToken', newrefreshtoken)
        next();
      }
    })
  } else {
    if (token) {
      jwt.verify(token, config.jwt_secret, function (err, decoded) {
        if (err) {
          return res.status(401).json({
            status: false,
            Authentication: false,
            message: 'Failed to authenticate token.',
            invalidToken: true
          })
        } else {
          res.setHeader('Authentication', true)
          req.decoded = decoded
          next()
        }
      })
    } else {
      res.setHeader('Authentication', false)
      return res.status(401).json({
        status: false,
        message: 'Failed to authenticate token.'
      })
    }
  }
});

/* GET users listing. */
router.get('/get-members', function (_req, res, _next) {
  res.send('respond with a resource');
});

router.post('/add-member',
  validator.add_member_validator(),
  memberController.addMember,
  function (req, res, _next) {
    if (req.response && req.response.status === true) {
      const respone = {
        succes: true,
        data: {
          message: req.response.message,
          member: req.response.member,
        }
      }
      res.status(200).json(respone);
    } else {
      res.status(500).json(req.response);
    }

  });


module.exports = router;
