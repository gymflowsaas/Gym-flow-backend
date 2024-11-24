const functions = require('../helpers/functions');
const { validationResult } = require('express-validator');
const Password = require('node-php-password')
const config = require('../server/config');
const jwt = require('jsonwebtoken');
// var twilio = require('twilio');
// const twilio_client = twilio(config.twilio_account_sid, config.twilio_auth_token);
// const Cryptr = require('cryptr');
// const cryptr = new Cryptr(config.encryption_key);
// const fs = require('fs');
// var CryptoJS = require("crypto-js");

var moment = require('moment');
const path = require('path');
var AWS = require('aws-sdk');
const ID = config.s3_id;
const SECRET = config.s3_secret_access_key;
const BUCKET_NAME = config.s3_default_bucket;
const s3 = new AWS.S3({
  accessKeyId: ID,
  secretAccessKey: SECRET
});
const userModel = require('../models/userModel');

const common_functions = require('../helpers/common_functions');

const { request } = require('express');
const { ride_request_payment } = require('../helpers/validator');
const { v4: uuidv4 } = require("uuid");

let handler = {
  async registration(req, res, next) {
    try {
      // Initialize response object if not already
      req.response = req.response || {};

      // Validation check
      validationResult(req).throw();  // Throws error if validation fails

      // Check if the email or phone number already exists
      const existing_data = await functions.get("users", {
        email: req.body.email,
      });
      const phone_existing = await functions.get("users", {
        phone: req.body.phone,
      });

      // Check for existing email
      if (existing_data.length > 0) {
        if (existing_data[0].is_deleted === "Y") {
          throw { errors: [{ msg: "Account deleted, please contact admin" }] };
        } else if (existing_data[0].is_blocked === "Y") {
          throw { errors: [{ msg: "Account blocked, please contact admin" }] };
        } else {
          throw { errors: [{ msg: "Email already exists" }] };
        }
      }

      // Check for existing phone number
      if (phone_existing.length > 0) {
        if (phone_existing[0].is_deleted === "Y") {
          throw { errors: [{ msg: "Account deleted, please contact admin" }] };
        } else if (phone_existing[0].is_blocked === "Y") {
          throw { errors: [{ msg: "Account blocked, please contact admin" }] };
        } else {
          throw { errors: [{ msg: "Phone number already exists" }] };
        }
      }

      // Password hashing and OTP generation
      const enc_pass = Password.hash(req.body.password, "PASSWORD_DEFAULT");
      const otp = Math.floor(1000 + Math.random() * 9000);  // 4-digit OTP

      // Prepare registration data
      const register_data = {
        email: req.body.email,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        phone: req.body.phone,
        password: enc_pass,
        otp: otp,
        device_token: req.body.device_token || "",
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss")
      };

      // Insert data into the database
      await functions.insert("users", register_data).then((result) => {
        // Set up the response and JWT tokens
        req.response = {
          otp_type: "registration",
          status: true,
          message: "Registration successful",
          prev_middleware: "user_registration",
          user: {
            otp: otp,
            user_id: result.insertId,
          },
        };

        // Set the access and refresh tokens in the headers
        // res.setHeader(
        //   "x-access-token",
        //   jwt.sign({ email: req.body.email, user_id: result.insertId }, config.jwt_secret, {
        //     expiresIn: "24h",
        //   })
        // );
        // res.setHeader(
        //   "refresh-token",
        //   jwt.sign({ email: req.body.email, user_id: result.insertId }, config.jwt_secret, {
        //     expiresIn: "240000h",
        //   })
        // );
        const newtoken = jwt.sign(
          { email: req.body.email, user_id: result.insertId },
          config.jwt_secret,
          {
            expiresIn: "24h",
          }
        );
        const newrefreshtoken = jwt.sign(
          { email: req.body.email, user_id: result.insertId },
          config.jwt_secret,
          {
            expiresIn: "24000000h",
          }
        );
        const tokenExpiry = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); // 24 hours in milliseconds
        req.response.access_token = {
          'x-access-token': newtoken,
          'refresh-token': newrefreshtoken,
          'token_expiry': tokenExpiry.toISOString(),
        }
        // Proceed to the next middleware
        next();
      });
    } catch (error) {

      // Handle validation or registration errors
      const errMsg = error.errors && error.errors[0] ? error.errors[0].msg : "Something went wrong";
      req.response = req.response || {};
      req.response.status = false;
      req.response.message = errMsg;
      return res.status(400).json({
        status: false,
        message: errMsg,
      });
      // Pass the error to the next middleware or handler
      //  next();
    }
  },
  async update_profile_image(req, next) {
    let user_data = await functions.get("users", {
      user_id: req.decoded.user_id,
    });

    if (req.body.profile_image) {
      if (req.body.profile_image != "") {
        if (user_data.length > 0) {
          user_data = user_data[0];
          req.response.user_data = user_data; // saving data so that we can use it in next middleware.
          console.log(user_data);
          if (
            user_data.profile_image != "" &&
            user_data.profile_image != null
          ) {
            let image_key = user_data.profile_image
              ? path.basename(user_data.profile_image)
              : "";
            await s3.deleteObject(
              { Bucket: BUCKET_NAME, Key: `${config.cpi_folder}/${image_key}` },
              function (err) {
                if (!err) {
                  req.response.profile_image_delete = true;
                }
              }
            );
          }
          let m = req.body.profile_image.match(
            /^data:([A-Za-z-+\/]+);base64,(.+)$/
          );
          let b = Buffer.from(m[2], "base64");

          var image_name =
            req.decoded.user_id +
            "_customer_prof_pic_" +
            moment().unix() +
            ".jpeg";
          profile_image = image_name;
          var params = {
            Bucket: BUCKET_NAME + `/${config.cpi_folder}`,
            Key: profile_image,
            ACL: "public-read",
            Body: b,
            ContentEncoding: "base64",
            ContentType: "image/jpeg",
          };
          try {
            const { Location, Key } = await s3.upload(params).promise();
            location = Location;

            key = Key;
            req.response.profile_image = location;
            req.response.profile_image_upload = true;
            next();
          } catch (error) {
            console.log(error);
            req.response.profile_image = "";
            req.response.profile_image_upload = false;
            next();
          }
        }
      } else {
        if (user_data.length > 0) {
          user_data = user_data[0];
          req.response.user_data = user_data;
        }
        req.response.profile_image_upload = false;
        next();
      }
    } else {
      if (user_data.length > 0) {
        user_data = user_data[0];
        req.response.user_data = user_data;
      }
      req.response.profile_image_upload = false;
      next();
    }
  },

  
  // async login(req, res, next) {
  //   try {
  //     validationResult(req).throw();

  //     await functions
  //       .get("users", { email: req.body.email })
  //       .then((result) => {
  //         var user_data = result[0];

  //         if (Password.verify(req.body.password, user_data.password)) {
  //           // check if password is correct

  //           if (user_data.is_blocked == "Y") {
  //             throw {
  //               errors: [{ msg: "Account blocked" }],
  //             };
  //           }
  //           if (user_data.is_deleted == "Y") {
  //             throw {
  //               errors: [{ msg: "Account deleted" }],
  //             };
  //           }

  //           if (user_data.account_verified == "N") {
  //             // check if user verified
  //             const otp = Math.floor(1000 + Math.random() * 9000); // step 2 otp generation
  //             functions
  //               .update("users", { otp: otp }, { email: req.body.email })
  //               .then(() => {
  //                 req.response.status = true;
  //                 req.response.message = "Please verify your account";
  //                 req.response.user = {
  //                   otp,
  //                   user_id: user_data.id,
  //                   email: user_data.email,
  //                   verification_pending: true
  //                 }

  //                 const newtoken = jwt.sign(
  //                   { email: user_data.email, user_id: user_data.user_id },
  //                   config.jwt_secret,
  //                   {
  //                     expiresIn: "24h",
  //                   }
  //                 );
  //                 const newrefreshtoken = jwt.sign(
  //                   { email: user_data.email, user_id: user_data.user_id },
  //                   config.jwt_secret,
  //                   {
  //                     expiresIn: "24000000h",
  //                   }
  //                 );
  //                 const tokenExpiry = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); // 24 hours in milliseconds
  //                 req.response.access_token = {
  //                   'x-access-token': newtoken,
  //                   'refresh-token': newrefreshtoken,
  //                   'token_expiry': tokenExpiry.toISOString(),
  //                 }

  //                 next();
  //               });
  //             return false;
  //           }

  //           req.response.status = true;
  //           req.response.message = "Login Successfull";
  //           req.response.user_details = {
  //             user_id: user_data.user_id,
  //             first_name: user_data.first_name,
  //             last_name: user_data.last_name,
  //             phone_prefix: user_data.phone_prefix,
  //             phone: user_data.phone,
  //             verification_status: user_data.verification_status,
  //             email: user_data.email,
  //             profile_image: user_data.profile_image
  //           };
  //           const newtoken = jwt.sign(
  //             { email: result[0].email, user_id: user_data.user_id },
  //             config.jwt_secret,
  //             {
  //               expiresIn: "24h",
  //             }
  //           );
  //           const newrefreshtoken = jwt.sign(
  //             { email: result[0].email, user_id: user_data.user_id },
  //             config.jwt_secret,
  //             {
  //               expiresIn: "24000000h",
  //             }
  //           );
  //           const tokenExpiry = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); // 24 hours in milliseconds
  //           req.response.access_token = {
  //             'x-access-token': newtoken,
  //             'refresh-token': newrefreshtoken,
  //             'token_expiry': tokenExpiry.toISOString(),
  //           }
  //           next();
  //         } else {
  //           req.response.status = false;
  //           req.response.message = "Incorrect Password";
  //           req.response.user_details = {};
  //           next();
  //         }
  //       });
  //   } catch (errors) {
  //     console.log(errors);
  //     var error = errors.errors[0];
  //     req.response.status = false;
  //     req.response.message = error.msg;
  //     next();
  //   }
  // },


  async login(req, res, next) {
    try {
      console.log("Validating request...");
      // Validate request
      validationResult(req).throw();
      console.log("Request validation passed.");
  
      // Fetch user data
      console.log("Fetching user data for email:", req.body.email);
      const result = await functions.get("users", { email: req.body.email });
      if (!result || result.length === 0) {
        console.error("User not found:", req.body.email);
        throw { errors: [{ msg: "User not found" }] };
      }
  
      const user_data = result[0];
      console.log("User data fetched:", user_data);
  
      // Verify password
      console.log("Verifying password for user:", user_data.email);
      if (!Password.verify(req.body.password, user_data.password)) {
        console.error("Password verification failed for user:", user_data.email);
        req.response.status = false;
        req.response.message = "Incorrect Password";
        req.response.user_details = {};
        return next();
      }
      console.log("Password verified for user:", user_data.email);
  
      // Check user account status
      if (user_data.is_blocked === "Y") {
        console.error("User account is blocked:", user_data.email);
        throw { errors: [{ msg: "Account blocked" }] };
      }
      if (user_data.is_deleted === "Y") {
        console.error("User account is deleted:", user_data.email);
        throw { errors: [{ msg: "Account deleted" }] };
      }
  
      // Helper function to generate JWT tokens
      const generateTokens = (email, user_id) => {
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        console.log("Generating tokens for user:", email);
        return {
          'x-access-token': jwt.sign({ email, user_id }, config.jwt_secret, { expiresIn: "24h" }),
          'refresh-token': jwt.sign({ email, user_id }, config.jwt_secret, { expiresIn: "24000000h" }),
          'token_expiry': tokenExpiry.toISOString(),
        };
      };
  
      if (user_data.account_verified === "N") {
        // Account verification needed
        console.log("User account not verified. Generating OTP for:", user_data.email);
        const otp = Math.floor(1000 + Math.random() * 9000); // Generate OTP
        await functions.update("users", { otp }, { email: req.body.email });
        console.log("OTP generated and updated in database for user:", user_data.email);
  
        req.response.status = true;
        req.response.message = "Please verify your account";
        req.response.user = {
          otp,
          user_id: user_data.id,
          email: user_data.email,
          verification_pending: true,
        };
        req.response.access_token = generateTokens(user_data.email, user_data.user_id);
        return next();
      }
  
      // Successful login response
      console.log("Login successful for user:", user_data.email);
      req.response.status = true;
      req.response.message = "Login Successful";
      req.response.user_details = {
        user_id: user_data.user_id,
        first_name: user_data.first_name,
        last_name: user_data.last_name,
        phone_prefix: user_data.phone_prefix,
        phone: user_data.phone,
        verification_status: user_data.verification_status,
        email: user_data.email,
        profile_image: user_data.profile_image,
      };
      req.response.access_token = generateTokens(user_data.email, user_data.user_id);
      next();
    } catch (errors) {
      console.error("An error occurred during login:", errors);
      const error = errors.errors?.[0] || { msg: "An error occurred" };
      req.response.status = false;
      req.response.message = error.msg;
      next();
    }
  },
  
  
  async forgot_password(req, res, next) {
    try {
      validationResult(req).throw();

      let emails = await common_functions.get_email_templates([
        "email_verification",
      ]);
      emails = emails[0];
      emails.email_template = emails.content;

      const subject = "Forgot-Password";
      const otp = Math.floor(1000 + Math.random() * 9000);

      let user_data = await functions.get("users", {
        email: req.body.email,
      });

      functions
        .update("users", { otp: otp }, { email: req.body.email })
        .then(async () => {
          emails.email_template = emails.email_template.replace(
            /##NAME##/,
            user_data[0].first_name + " " + user_data[0].last_name
          );
          emails.email_template = emails.email_template.replace(/##OTP##/, otp);
          const mail_res = await common_functions.send_email(
            req.body.email,
            subject,
            emails,
            true
          );

          if (mail_res == true) {
            req.response.status = true;
            req.response.message = "One time passcode sent to your email";
            next();
          } else {
            req.response.status = false;
            req.response.message = "Mail sent failed, please try again.";
            next();
          }
        });
    } catch (errors) {
      console.log("🚀 ~ forgot_password ~ errors:", errors)
      var error = errors.errors[0];
      req.response.status = false;
      req.response.message = error.msg;
      next();
    }
  },
  async verify_forgot_otp(req, res, next) {
    try {
      validationResult(req).throw();
      await functions
        .get("users", { email: req.body.email })
        .then(async (result) => {
          const user_data = result[0];
          if (user_data.otp == req.body.otp) {
            const uuid = uuidv4();
            await functions
              .update(
                "users",
                { password_reset_token: uuid },
                { email: req.body.email }
              )
              .then(() => {
                req.response.status = true;
                req.response.message = "Forgot otp verification successfull";
                req.response.reset_token = uuid
                next();
              });

          } else {
            req.response.status = false;
            req.response.message = "User verification failed";
            next();
          }
        });
    } catch (errors) {
      var error = errors.errors[0];
      req.response.status = false;
      req.response.message = error.msg;
      next();
    }
  },
  async reset_password(req, res, next) {
    try {
      validationResult(req).throw();
      const enc_pass = Password.hash(req.body.password, "PASSWORD_DEFAULT");
      try {
        await functions
          .update(
            "users",
            { password: enc_pass, password_reset_token: null },
            { email: req.body.email }
          )
          .then(() => {
            req.response.status = true;
            req.response.message = "Password reset successfully";
            next();
          });
      } catch (error) {
        req.response.status = false;
        req.response.message = "Password reset failed!";
        next();
      }
    } catch (errors) {
      const error = errors?.errors[0];
      req.response.status = false;
      req.response.message = error.msg;
      next();
    }
  },

  async user_verification(req, res, next) {
    try {
      validationResult(req).throw();
      await functions
        .get("users", { id: req.decoded.user_id })
        .then((result) => {
          var user_data = result[0];
          try {
            if (req.body.otp == user_data.otp) {
              functions
                .update(
                  "users",
                  { account_verified: "Y" },
                  { id: req.decoded.user_id }
                )
                .then(() => {
                  req.response.status = true;
                  req.response.message = "User verified";
                  req.response.user_details = {
                    first_name: user_data.first_name,
                    last_name: user_data.last_name,
                    phone: user_data.phone,
                    account_verified: "Y",
                    email: user_data.email,
                  };
                  next();
                });
            } else {
              req.response.status = false;
              req.response.message = "Invalid passcode";
              next();
            }
          } catch (e) {
            console.log(e);
            req.response.status = false;
            req.response.message = "User verification failed";
            req.response.error = e;
            next();
          }
        });
    } catch (errors) {
      console.log("🚀 ~ user_verification ~ errors:", errors)
      var error = errors?.errors[0];
      req.response.status = false;
      req.response.message = error.msg;
      next();
    }
  },

  async change_password(req, next) {
    try {
      validationResult(req).throw();
      var user_id = req.decoded.user_id;
      await functions
        .get("users", { user_id: user_id })
        .then((result) => {
          if (result.length > 0) {
            var old_password = result[0].password;
            if (Password.verify(req.body.old_password, old_password)) {
              try {
                var enc_pass = Password.hash(
                  req.body.new_password,
                  "PASSWORD_DEFAULT"
                );
                functions
                  .update(
                    "users",
                    { password: enc_pass },
                    { user_id: req.decoded.user_id }
                  )
                  .then(() => {
                    req.response.status = true;
                    req.response.message = "Password updated";
                    next();
                  });
              } catch (e) {
                req.response.status = false;
                req.response.message = "Password updation error";
                next();
              }
            } else {
              req.response.status = false;
              req.response.message = "The old password entered is incorrect";
              next();
            }
          }
        });
    } catch (errors) {
      console.log(errors);
      var error = errors.errors[0];
      req.response.status = false;
      req.response.message = error.msg;
      next();
    }
  },
  async deactivate_account(req, next) {
    let user_id = req.decoded.user_id;
    try {
      let can_apply = true;
      let laundry_status_data = await userModel.check_user_application_status(
        user_id,
        "laundry"
      );
      let money_status_data = await userModel.check_user_application_status(
        user_id,
        "money"
      );

      let money_request_list = await adminModel.check_agent_block_delete_status(
        "money",
        user_id
      );
      let laundry_request_list = await agentModel.get_laundry_request_list(
        user_id
      );

      for (let i = 0; i < laundry_request_list.length; i++) {
        if (laundry_request_list[i].agent_request_type == "pickup") {
          if (laundry_request_list[i].pickup_agent_id) {
            if (laundry_request_list[i].pickup_agent_id != null) {
              if (
                laundry_request_list[i].pickup_agent_id != req.decoded.user_id
              ) {
                delete laundry_request_list[i];
                continue;
              }
            }
          }
        } else if (laundry_request_list[i].agent_request_type == "delivery") {
          if (laundry_request_list[i].drop_agent_id) {
            if (laundry_request_list[i].drop_agent_id != null) {
              if (
                laundry_request_list[i].drop_agent_id != req.decoded.user_id
              ) {
                delete laundry_request_list[i];
                continue;
              }
            }
          }
        }

        // condition here is to manage same agent getting the same order for both pickup and delivery
        if (
          req.decoded.user_id == laundry_request_list[i].pickup_agent_id &&
          req.decoded.user_id == laundry_request_list[i].drop_agent_id
        ) {
          console.log(
            laundry_request_list[i].order,
            laundry_request_list[i].unique_laundry_request_id
          );
          if (
            laundry_request_list[i].agent_request_type == "pickup" &&
            laundry_request_list[i].order > 9
          ) {
            // a test for deleting same order for delivery agent.
            // a delivery agent will never see the first entry incase he was the pickup agent as well.
            delete laundry_request_list[i];
            continue;
          }
        } else {
          if (req.decoded.user_id == laundry_request_list[i].pickup_agent_id) {
            if (laundry_request_list[i].agent_request_type == "pickup") {
              if (laundry_request_list[i].order > 9) {
                delete laundry_request_list[i];
                continue;
              }
            }
          }
          if (req.decoded.user_id == laundry_request_list[i].drop_agent_id) {
            if (laundry_request_list[i].agent_request_type == "delivery") {
              if (laundry_request_list[i].order < 9) {
                delete laundry_request_list[i];
                continue;
              }
            }
          }
        }

        laundry_request_list[i].request_type =
          common_functions.detect_type_of_request(
            laundry_request_list[i].status
          );
        let laundromat_data = await laundromatModel.get_profile_data(
          laundry_request_list[i].laundromat_id
        );
        laundromat_data = laundromat_data[0];

        delete laundromat_data.stripe_id;
        delete laundromat_data.id;
        delete laundromat_data.license_number;
        delete laundry_request_list[i].laundromat_id;
        delete laundry_request_list[i].pickup_agent_id;
        delete laundry_request_list[i].drop_agent_id;

        laundry_request_list[i].laundromat_data = laundromat_data;
      }
      laundry_request_list = laundry_request_list.filter(
        (item) => item != null
      );

      if (laundry_status_data.length > 0) {
        can_apply = false;
      }
      if (money_status_data.length > 0) {
        can_apply = false;
      }

      if (money_request_list.length > 0) {
        can_apply = false;
      }

      if (laundry_request_list.length > 0) {
        can_apply = false;
      }

      if (can_apply == false) {
        throw {
          errors: [
            {
              msg: "You have an incomplete request, please either cancel it or complete it",
            },
          ],
        };
      }
      await common_functions.insert_delete_log(
        "user",
        user_id,
        moment().format("YYYY-MM-DD HH:mm:ss")
      );

      await functions
        .update("users", { is_deleted: "Y" }, { user_id: user_id })
        .then(() => {
          req.response.status = true;
          req.response.message = "Account deactivation successful";
          next();
        });
    } catch (error) {
      console.log(error);
      req.response.status = false;
      req.response.message = "Account deactivation unsuccessful";
      if (error.errors) {
        req.response.message = error.errors[0].msg;
      }
      req.response.detailed_error = error;
      next();
    }
  },

  async test_push(req, next) {
    let push_notification_data = {
      requester_id: "",
      device_token: [req.body.device_token],
      request_id: "TestID",
      title: `Test push notification `,
      custom_data: {
        type: "test_push",
        request_id: "TestID",
      },
      body: "Test Data",
    };

    req.response.status = true;
    req.response.message = "Push test";
    req.response.push_notification_data = push_notification_data;

    next();
  },

  async logout(req, next) {
    try {

      req.response.status = true;
      req.response.message = "Logout Successfull";
      next();
    } catch (error) {
      console.log(error);
      req.response.message = "Server error";
      req.response.error = error;
      if (error.errors) {
        req.response.message = error.errors[0].msg;
      }
      next();
    }
  },


};

module.exports = handler;