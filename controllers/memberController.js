const functions = require('../helpers/functions');
const { validationResult } = require('express-validator');
const Password = require('node-php-password')
const config = require('../server/config');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const path = require('path');
const userModel = require('../models/userModel');

const common_functions = require('../helpers/common_functions');

const { request } = require('express');
const { ride_request_payment } = require('../helpers/validator');
const { v4: uuidv4 } = require("uuid");

let handler = {
  async addMember(req, res, next) {
    try {
      // Initialize response object if not already
      req.response = req.response || {};

      // Validation check
      validationResult(req).throw();  // Throws error if validation fails

      // Check if phone number already exists

      // const phone_existing = await functions.get("members", {
      //   phone: req.body.phone,
      // });

      // Check for existing phone number
      // if (phone_existing.length > 0) {
      //   if (phone_existing[0].is_deleted === "Y") {
      //     throw { errors: [{ msg: "Account deleted, please contact admin" }] };
      //   } else if (phone_existing[0].is_blocked === "Y") {
      //     throw { errors: [{ msg: "Account blocked, please contact admin" }] };
      //   } else {
      //     throw { errors: [{ msg: "Phone number already exists" }] };
      //   }
      // }

      // Prepare member data
      const member_data = {
        gym_admin_id: req.body.gym_admin_id,
        full_name: req.body.full_name,
        join_date: req.body.join_date,
        phone: req.body.phone,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss")
      };

      // Insert data into the database
      await functions.insert("members", member_data).then((result) => {
        // Set up the response and JWT tokens
        req.response = {
          status: true,
          message: "Member added successfully",
          member: {
            member_id: result.insertId,
          },
        };
        // Proceed to the next middleware
        next();
      });
    } catch (error) {
      console.log("🚀 ~ addMember ~ error:", error)

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



};

module.exports = handler;