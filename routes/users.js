const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const validator = require('../helpers/validator');
const config = require('../server/config');
const jwt = require('jsonwebtoken');
const commonController = require('../controllers/commonController');

/* GET users listing. */
router.get('/', function (_req, res, _next) {
  res.send('respond with a resource');
});



router.post('/register',
  validator.registration_validator(),
  userController.registration,
  commonController.send_otp_mail,

  function (req, res, _next) {
    if (req.response && req.response.status === true) {
      const respone = {
        success: true,
        data: {
          message: req.response.message,
          user: req.response.user,
          access: req.response.access_token
        }

      }
      res.status(200).json(respone);
    } else {
      console.log('main-err-res---', res)
      res.status(500).json(req.response);
    }

  });



router.post('/login',
  validator.login_validator(),
  userController.login,
  commonController.send_otp_mail,
  function (req, res, _next) {
    if (req.response.status == true) {
      const respone = {
        success: true,
        data: {
          message: req.response.message,
          user: req.response.user_details,
          access: req.response.access_token
        }

      }
      res.status(200).json(respone);
    } else {
      res.status(400).json(req.response);
    }
  });

router.post('/forgot_password',
  validator.forgot_password_validator(),
  userController.forgot_password,
  function (req, res, _next) {
    if (req.response.status == true) {
      res.status(200).json(req.response);
    } else {
      res.status(400).json(req.response);
    }
  });

router.post('/verify_forgot_otp',
  validator.otp_forgot_validator(),
  userController.verify_forgot_otp,
  function (req, res, next) {
    if (req.response.status == true) {
      const resp = {
        success: true,
        data: {
          message: req.response.message,

          reset_token: req.response.reset_token
        }

      }
      res.status(200).json(resp);
    } else {
      res.status(400).json(req.response);
    }
  });


router.post('/reset_password',
  validator.reset_forgot_password(),
  userController.reset_password,
  function (req, res, _next) {
    if (req.response.status == true) {
      res.status(200).json(req.response);
    } else {
      res.status(400).json(req.response);
    }
  });



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


// router.use(
//   function (req, _res, next) { req.response.from = 'user'; next(); },
//   commonController.save_api_log,
//   function (_req, _res, next) {
//     next();
//   })
router.post('/verify_otp', // to verify the user account
  validator.verify_user_validator(),
  userController.user_verification,
  function (req, res, next) {
    if (req.response.status == true) {
      res.status(200).json(req.response);
    } else {
      res.status(401).json(req.response);
    }
  }
);

// router.post('/change_password',
//   validator.change_password_check(),
//   userController.change_password,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(200).json(req.response);
//     }
//   }
// );




// router.post('/verify_new_phone',
//   validator.verify_new_user_phone_validator(),
//   userController.verify_new_phone,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(200).json(req.response);
//     }
//   });

// router.post('/get_laundromat_list',
//   userController.get_laundromats,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/get_laundromat_details',
//   validator.admin_fetch_laundromat_data(),
//   userController.get_laundromat_details,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/final_laundry_calculations',
//   validator.final_laundry_calculations_validator(),
//   userController.final_laundry_calculations,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/last_address_laundromat_data',
//   validator.admin_fetch_laundromat_data(),
//   userController.last_address_laundromat_data,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/get_payment_card_status',
//   userController.get_payment_card_status,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });


// router.post('/submit_laundry_request',
//   function (req, _res, next) { console.log(req.body); next(); },
//   validator.laundry_submit_request_validator(),
//   userController.submit_laundry_request,
//   commonController.send_push_notification,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/application_status',
//   userController.check_user_application_status,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/delete_custom_bank_account',
//   commonController.delete_custom_account,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/save_payment_card',
//   validator.token_validator(),
//   function (req, _res, next) { req.response.card_for = 'user'; next(); },
//   commonController.add_method_to_stripe,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });


// router.post('/get_money_request_home_data',
//   userController.get_money_request_home_data,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/money_request_calculations',
//   validator.final_money_request_calculations_validator(),
//   function (req, _res, next) { req.response.from = 'user'; next(); },
//   userController.get_money_request_calculations,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/money_request_submission',
//   validator.final_money_request_submission_validator(),
//   function (req, _res, next) { req.response.from = 'user'; next(); },
//   commonController.check_if_stripe_customer,
//   userController.check_user_application_status,
//   userController.check_agent_availability,
//   userController.money_request_submission,
//   userController.agent_handle_middleware,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/get_payment_methods',
//   userController.get_payment_methods,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/delete_stripe_card',
//   validator.check_stripe_source_validator(),
//   function (req, _res, next) { req.response.from = 'user'; next(); },
//   commonController.delete_stripe_card,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });


// router.post('/money_request_summary',
//   validator.unique_money_request_id_validator(),
//   userController.money_request_summary,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });


// router.post('/get_order_detail',
//   validator.get_detail_validator(),
//   userController.get_order_detail,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   })

// router.post('/cancel_money_request',
//   validator.unique_money_request_id_validator(),
//   function (req, _res, next) { req.response.share_request_data = true; next(); },
//   userController.cancel_money_request,
//   commonController.send_push_notification,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   })

// router.post('/get_laundry_request_detail',
//   validator.accept_laundry_request_validator(),
//   userController.get_laundry_request_detail,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });


// router.post('/cancel_laundry_request',
//   validator.accept_laundry_request_validator(),
//   userController.cancel_laundry_request,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/laundry_invoice_payment',
//   validator.invoice_update_validator(),
//   userController.laundry_invoice_payment,
//   commonController.send_push_notification,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   })

// router.post('/reject_laundry_invoice_payment',
//   validator.accept_laundry_request_validator(),
//   userController.reject_laundry_invoice_payment,
//   commonController.send_push_notification,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   })

// router.post('/pay_agent',
//   validator.pay_agent_validator(),
//   userController.capture_charge,
//   // userController.transfer_to_agent,
//   // userController.payout_to_agent,
//   agentController.update_order_status, // order status completes/delivers the money order in this statge
//   commonController.send_push_notification,
//   agentController.send_review_push_to_user,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   })

// router.post('/get_money_requests',
//   userController.get_money_list,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// //API for getting completed ride requests for user
// router.post('/get_ride_history',
//   userController.get_ride_list,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/get_laundry_requests',
//   userController.get_laundry_list,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/logout',
//   userController.logout,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/rate_agent',
//   validator.rate_agent_validator(),
//   commonController.rate_agent,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/rate_agent_ride',
//   validator.rate_agent_ride_validator(),
//   commonController.rate_agent_ride,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/rate_laundry_request',
//   validator.rate_agent_validator(),
//   userController.rate_laundry_request,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   });

// router.post('/get_agent_radius', // to verify the user account
//   userController.get_agent_radius,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(401).json(req.response);
//     }
//   }
// );

// router.post('/get_sdata', // to verify the user account
//   validator.key_check_validator(),
//   userController.get_stripe_data,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(401).json(req.response);
//     }
//   }
// );

// router.post('/update_push_token', // update token api for user app
//   function (req, _res, next) { req.response.from = 'user'; next(); },
//   validator.token_validator(),
//   commonController.update_push_token,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(401).json(req.response);
//     }
//   }
// );

// router.post('/get_services',
//   userController.get_services,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(401).json(req.response);
//     }
//   }
// );

// router.post('/send_delivery_note',
//   userController.send_delivery_note,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(401).json(req.response);
//     }
//   }
// );

// router.post('/submit_ride_request',
//   validator.final_ride_request_submission_validator(),
//   function (req, _res, next) { req.response.from = 'user'; next(); },
//   commonController.check_if_stripe_customer,
//   userController.check_user_application_status,
//   userController.check_ride_agent_availability,
//   userController.submit_ride_request,
//   userController.ride_agent_handler,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(401).json(req.response);
//     }
//   }
// );

// router.post('/settings',
//   userController.get_settings,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(401).json(req.response);
//     }
//   }
// );

// router.post('/update_offer_price',
//   validator.offer_price_validator(),
//   userController.update_offer_price,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(401).json(req.response);
//     }
//   }
// );

// router.post('/cancel_ride_request',
//   validator.unique_ride_request_id_validator(),
//   function (req, _res, next) { req.response.share_request_data = true; next(); },
//   userController.cancel_ride_request,
//   commonController.send_push_notification,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   })

// router.post('/ride_request_details',
//   validator.unique_ride_request_id_validator(),
//   userController.ride_request_details,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   })

// router.post('/respost_ride_request',
//   validator.ride_repost_validator(),
//   function (req, _res, next) { req.response.from = 'user'; next(); },
//   commonController.check_if_stripe_customer,
//   userController.check_user_application_status,
//   userController.check_ride_agent_availability,
//   userController.repost_ride_request,
//   userController.ride_agent_handler,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   })




// router.post('/ride_send_sms_to_agent',
//   validator.ride_send_sms(),
//   userController.send_sms_to_agent,
//   function (req, res, _next) {
//     if (req.response.status == true) {
//       res.status(200).json(req.response);
//     } else {
//       res.status(400).json(req.response);
//     }
//   })



module.exports = router;