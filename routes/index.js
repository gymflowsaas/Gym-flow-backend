const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const commonController = require('../controllers/commonController');
var path = require('path');

/* GET home page. */
router.get('/', function (req, res) {
  res.render('index', { title: 'Gym Sass API' });
});


router.post('/test_push',
  userController.test_push,
  commonController.send_push_notification,
  function (req, res) {
    res.status(200).json(req.response);
  })


// HTML links for apps
router.get('/terms_and_conditions',
  function (req, res) {
    res.sendFile(path.join(__dirname + '/../public/html/terms_and_conditions.html'));
  })

router.get('/privacy',
  function (req, res) {
    res.sendFile(path.join(__dirname + '/../public/html/privacy_policy.html'));
  })



// cron list
router.get('/push_notification_cron', // cron for sending push to agents incase of more than 2 hour delay in pickup time.
  commonController.cron_push_notification_handler,
  function (req, res) {
    res.status(200).json(req.response);
  })


router.post('/cms', // weekly payout to agents cron
  commonController.cms_fetcher,
  function (req, res) {
    res.status(200).json(req.response);
  })

// weekly crons start

router.post('/weekly_agent_money_cron',
  commonController.weekly_agent_money_req_payout_handler,
  function (req, res) {
    res.status(200).json(req.response);
  });


router.post('/weekly_agent_laundry_cron',
  commonController.weekly_agent_laundry_req_payout_handler,
  function (req, res) {
    res.status(200).json(req.response);
  });

router.post('/weekly_agent_ride_cron',
  commonController.weekly_agent_ride_req_payout_handler,
  function (req, res) {
    res.status(200).json(req.response);
  });

router.post('/weekly_laundromat_payment_cron',
  commonController.weekly_laundromat_payout_handler,
  function (req, res) {
    res.status(200).json(req.response);
  });

router.post('/weekly_admin_payment_cron',
  commonController.weekly_admin_payment_handler,
  function (req, res) {
    res.status(200).json(req.response);
  });

router.post('/weekly_admin_ride_payment_cron',
  commonController.weekly_admin_ride_payout_handler,
  function (req, res) {
    res.status(200).json(req.response);
  });
// weekly crons end

router.post('/mail_test',
  commonController.test_mail,
  function (req, res) {
    res.status(200).json(req.response);
  })



module.exports = router;
