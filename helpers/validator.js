const functions = require('../helpers/functions');
const { check } = require('express-validator');
const Password = require('node-php-password');
const validationHandler = {
    registration_validator: function () {
        return [
            check('email', 'Email missing').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            // check('email', 'Email already exist').custom(async (value, req) => {
            //     await functions.get('users', { email: value }).then(result => {
            //         if (result.length > 0) {
            //             return Promise.reject();
            //         } else {
            //             return Promise.resolve();
            //         }
            //     })
            // }),
            check('password', 'Enter your password').notEmpty(),
            check('password', 'Password must atleaset be 6 charecters long').isLength({ min: 6 }),
            check('first_name', 'First name is required').notEmpty(),
            check('last_name', 'Last name is required').notEmpty(),
            check('phone', 'Phone number is required').notEmpty(),
            check('address', 'Address is required').notEmpty(),
            check('gym_name', 'Gym center name is required').notEmpty()
        ]
    },
    add_member_validator: function () {
        return [
            check('gym_admin_id')
                .notEmpty().withMessage('Gym Admin ID is required')
                .isInt().withMessage('Gym Admin ID must be an integer')
                .custom(async (value) => {
                    const rows = await functions.get('users', { id: value });
                    if (rows?.length === 0) {
                        throw new Error('Invalid Gym Admin ID: Gym admin does not exist');
                    }

                    // If the gym admin exists, the validation passes
                    return true;
                }),
            check('full_name', 'Name missing').notEmpty(),
            check('join_date', 'Joining date missing').notEmpty(),
            check('phone', 'Enter phone number').notEmpty()

        ]
    },
    add_fee_validator: function () {
        return [
            check('member_id')
                .notEmpty().withMessage('Member ID is required')
                .isInt().withMessage('Member ID must be an integer')
                .custom(async (value) => {
                    const rows = await functions.get('members', { id: value });
                    if (rows?.length === 0) {
                        throw new Error('Invalid Member ID: Member does not exist');
                    }

                    // If the Member exists, the validation passes
                    return true;
                }),
            check('month')
                .isIn(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'])
                .withMessage('Invalid month provided. Must be one of: JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP, OCT, NOV, DEC'),

            // Validate 'paid' to be either 'Y' or 'N'
            check('paid')
                .isIn(['Y', 'N'])
                .withMessage('Invalid paid status provided. Must be either Y or N'),

            // Other validations, e.g., for amount, year, etc.
            check('amount')
                .isDecimal()
                .withMessage('Amount must be a valid decimal number'),

            check('year')
                .isInt({ min: 1901, max: 2155 })
                .withMessage('Year must be a valid year between 1901 and 2155'),


        ]
    },
    login_validator: function () {
        return [
            check('email', 'Enter your registered email address').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            check('email', 'Email does not exist').custom(async (value, req) => {
                await functions.get('users', { email: value }).then(result => {

                    if (result.length == 0) {
                        return Promise.reject();
                    } else {
                        return Promise.resolve();
                    }
                })
            }),
            check('password', 'Enter your password').notEmpty()

        ];
    },
    reset_forgot_password: function () {
        return [
            check('email', 'Enter your registered email address').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            check('email', 'Email does not exist').custom(async (value, req) => {
                await functions.get('users', { email: value }).then(result => {

                    if (result.length == 0) {
                        return Promise.reject();
                    } else {
                        return Promise.resolve();
                    }
                })
            }),
            check('token', 'Enter your password reset token').notEmpty(),
            check(['email', 'token'], 'Invalid reset token').custom(async (value, { req }) => {
                const { email, token } = req.body;
                await functions.get('users', { email, password_reset_token: token }).then(result => {

                    if (result.length == 0) {
                        return Promise.reject();
                    } else {
                        return Promise.resolve();
                    }
                })
            }),
            check('password', 'Enter your password').notEmpty(),


        ];
    },
    verify_user_validator: function () {
        return [
            check('otp', 'Please provide your one time passcode').notEmpty()
        ];
    },
    forgot_password_validator: function () {

        return [
            check('email', 'Enter your registered email address').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            check('email', 'Email does not exist').custom(async (value, req) => {
                await functions.get('users', { email: value }).then(result => {
                    if (result.length == 0) {
                        return Promise.reject();
                    } else {
                        return Promise.resolve();
                    }
                })
            })

        ];
    },
    otp_forgot_validator: function () {
        return [
            check('email', 'Enter your registered email address').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            check('otp', 'Please provide one time passcode').notEmpty(),
            check('email', 'Email does not exist').custom(async (value, req) => {
                await functions.get('users', { email: value }).then(result => {
                    if (result.length == 0) {
                        return Promise.reject();
                    } else {
                        return Promise.resolve();
                    }
                })
            })
        ]
    },
    resend_otp_validator: function () {
        return [
            check('otp_type', 'Please provide otp type'),
            check('data', 'Either provide an email or phone number').notEmpty()
        ]
    },
    laundromat_register_validator: function () {
        return [
            check('email', 'Please provide an email address').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            // check('email','Email already exist').custom(async (value,req) => {
            //     await functions.get('laundromat_master',{ email : value }).then(result => {
            //         if(result.length > 0) {
            //             return Promise.reject();
            //         } else {
            //             return Promise.resolve();
            //         }
            //     })
            // }),
            check('password', 'Enter your password').notEmpty(),
            check('password', 'Password must atleaset be 6 charecters long').isLength({ min: 6 }),
            check('business_name', 'Business name is required').notEmpty(),
            check('phone', 'Phone number is required').notEmpty(),
            check('license_number', 'Please provide Business License Number').notEmpty(),
            check('location', 'Please provide location').notEmpty()
        ];
    },
    laundromat_profile_completion_validator: function () {
        return [
            check('services', "Please provide atleast one service.")
        ]
    },
    laundromat_login_validator: function () {
        return [
            check('email', 'Enter your registered email address').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            check('email', 'Email does not exist').custom(async (value, req) => {
                await functions.get('laundromat_master', { email: value }).then(result => {
                    console.log(result)
                    if (result.length == 0) {
                        return Promise.reject();
                    } else {
                        return Promise.resolve();
                    }
                })
            }),
            check('password', 'Enter your password').notEmpty()

        ];
    },
    admin_fetch_user_data: function () {
        return [
            check('user_id', 'Please provide user_id').notEmpty()
        ];
    },
    agent_id_validator: function () {
        return [
            check('agent_id', 'Please provide agent_id').notEmpty()
        ];
    },
    admin_fetch_laundromat_data: function () {
        return [
            check('laundromat_id', 'Please provide laundromat_id').notEmpty()
        ];
    },
    change_password_check: function () {
        return [
            check('old_password', 'Enter your old password').notEmpty(),
            check('new_password', 'Enter your new password').notEmpty(),
            check('new_password', 'New password must atleaset be 6 charecters long').isLength({ min: 6 })
        ]
    },
    laundromat_forgot_password_validator: function () {

        return [
            check('email', 'Enter your registered email address').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            check('email', 'Email does not exist').custom(async (value, req) => {
                await functions.get('laundromat_master', { email: value }).then(result => {
                    if (result.length == 0) {
                        return Promise.reject();
                    } else {
                        return Promise.resolve();
                    }
                })
            })

        ];
    },
    laundromat_otp_forgot_validator: function () {
        return [
            check('email', 'Enter your registered email address').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            check('otp', 'Please provide one time passcode').notEmpty(),
            check('email', 'Email does not exist').custom(async (value, req) => {
                await functions.get('laundromat_master', { email: value }).then(result => {
                    if (result.length == 0) {
                        return Promise.reject();
                    } else {
                        return Promise.resolve();
                    }
                })
            })
        ]
    },
    agent_transition_validator: function () {
        return [
            check('agent_type', 'Please specify Services offered').notEmpty(),
            check('license', 'Please provide license').notEmpty(),
            check('ssn', 'Please provide your Social Security Number').notEmpty(),
            check('vehicle_number', 'Please provide your Vehicle Indentification Number').notEmpty(),
            check('make_and_model', 'Please provide your Vehicle\'s model').notEmpty(),
            check('vehicle_image', 'Please provide Vehicle Image').notEmpty(),
            check('license_image', 'Please provide License Image').notEmpty(),
            check('vehicle_color', 'Please specify Vehicle Colour').notEmpty(),
            check('languages', 'Please specify your known languages').notEmpty(),
            check('vehicle_type', 'Please specify your vehicle type').notEmpty(),
        ];
    },
    user_switch_validator: function () {
        return [
            check('to', 'Please specify the user type that you wish to switch to').notEmpty()
        ]
    },
    token_validator: function () {
        return [
            check('token', 'Please provide a token').notEmpty()
        ]
    },
    bankaccount_validator: function () {
        return [
            check('bank_account_id', 'Please provide a bank account ID').notEmpty()
        ]
    },
    business_profile_validator: function () {
        return [
            check('services', 'Please provide atleast one service').notEmpty(),
        ]
    },
    verify_new_phone_validator: function () {
        return [
            check('otp', 'Please provide passcode').notEmpty(),
            check('phone', 'Please provide new phone number').notEmpty(),
            check('phone_prefix', 'Please provide new phone prefix').notEmpty(),
            check('phone_country_code', 'Please provide new phone country code').notEmpty()
        ]
    },
    verify_new_user_phone_validator: function () {
        return [
            check('otp', 'Please provide passcode').notEmpty(),
            check('phone', 'Please provide new phone number').notEmpty(),
            check('phone_prefix', 'Please provide new phone prefix').notEmpty()
        ]
    },
    external_bank_account_creation_validator: function () {
        return [
            check('first_name', 'Please provide first name').notEmpty(),
            check('last_name', 'Please provide last name').notEmpty(),
            check('ssn', 'Please provide ssn last 4 digits').notEmpty(),
            check('routing_number', 'Please provide routing number').notEmpty(),
            check('account_number', 'Please provide account number').notEmpty(),
            check('address', 'Please provide address').notEmpty(),
            check('city', 'Please provide city').notEmpty(),
            check('state', 'Please provide state').notEmpty(),
            check('zip', 'Please provide zip').notEmpty(),
            check('phone', 'Please provide phone').notEmpty(),
            check('dob', 'Please provide dob').notEmpty()
        ]
    },
    user_side_laundromat_list_validator: function () {
        return [
            check('latitude', 'Please provide your location (latitude missing)').notEmpty(),
            check('longitude', 'Please provide your location (longitude missing)').notEmpty()
        ];
    },
    final_laundry_calculations_validator: function () {
        return [
            check('pickup_latitude', 'Please provide your location (latitude missing)').notEmpty(),
            check('pickup_longitude', 'Please provide your location (longitude missing)').notEmpty(),
            check('pickup_location', 'Please provide your location (address)').notEmpty(),
            check('laundromat_id', 'Please provide laundromat information').notEmpty(),
            check('services', 'Please provide atleast one service').notEmpty(),

        ]
    },
    laundry_submit_request_validator: function () {
        return [
            check('pickup_latitude', 'Please provide your location (latitude missing)').notEmpty(),
            check('pickup_longitude', 'Please provide your location (longitude missing)').notEmpty(),
            check('pickup_location', 'Please provide your location (address)').notEmpty(),
            check('laundromat_id', 'Please provide laundromat information').notEmpty(),
            check('total_distance', 'Please provide total distance').notEmpty(),
            check('delivery_charge', 'Please provide delivery charge').notEmpty(),
            check('service_charge', 'Please provide service charge').notEmpty(),
            check('stripe_transaction_fee', 'Please provide  stripe transaction fee').notEmpty(),
            check('final_apprx_price', 'Please provide final approximate price').notEmpty(),
            check('services', 'Please provide atleast one service').notEmpty(),
            check('total_service_charge', 'Please provide total service charge').notEmpty()
        ]
    },
    request_id_validator: function () {
        return [
            check('request_id', 'Please provide a request id').notEmpty()
        ]
    },
    contact_us_valiator: function () {
        return [
            check('full_name', 'Please provide your name').notEmpty(),
            check('email', 'Please provide your email').notEmpty(),
            check('email', 'Invalid email format').isEmail(),
            check('message', 'Please provide a message').notEmpty()

        ]
    },
    bank_addition_validator: function () {
        return [
            check('first_name', 'Please provide your first name').notEmpty(),
            check('last_name', 'Please provide your last name').notEmpty(),
            check('gender', 'Please provide your gender').notEmpty(),
            check('routing_number', 'Please provide your routing number').notEmpty(),
            check('account_number', 'Please provide your account number').notEmpty(),
            check('ssn_last_4', 'Please provide your SSN Last 4').notEmpty(),
            check('address', 'Please provide your address').notEmpty(),
            check('city', 'Please provide your city').notEmpty(),
            check('state', 'Please provide your state').notEmpty(),
            check('phone', 'Please provide your phone').notEmpty(),
            check('dob', 'Please provide your date of birth').notEmpty(),
            check('zip_code', 'Please provide your zipcode').notEmpty(),
            check('ip_address', 'Please provide your Ip Address').notEmpty()
        ]
    },
    final_money_request_calculations_validator: function () {
        return [
            check('amount', 'Please provide requested amount').notEmpty(),
            check('time_duration', 'Please provide time duration').notEmpty(),
            check('pickup_latitude', 'Please provide location(latitude)').notEmpty(),
            check('pickup_longitude', 'Please provide location(longitude)').notEmpty(),
            check('pickup_location', 'Please provide location').notEmpty()
        ]
    },
    final_money_request_submission_validator: function () {
        return [
            check('service_charge', 'Please provide service charge').notEmpty(),
            check('delivery_charge', 'Please provide delivery charge').notEmpty(),
            check('transaction_fee', 'Please provide delivery charge').notEmpty(),
            check('original_amount', 'Please provide original payable amount').notEmpty(),
            check('final_amount', 'Please provide final payment amount').notEmpty(),
            check('pickup_latitude', 'Please provide location(latitude)').notEmpty(),
            check('pickup_longitude', 'Please provide location(longitude)').notEmpty(),
            check('pickup_location', 'Please provide location').notEmpty(),
            check('stripe_card_id', 'Please provide payment card information').notEmpty(),

        ]
    },
    extra_bank_account_add_validator: function () {
        return [
            check('first_name', 'Please provide first name').notEmpty(),
            check('last_name', 'Please provide last name').notEmpty(),
            check('account_number', 'Please provide account number').notEmpty(),
            check('routing_number', 'Please provide routing number').notEmpty()
        ]
    },
    check_stripe_source_validator: function () {
        return [
            check('card_id', 'Please provide a card Id').notEmpty()
        ]
    },
    bank_replace_validator: function () {
        return [
            check('bank_account_id', 'Please provide the account id to delete').notEmpty()
        ]
    },
    incoming_order_detail_validator: function () {
        return [
            check('unique_order_id', 'Please provide order Id').notEmpty()
        ]
    },
    unique_money_request_id_validator: function () {
        return [
            check('unique_money_request_id', 'Please provide unique money request Id').notEmpty()
        ]
    },
    ride_repost_validator: function () {
        return [
            check('ride_request_id', 'Please provide unique ride request Id').notEmpty(),
            check('agent_list', 'Please provide unique ride request Id').notEmpty()

        ]
    },
    ride_update_additional_cost_validator: function () {
        return [
            check('ride_request_id', 'Please provide unique ride request Id').notEmpty(),
            check('additional_cost', 'Please provide additional cost').notEmpty()

        ]
    },
    unique_ride_request_id_validator: function () {
        return [
            check('ride_request_id', 'Please provide unique ride request Id').notEmpty()
        ]
    },
    ride_request_status_update_validator: function () {
        return [
            check('ride_request_id', 'Please provide unique ride request Id').notEmpty(),
            check('status', 'Please provide status').notEmpty()

        ]
    },
    agent_order_status_validator: function () {
        return [
            check('order_status', 'Please provide order status').notEmpty(),
            check('unique_money_request_id', 'Please provide money unique request Id').notEmpty()
        ]
    },
    agent_order_otp_status_validator: function () {
        return [
            check('unique_money_request_id', 'Please provide money unique request Id').notEmpty(),
            check('otp', 'Please provide one time passcode').notEmpty()
        ]
    },
    accept_laundry_request_validator: function () {
        return [
            check('unique_laundry_request_id', 'Please provide order Id').notEmpty()
        ]
    },
    send_pickup_validator: function () {
        return [
            check('unique_laundry_request_id', 'Please provide order Id').notEmpty(),
            check('pickup_date', 'Please provide pickup date').notEmpty(),
            check('pickup_time', 'Please provide pickup time').notEmpty()
        ]
    },
    pickupanddrop_status_change_validator: function () {
        return [
            check('unique_laundry_request_id', 'Please provide order Id').notEmpty(),
            check('order_status', 'Please provide order status').notEmpty()
        ]
    },
    send_invoice_validator: function () {
        return [
            check('unique_laundry_request_id', 'Please provide order Id').notEmpty(),
            // check('actual_normal_wash_weight','Please provide actual normal wash weight').notEmpty(),
            // check('actual_normal_wash_price','Please provide actual normal wash weight').notEmpty(),
            check('finalised_grand_total', '').notEmpty()
        ]
    },
    get_detail_validator: function () {
        return [
            check('type', 'Please provide type of order').notEmpty(),
            check('unique_request_id', 'Please provide unique request Id').notEmpty()
        ]
    },
    invoice_update_validator: function () {
        return [
            check('unique_laundry_request_id', 'Please provide order Id').notEmpty(),
            check('stripe_card_id', 'Please provide payment card Id').notEmpty()
        ]
    },
    pay_agent_validator: function () {
        return [
            check('order_status', 'Order status missing').notEmpty(),
            check('unique_money_request_id', "Please provide money request Id").notEmpty()
        ]
    },
    laundry_request_final_otp_verification_validator: function () {
        return [
            check('order_status', 'Order status missing').notEmpty(),
            check('unique_laundry_request_id', "Please provide money request Id").notEmpty(),
            check('otp', 'Please provide One time passcode').notEmpty()
        ]
    },
    rate_agent_validator: function () {
        return [
            check('rating', 'Please provide a rating value').notEmpty(),
            check('request_id', 'Please provide a rating value').notEmpty(),
            check('request_type', 'Please provide request type').notEmpty()
        ]
    },
    rate_agent_ride_validator: function () {
        return [
            check('rating', 'Please provide a rating value').notEmpty(),
            check('request_id', 'Please provide a rating value').notEmpty(),
            check('request_type', 'Please provide request type').notEmpty(),
            check('is_cancelled', 'Please provide cancel flag').notEmpty()
        ]
    },
    key_check_validator: function () {
        return [
            check('key', 'Key missing').notEmpty()
        ]
    },
    delivery_timing_validator: function () {
        return [
            check('unique_laundry_request_id', 'Laundry request Id missing').notEmpty(),
            check('start_time', 'Start time missing').notEmpty(),
            check('end_time', 'End time missing').notEmpty()
        ]
    },
    final_ride_request_submission_validator: function () {
        return [
            check('original_ride_duration', 'Please provide ride duration').notEmpty(),
            check('vehicle_type', 'Please provide vehicle type').notEmpty(),
            check('is_airport_ride', 'Please specify if it is airport ride or not').notEmpty(),
            check('ride_fee', 'Please provide ride fee').notEmpty(),
            check('operation_fee', 'Please provide operation fee').notEmpty(),
            check('transaction_fee', 'Please provide transaction fee').notEmpty(),
            check('service_charge', 'Please provide service charge').notEmpty(),
            check('original_payable_price', 'Please provide payable price').notEmpty(),
            check('stripe_card_id', 'Please provide payment card information').notEmpty(),
            check('pickup_location', 'Please provide pickup location').notEmpty(),
            check('pickup_latitude', 'Please provide pickup latitude').notEmpty(),
            check('pickup_longitude', 'Please provide pickup longitude').notEmpty(),
            check('dropoff_location', 'Please provide dropoff location').notEmpty(),
            check('dropoff_latitude', 'Please provide dropoff latitude').notEmpty(),
            check('dropoff_longitude', 'Please provide dropoff longitude').notEmpty(),
            check('travel_distance', 'Please provide travel distance').notEmpty(),
            check('agent_fee', 'Please provide agent fee').notEmpty(),
            check('agent_original_fee', 'Please provide agent fee').notEmpty(),
        ]
    },
    offer_price_validator: function () {
        return [
            check('unique_ride_id', 'Ride ID missing').notEmpty(),
            check('offer_price', 'Please provide offer price').notEmpty()
        ]
    },
    admin_vehicle_type_validator: function () {
        return [
            check('id', 'ID missing').notEmpty(),
            check('vehicle_type', 'Please provide vehicle type label').notEmpty(),
            check('operation_fee', 'Please provide vehicle type operation fee').notEmpty(),
            check('per_mile_fee', 'Please provide vehicle type per mile fee').notEmpty(),
            check('active', 'Please provide vehicle type status').notEmpty(),
            check('minimum_ride_fee', 'Please provide vehicle type minimum ride fee').notEmpty(),

        ]
    },
    ride_request_payment: function () {
        return [
            check('unique_ride_id', 'Ride request id missing').notEmpty(),
            check('stripe_card_id', 'Please provide payment card information').notEmpty(),
            check('final_price', 'Final price missing').notEmpty()
        ]
    },
    ride_send_sms: function () {
        return [
            check('sms_body', 'Sms body is missing').notEmpty(),
            check('prefix', 'Prefix is missing').notEmpty(),
            check('phone', 'Phone is missing').notEmpty()
        ]
    }

}

module.exports = validationHandler;

