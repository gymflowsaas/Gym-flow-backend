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
  async addFee(req, res, next) {
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

      // Prepare fee data
      const fee_data = {
        member_id: req.body.member_id,
        month: req.body.month,
        year: req.body.year,
        amount: req.body.amount,
        paid: req.body.paid,
        paid_date: req.body?.paid_date,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss")
      };

      // Insert data into the database
      await functions.insert("monthly_fee", fee_data).then(async (result) => {
        const id = result.insertId;
        const serialNumber = `TX-FEE-${String(id).padStart(6, '0')}`;

        // Update the record with the generated serial number
        await functions.update(
          'monthly_fee', { serial_number: serialNumber }, { id },
        );
        // Set up the response and JWT tokens
        req.response = {
          status: true,
          message: "Fee added successfully",
          fee: {
            fee_id: result.insertId,
          },
        };
        // Proceed to the next middleware
        next();
      });
    } catch (error) {
      console.log("🚀 ~ addFee ~ error:", error)


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