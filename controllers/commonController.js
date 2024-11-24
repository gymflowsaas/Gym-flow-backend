const functions = require('../helpers/functions');
const { validationResult } = require('express-validator');
const config = require('../server/config');
const Stripe = require('stripe');
var stripe;
const moment = require('moment');

const common_functions = require('../helpers/common_functions');

const userModel = require('../models/userModel');


let Commonhandler = {
    async check_if_stripe_customer(req, next) {

        let constant_values = await userModel.get_config_values([
            'stripe_test_secret_key',
            'stripe_live_secret_key',
            'stripe_mode']);
        constant_values = userModel.get_formatted_config_values(constant_values);

        if (constant_values.stripe_mode == 'test') {
            stripe = Stripe(constant_values.stripe_test_secret_key);
        } else {
            stripe = Stripe(constant_values.stripe_live_secret_key);
        }

        switch (req.response.from) {
            case 'user': let user_data = await functions.get('users', { user_id: req.decoded.user_id });
                if (!user_data[0].stripe_id || user_data[0].stripe_id == '' || user_data[0].stripe_id == null) {
                    try {
                        const customer = await stripe.customers.create({
                            email: user_data[0].email,
                            name: user_data[0].first_name + ' ' + user_data[0].last_name,
                            description: 'Customer created on ' + moment().format('MMMM Do YYYY, h:mm:ss a'),
                        });
                        await functions.update('users', { stripe_id: customer.id }, { user_id: req.decoded.user_id })
                        next();
                    } catch (error) {
                        console.log(error)
                        next();
                    }
                } else {
                    req.body.stripe_id = user_data[0].stripe_id;
                    console.log(req.body.stripe_id)
                    next();
                }
                break;
            case 'laundromat': await functions.get('laundromat_master', { id: req.decoded.user_id });
                break;
        }

    },
    async create_stripe_customer(req, next) {
        if (req.response.status == false) {
            req.response.stripe_customer_creation = false;
            next();
            return false;
        }
        try {

            let constant_values = await userModel.get_config_values([
                'stripe_test_secret_key',
                'stripe_live_secret_key',
                'stripe_mode']);
            constant_values = userModel.get_formatted_config_values(constant_values);

            if (constant_values.stripe_mode == 'test') {
                stripe = Stripe(constant_values.stripe_test_secret_key);
            } else {
                stripe = Stripe(constant_values.stripe_live_secret_key);
            }

            const customer = await stripe.customers.create({
                email: req.body.email,
                name: req.response.prev_middleware == 'user_registration' ? req.body.first_name + ' ' + req.body.last_name : req.body.business_name,
                description: 'Customer created on ' + moment().format('MMMM Do YYYY, h:mm:ss a'),
            });
            switch (req.response.prev_middleware) {
                case 'user_registration': await functions.update('users', { stripe_id: customer.id }, { email: req.body.email });
                    break;
                case 'laundromat_registration': await functions.update('laundromat_master', { stripe_id: customer.id }, { email: req.body.email });
                    break;
            }
            req.response.stripe_customer_creation = true;
            req.response.stripe_customer_creation_message = 'Customer added to stripe';
            next();
        } catch (error) {
            let error_msg = 'Customer creation failed';
            if (error.message) {
                error_msg = error.message;
            }
            req.response.stripe_customer_creation = false;
            req.response.stripe_customer_creation_message = error_msg;
            next();
        }

    },
    async add_method_to_stripe(req, next) {
        try {
            validationResult(req).throw();

            let constant_values = await userModel.get_config_values([
                'stripe_test_secret_key',
                'stripe_live_secret_key',
                'stripe_mode']);
            constant_values = userModel.get_formatted_config_values(constant_values);

            if (constant_values.stripe_mode == 'test') {
                stripe = Stripe(constant_values.stripe_test_secret_key);
            } else {
                stripe = Stripe(constant_values.stripe_live_secret_key);
            }


            switch (req.response.card_for) {
                case 'laundromat':
                    let laundromat_id = req.decoded.user_id;
                    await functions.get('laundromat_master', { id: laundromat_id }).then(async result => {
                        let laundromat_data = result[0];
                        const card = await stripe.customers.createSource(laundromat_data.stripe_id, { source: req.body.token });
                        req.response.status = true;
                        req.response.message = 'New bank account added';
                        req.response.card_data = card;
                        next();
                    })

                case 'user':
                    await functions.get('users', { user_id: req.decoded.user_id }).then(async result => {
                        let user_data = result[0];
                        const card = await stripe.customers.createSource(user_data.stripe_id, { source: req.body.token });
                        console.log(card)
                        req.response.status = true;
                        req.response.message = 'Card added';
                        req.response.card_data = card;
                        next();
                    })
            }
        } catch (error) {
            let error_msg = 'Payment method addition failed';
            if (error.message) {
                error_msg = error.message;
            }
            if (error.errors) {
                error_msg = error.errors[0].msg;
            }
            req.response.status = false;
            req.response.message = error_msg;
            next();
        }

    },
    async stripe_account_id_fetcher(req, next) {
        try {
            validationResult(req).throw();

            let user_data;
            req.response.account_id = ''; // for the next middleware

            switch (req.response.account_for) {
                case 'user': user_data = await functions.get('users', { user_id: req.decoded.user_id });
                    user_data = user_data[0];
                    user_data.product_description = 'Agent account for WUW';
                    break;

                case 'laundromat': user_data = await functions.get('laundromat_master', { id: req.decoded.user_id });
                    user_data = user_data[0];
                    user_data.product_description = 'Laundromat account for ' + user_data.business_name;
                    break;
            }


            if (user_data.stripe_account_id !== '' && user_data.stripe_account_id !== null) {
                req.response.status = true;
                req.response.account_id = user_data.stripe_account_id;
                next();
                return false;
            } else {
                let account_data = {};

                let token_data = {
                    ...req.body,
                    email: user_data.email
                };


                account_data = {
                    ...user_data
                }

                account_data.account = await stripe_functions.get_account_data(token_data)

                acc_res = await stripe_functions.create_stripe_account_id(account_data);

                if (acc_res.status == false) {
                    req.response.message = 'Account creation failed in stripe,Plese try again';
                    if (acc_res.response.raw.message) {
                        req.response.message = acc_res.response.raw.message;
                    }
                    next();
                    return false;
                }

                if (acc_res.status == true) {
                    switch (req.response.account_for) {
                        case 'user': await functions.update('users',
                            { stripe_account_id: acc_res.response.id },
                            { user_id: req.decoded.user_id });
                            req.response.status = true;
                            req.response.account_id = acc_res.response.id;

                            break;
                        case 'laundromat': await functions.update('laundromat_master',
                            { stripe_account_id: acc_res.response.id },
                            { id: req.decoded.user_id });
                            req.response.status = true;
                            req.response.account_id = acc_res.response.id;

                            break;
                    }
                    next();
                } else {

                    throw {
                        errors: [
                            { msg: "Stripe account creation failed" }
                        ]
                    };
                }
            }

        } catch (error) {
            console.log(error)
            let error_msg = 'Stripe account id fetch failed';
            if (error.errors) {
                error_msg = error.errors[0].msg;
            }
            req.response.status = false;
            req.response.message = error_msg;
            next();
        }
    },
    async add_bank_account(req, next) {

        if (req.response.status == false) {
            next();
            return false;
        }

        if (!req.response.account_id) {
            req.response.message = 'Stripe account ID missing'
            next();
            return false;
        }

        if (req.response.account_id == '') {
            req.response.message = 'Stripe account ID missing'
            next();
            return false;
        }

        let constant_values = await userModel.get_config_values([
            'stripe_test_secret_key',
            'stripe_live_secret_key',
            'stripe_mode']);
        constant_values = userModel.get_formatted_config_values(constant_values);

        if (constant_values.stripe_mode == 'test') {
            stripe = Stripe(constant_values.stripe_test_secret_key);
        } else {
            stripe = Stripe(constant_values.stripe_live_secret_key);
        }

        try {



            switch (req.response.account_for) {
                case 'user': let agent_data = await functions.get('agent_details', { agent_id: req.decoded.user_id });
                    agent_data = agent_data[0];
                    if (agent_data.is_banking_information_complete == 'N') {
                        await functions.update('agent_details',
                            { is_banking_information_complete: 'Y' },
                            { agent_id: req.decoded.user_id });
                    }
                    break;
                case 'laundromat': break;

            }


            req.response.message = "Bank account added successfully";
            if (req.response.replace_status) {
                if (req.response.replace_status == true) {
                    req.response.message = "Bank account replaced successfully"; // adding a secondary message incase this function was called after bank account replacement procedure
                }
            }
            req.response.status = true;
            next();

        } catch (error) {

            let error_msg = 'Stripe account id fetch failed';
            if (error.errors) {
                error_msg = error.errors[0].msg;
            }
            req.response.status = false;
            req.response.message = error_msg;
            next();

        }

    },
    async delete_custom_account(req, next) {
        // let user_data  = await functions.get('users',{ user_id : req.decoded.user_id });
        //     user_data = user_data[0];
        console.log('are we here')
        let constant_values = await userModel.get_config_values([
            'stripe_test_secret_key',
            'stripe_live_secret_key',
            'stripe_mode']);
        constant_values = userModel.get_formatted_config_values(constant_values);

        if (constant_values.stripe_mode == 'test') {
            stripe = Stripe(constant_values.stripe_test_secret_key);
        } else {
            stripe = Stripe(constant_values.stripe_live_secret_key);
        }

        try {
            const deleted = await stripe.accounts.del(
                req.body.stripe_account_id
            );

            // await functions.update('users',{ stripe_account_id : '' },{
            //     user_id : req.decoded.user_id
            // })

            req.response.status = true;
            req.response.is_deleted = deleted;

            next();
        } catch (error) {
            console.log(error)
            req.response.is_deleted = error;
            next();
        }
    },
    async get_added_cards(req, next) {
        try {

            let constant_values = await userModel.get_config_values([
                'stripe_test_secret_key',
                'stripe_live_secret_key',
                'stripe_mode']);
            constant_values = userModel.get_formatted_config_values(constant_values);

            if (constant_values.stripe_mode == 'test') {
                stripe = Stripe(constant_values.stripe_test_secret_key);
            } else {
                stripe = Stripe(constant_values.stripe_live_secret_key);
            }

            let user_data = [];
            switch (req.response.from) {
                case 'laundromat': user_data = await functions.get('laundromat_master', { id: req.decoded.user_id });
                    break;
                case 'user': user_data = await functions.get('users', { user_id: req.decoded.user_id });
                    break;
            }
            if (user_data.length > 0) {
                user_data = user_data[0];
                const cards = await stripe.customers.listSources(
                    user_data.stripe_id,
                    { object: 'card', limit: 100 }
                );

                req.response.status = true;
                req.response.message = 'Cards fetched';
                req.response.cards = cards;
                next();
            } else {
                req.response.status = false;
                req.response.message = 'No user for this information';
                next();
            }
        } catch (error) {
            console.log(error)
            req.response.status = false;
            req.response.message = 'Data fech failed';
            req.response.error = error;
            next();
        }
    },
    async delete_stripe_card(req, next) {
        try {
            validationResult(req).throw();

            switch (req.response.from) {
                case 'user': let user_data = await functions.get('users', { user_id: req.decoded.user_id }, 'stripe_id');
                    if (user_data[0].stripe_id !== '' && user_data[0].stripe_id !== null) {
                        let response = await stripe_functions.delete_stripe_card(user_data[0].stripe_id, req.body.card_id)

                        if (response !== false) {
                            req.response.status = true;
                            req.response.message = 'Card deleted successfully';
                            req.response.stripe_response = response;
                        } else {
                            req.response.message = 'Card delete failed';
                        }
                    } else {
                        throw {
                            errors: [
                                { msg: 'No stripe Id for this user' }
                            ]
                        }
                    }
                    next();
                    break;
                default: next();
            }


        } catch (error) {
            let error_msg = 'Server Error';
            if (error.errors) {
                error_msg = error.errors[0].msg;
            }
            req.response.status = false;
            req.response.message = error_msg;
            next();
        }
    },
    async delete_bank_account(req, next) {


        if (req.response.status == false) {
            next();
        }

        if (!req.response.account_id) {
            req.response.message = 'Stripe account ID missing'
            next();
            return false;
        }

        if (req.response.account_id == '') {
            req.response.message = 'Stripe account ID missing'
            next();
            return false;
        }

        try {
            validationResult(req).throw();

            switch (req.response.account_for) {
                case 'user':
                    let response = await stripe_functions.delete_external_bank_account(req.response.account_id, req.body.bank_account_id);

                    if (response !== false) {
                        req.response.status = true;
                        req.response.message = 'Bank account replaced successfully';
                        req.response.replace_status = true;
                        req.response.stripe_response = response;
                    } else {
                        req.response.status = false;
                        req.response.replace_status = false;
                        req.response.message = 'Bank account replacement failed';
                    }
                    next();
                    break;
                case 'laundromat':
                    let l_response = await stripe_functions.delete_external_bank_account(req.response.account_id, req.body.bank_account_id);

                    if (l_response !== false) {
                        req.response.status = true;
                        req.response.message = 'Bank account replaced successfully';
                        req.response.replace_status = true;
                        req.response.stripe_response = l_response;
                    } else {
                        req.response.status = false;
                        req.response.replace_status = false;
                        req.response.message = 'Bank account replacement failed';
                    }
                    next();
                    break;

                default: next();
            }

        } catch (error) {
            let error_msg = 'Server error';
            if (error.errors) {
                error_msg = error.errors[0].msg;
            }
            req.response.status = false;
            req.response.message = error_msg;
            next();
        }
    },
    async send_push_notification(req, next) { // this was first attempt at sending push notification. this strategy proved good only when sending to one person.

        if (!req.response.status) {
            if (req.response.push_notification_data) {
                // removing unnecessary data from reaching user
                delete req.response.push_notification_data;
            }
            next();
            return false;
        }
        if (!req.response.push_notification_data) {
            next();
            return false;
        }

        try {

            var push_data = req.response.push_notification_data;

            if (push_data.device_token.length > 0) {
                let message = {
                    "registration_ids": push_data.device_token,
                    "notification": {
                        "body": push_data.body.replace(/(\r\n|\n|\r|\t)/gm, "").replace(/\s\s+/g, ' '),
                        "title": push_data.title,
                        "type": "brodcast",
                        "content": ''
                    },
                    "data": {
                        "custom_notification": {
                            "body": push_data.body.replace(/(\r\n|\n|\r|\t)/gm, "").replace(/\s\s+/g, ' '),
                            "title": push_data.title,
                            "type": push_data.custom_data.type ? push_data.custom_data.type : 'default',
                            "content": '',
                            "push_data": push_data.custom_data,
                            "priority": "high",
                            "show_in_foreground": true
                        },
                        channelId: "channel_id"
                    }
                };

                let response = await fcm.send(message);
                console.log('Successful push-----------', response)
                // removing unnecessary data from reaching user
                delete req.response.push_notification_data;
            }
            next();
        } catch (error) {
            console.log('Failed push--------------------', error);
            if (req.response.push_notification_data) { delete req.response.push_notification_data; }
            next();
        }

    },
    async cron_push_notification_handler(req, next) {
        try {

            let limit = 100;
            if (req.body.limit) {
                if (req.body.limit != 0 && req.body.limit != null && req.body.limit != '') {
                    limit = req.body.limit;
                }
            }
            let push_list = await common_functions.get_push_list(limit);
            let now = new Date();
            var successful = [];
            var failed = [];
            for (let key in push_list) {

                let to_user_data = await common_functions.get_user_data_for_push(push_list[key].sent_to, push_list[key].sent_to_user_type);

                var minutes = 0;
                if (push_list[key].preference_duration) {
                    var a = push_list[key].preference_duration.split(':');
                    minutes = (+a[0]) * 60 + (+a[1]);
                }
                var difference = Math.round((new Date(push_list[key].sending_date).getTime() - now.getTime()) / 60000);
                console.log(difference, minutes)
                if (difference <= minutes) {

                    let push_data = JSON.parse(push_list[key].push_data);
                    push_data.device_token = [to_user_data.device_token];

                    let push_response = await common_functions.send_push_notification(push_data);


                    await functions.update('push_notification_master', {
                        push_response: push_response.toString()
                    }, { id: push_list[key].id });
                    if (common_functions.isJson(push_response)) {
                        push_response = JSON.parse(push_response);
                        if (push_response.success) {
                            if (push_response.success == 1) {
                                await functions.update('push_notification_master', {
                                    status: 'success',
                                    send_status: 'Y'
                                }, { id: push_list[key].id });
                                successful.push(push_list[key])
                            } else {
                                await functions.update('push_notification_master', {
                                    status: 'failed',
                                    send_status: 'Y'
                                }, { id: push_list[key].id });
                                failed.push(push_list[key])
                            }
                        } else {
                            await functions.update('push_notification_master', {
                                status: 'failed',
                                send_status: 'Y'
                            }, { id: push_list[key].id });
                            failed.push(push_list[key])
                        }
                    } else {
                        await functions.update('push_notification_master', {
                            status: 'failed',
                            send_status: 'Y'
                        }, { id: push_list[key].id });
                        failed.push(push_list[key])
                    }

                } else {
                    continue;
                }

            } // for loop end

            req.response.failed = failed;
            req.response.successful = successful;
            next();
        } catch (error) {
            console.log(error);
        }
    },
    async rate_agent(req, next) {
        try {

            validationResult(req).throw();
            let request_data;
            let agent_id;
            var insert_data = {};

            if (req.body.request_type == 'money') {
                request_data = await agentModel.get_request_id_from_unique_id(req.body.request_id);
                if (Object.keys(request_data).length == 0) {
                    throw {
                        errors: [
                            { msg: 'No request data found for ' + req.body.request_id }
                        ]
                    }
                }
                agent_id = request_data.accepted_agent_id;
                insert_data.agent_type = 'money';


            } else if (req.body.request_type == 'laundry') {
                request_data = await laundromatModel.get_request_id_from_unique_id(req.body.request_id)
                if (Object.keys(request_data).length == 0) {
                    throw {
                        errors: [
                            { msg: 'No request data found for ' + req.body.request_id }
                        ]
                    }
                }
                if (req.body.agent_type) {
                    if (req.body.agent_type == 'laundry_pickup') {
                        agent_id = request_data.pickup_agent_id;
                        insert_data.agent_type = 'laundry_pickup';
                    } else if (req.body.agent_type == 'laundry_delivery') {
                        agent_id = request_data.drop_agent_id;
                        insert_data.agent_type = 'laundry_delivery';
                    }

                }

            }

            let exist = await common_functions.check_rating_exist(
                request_data.request_id,
                req.decoded.user_id,
                agent_id,
                req.body.request_type,
                insert_data.agent_type
            );


            if (exist.length > 0) {
                let id = exist[0].id;
                await functions.update('agent_rating_master', {
                    rating: req.body.rating,
                }, {
                    id: id
                });

            } else {
                insert_data = {
                    ...insert_data,
                    request_id: request_data.request_id,
                    agent_id: agent_id,
                    request_type: req.body.request_type,
                    rating: req.body.rating,
                    created_datetime: moment().format("YYYY-MM-DD HH:mm:ss"),
                    rated_by: req.decoded.user_id
                };

                await functions.insert(
                    'agent_rating_master',
                    insert_data
                );
            }

            req.response.status = true;
            req.response.message = 'Rating recorded successfully';
            next();

        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            req.response.error = error;
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            next();
        }
    },
    async rate_agent_ride(req, next) {
        try {

            validationResult(req).throw();
            let request_data;
            let agent_id;
            var insert_data = {};

            if (req.body.request_type != 'ride') {
                throw {
                    errors: [
                        { msg: 'Request type should be of type ride!' }
                    ]
                }
            }
            if (req.body.request_id) {
                request_data = await userModel.get_ride_request_data(req.body.request_id)
                console.log(request_data)
                if (request_data == false) {
                    throw {
                        errors: [
                            { msg: 'No request data found for ' + req.body.request_id }
                        ]
                    }
                } else {

                    if (!req.body.is_cancelled) {
                        agent_id = request_data.agent_id;
                        insert_data.agent_type = 'ride';
                        let exist = await common_functions.check_rating_exist(
                            request_data.id,
                            req.decoded.user_id,
                            agent_id,
                            req.body.request_type,
                            insert_data.agent_type
                        );

                        if (exist.length > 0) {
                            let id = exist[0].id;
                            await functions.update('agent_rating_master', {
                                rating: req.body.rating,
                            }, {
                                id: id
                            });

                            await functions.update('ride_requests',
                                { agent_rate_status: 'confirmed' },
                                { id: request_data.id });

                        } else {
                            insert_data = {
                                ...insert_data,
                                request_id: request_data.id,
                                agent_id: agent_id,
                                request_type: req.body.request_type,
                                rating: req.body.rating,
                                created_datetime: moment().format("YYYY-MM-DD HH:mm:ss"),
                                rated_by: req.decoded.user_id
                            };

                            await functions.insert(
                                'agent_rating_master',
                                insert_data
                            );

                            await functions.update('ride_requests',
                                { agent_rate_status: 'confirmed' },
                                { id: request_data.id });
                        }

                    } else {
                        await functions.update('ride_requests',
                            { agent_rate_status: 'confirmed' },
                            { id: request_data.id });

                    }

                }

            }




            req.response.status = true;
            req.response.message = 'Rating recorded successfully';
            next();

        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            req.response.error = error;
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            next();
        }
    },
    async send_otp_mail(req, res, next) {

        try {
            if (req.response && req.response.status == false) {

                return next(); // Return to ensure no further execution
            }
            if (req?.response?.user?.otp) {
                let emails = await common_functions.get_email_templates([
                    "email_verification",
                ]);
                emails = emails[0];

                emails.email_template = emails.content;
                const subject = "Account Verification";
                const otp = req.response.user.otp;

                let user_data = await functions.get("users", {
                    id: req.response.user.user_id,
                });

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
                    req.response.message = req.response.user?.verification_pending ? "Account verification pending, one time passcode sent to your email" : "One time passcode sent to your email";
                    req.response.user_details = req.response.user;
                    next();
                } else {
                    req.response.status = false;
                    req.response.message = "Mail sent failed, please try again.";
                    next();
                }
            } else {
                next()
            }



        } catch (error) {
            console.error('Error in send_otp_mail:', error);
            return next(error);
        }
    },
    async laundromat_final_payout(req, next) {
        try {
            // minor check to avoid payment incase of false status
            if (!req.response.status) {
                delete req.response.request_data;
                next(); return false;
            }
            if (req.response.status == false) {
                delete req.response.request_data;
                next(); return false;
            }

            // payout proceeding only after final delivery
            if (req.body.order_status != 'delivery_agent_delivered') { next(); return false; }

            // let request_data = req.response.request_data;
            let request_data = await laundromatModel.get_request_id_from_unique_id(req.body.unique_laundry_request_id);
            let final_pricing_info = await laundromatModel.get_final_pricing_information(request_data.request_id);
            let account_ids = await laundromatModel.laundry_request_account_ids(
                request_data.pickup_agent_id,
                request_data.drop_agent_id,
                request_data.laundromat_id
            )
            final_pricing_info = final_pricing_info[0];
            account_ids = account_ids[0];

            let pick_transfer; let drop_transfer; let laund_transfer;

            if (account_ids.pickup_agent_account_id) {

                let pi_amount = parseFloat(final_pricing_info.delivery_fee / 2).toFixed(2);
                pick_transfer = await stripe_functions.transfer_money(
                    parseInt(pi_amount * 100),
                    account_ids.pickup_agent_account_id,
                    req.body.unique_laundry_request_id,
                    request_data.payment_transaction_id
                )

                if (pick_transfer.status == true) {
                    req.response.drop_transfer = true;


                    req.response.pickup_agent_transfer_status = true;

                    // payout api
                    // pick_payout = await stripe_functions.pay_out(
                    //     parseInt(pi_amount * 100),
                    //     account_ids.pickup_agent_account_id
                    // );

                    // if(pick_payout.status == true) {
                    //     req.response.pick_pickout = true;

                    //     await functions.update(
                    //         'agent_payments',{
                    //             payout_id : pick_payout.transaction_id,
                    //             estimated_payout_date : moment.unix(pick_payout.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                    //         },{
                    //             id : pi_ins.insertId
                    //         })
                    // } else {
                    //     req.response.pick_pickout = false;

                    // }
                } else {
                    req.response.pick_transfer = false;

                }

            }

            if (account_ids.drop_agent_account_id) {
                let drop_amount = parseFloat(final_pricing_info.delivery_fee / 2).toFixed(2);
                drop_transfer = await stripe_functions.transfer_money(
                    parseInt(drop_amount * 100),
                    account_ids.drop_agent_account_id,
                    req.body.unique_laundry_request_id,
                    request_data.payment_transaction_id
                )

                if (drop_transfer.status == true) {
                    req.response.drop_transfer = true;


                    req.response.drop_agent_transfer_status = true;
                    // payout api
                    // drop_payout = await stripe_functions.pay_out(
                    //     parseInt(drop_amount * 100),
                    //     account_ids.drop_agent_account_id
                    // );

                    // if(drop_payout.status == true) {
                    //      req.response.drop_payout = true;

                    //     await functions.update(
                    //         'agent_payments',{
                    //             payout_id : drop_payout.transaction_id,
                    //             estimated_payout_date : moment.unix(drop_payout.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                    //         },{
                    //             id : drop_ins.insertId
                    //         })
                    // } else {
                    //     req.response.drop_payout = false;

                    // }
                } else {
                    req.response.drop_transfer = false;

                }
            }

            if (account_ids.laundromat_account_id) {
                let laun_amount = Number(
                    parseFloat(
                        (parseFloat(final_pricing_info.finalised_total_amount) + parseFloat(final_pricing_info.additional_cost)) -
                        (
                            parseFloat(final_pricing_info.service_charge) +
                            parseFloat(final_pricing_info.delivery_fee) +
                            parseFloat(final_pricing_info.stripe_transaction_fee)
                        )
                    ).toFixed(2)
                );

                laund_transfer = await stripe_functions.transfer_money(
                    parseInt(laun_amount * 100),
                    account_ids.laundromat_account_id,
                    req.body.unique_laundry_request_id,
                    request_data.payment_transaction_id
                );

                if (laund_transfer.status == true) {
                    req.response.laundry_transfer = true;

                    // laund_payout = await stripe_functions.pay_out(
                    //     parseInt(laun_amount * 100),
                    //     account_ids.laundromat_account_id );
                    // if(laund_payout.status == true) {
                    //     await functions.update(
                    //         'laundromat_payments',{
                    //             payout_id : laund_payout.transaction_id,
                    //             estimated_payout_date : moment.unix(laund_payout.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                    //         },{
                    //             id : laun_ins.insertId
                    //     })

                    //     req.response.laundry_payout = true;
                    // } else {
                    //     req.response.laundry_payout = false;

                    // }

                } else {
                    req.response.laundry_transfer = false;

                }


            }

            // console.log(account_ids,final_pricing_info);
            if (req.response.request_data) {
                delete req.response.request_data;;
            }
            next();
        } catch (error) {
            console.log(error);
            next();
        }
    },
    async send_signup_emails(req, next) {
        try {

            if (req.response.status == false) {
                next();
                return false;
            }

            let emails = await common_functions.get_email_templates(['admin_welcome_email', 'user_welcome_email']);
            let constant_values = await userModel.get_config_values(['admin_email']);
            constant_values = userModel.get_formatted_config_values(constant_values);


            let admin_email = emails.filter(item => item.email_key == 'admin_welcome_email')[0];
            admin_email.email_template = admin_email.template
                .replace(/##NAME##/g, req.body.first_name + ' ' + req.body.last_name)
                .replace(/##EMAIL##/g, req.body.email);
            admin_email.subject = admin_email.subject.replace(/##NAME##/g, req.body.first_name + ' ' + req.body.last_name);

            let user_email = emails.filter(item => item.email_key == 'user_welcome_email')[0];

            user_email.email_template = user_email.template
                .replace(/##NAME##/g, req.body.first_name + ' ' + req.body.last_name)
                .replace(/##EMAIL##/g, req.body.email);


            functions.sendMail(constant_values.admin_email, admin_email.subject, admin_email, true);
            functions.sendMail(req.body.email, user_email.subject, user_email, true);

            next();
        } catch (error) {
            console.log(error);
            next();
        }
    },
    async send_laundromat_signup_emails(req, next) {
        try {

            if (req.response.status == false) {
                next();
                return false;
            }

            let emails = await common_functions.get_email_templates(['laundromat_welcome_email', 'laundromat_admin_welcome_email']);
            let constant_values = await userModel.get_config_values(['admin_email']);
            constant_values = userModel.get_formatted_config_values(constant_values);


            let admin_email = emails.filter(item => item.email_key == 'laundromat_admin_welcome_email')[0];
            admin_email.email_template = admin_email.template
                .replace(/##NAME##/g, req.body.business_name)
                .replace(/##EMAIL##/g, req.body.email);
            admin_email.subject = admin_email.subject.replace(/##NAME##/g, req.body.business_name);

            let user_email = emails.filter(item => item.email_key == 'laundromat_welcome_email')[0];

            user_email.email_template = user_email.template
                .replace(/##NAME##/g, req.body.business_name)
                .replace(/##EMAIL##/g, req.body.email);


            functions.sendMail(constant_values.admin_email, admin_email.subject, admin_email, true);
            functions.sendMail(req.body.email, user_email.subject, user_email, true);

            next();
        } catch (error) {
            console.log(error);
            next();
        }
    },
    async weekly_payout_handler(req, next) {
        try {

            let agent_payout_list = await agentModel.get_weekly_payout_list();

            let emails = await common_functions.get_email_templates(['weekly_payout_email']);
            emails = emails[0];
            emails.email_template = emails.template;



            let transfer_response;
            let payout_response;
            let mail_res = false;
            let temp2;
            let successful = [];
            let failed = [];

            for (let i = 0; i < agent_payout_list.length; i++) {

                transfer_response = await stripe_functions.transfer_money(
                    parseInt(agent_payout_list[i].final_amount * 100),
                    agent_payout_list[i].stripe_account_id,
                    'agent_weekly_payout'
                );

                if (transfer_response.status == true) {

                    // temp = await functions.insert('agent_payout_master',{
                    //     agent_id : agent_payout_list[i].agent_id,
                    //     request_type : 'money',
                    //     amount : agent_payout_list[i].final_amount,
                    //     created_date : moment().format("YYYY-MM-DD HH:mm:ss"),
                    //     transfer_id : transfer_response.transaction_id
                    // });
                    temp2 = await functions.insert('agent_payments', {
                        agent_id: agent_payout_list[i].agent_id,
                        service_type: 'money',
                        total_amount: agent_payout_list[i].final_amount,
                        created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
                        transfer_id: transfer_response.transaction_id
                    });

                    payout_response = await stripe_functions.pay_out(
                        parseInt(agent_payout_list[i].final_amount * 100),
                        agent_payout_list[i].stripe_account_id
                    );

                    if (payout_response.status == true) {

                        // await functions.update('agent_payout_master' , {
                        //     payout_id : payout_response.transaction_id,
                        //     estimated_payout_date : moment.unix(payout_response.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                        // },{
                        //     log_id : temp.insertId
                        // });
                        await functions.update('agent_payments', {
                            payout_id: payout_response.transaction_id,
                            estimated_payout_date: moment.unix(payout_response.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                        }, {
                            id: temp2.insertId
                        });

                        successful.push(agent_payout_list[i]);

                        emails.email_template = emails.email_template.replace(/##NAME##/, agent_payout_list[i].agent_name);
                        emails.email_template = emails.email_template.replace(/##AMOUNT##/, agent_payout_list[i].final_amount);
                        emails.email_template = emails.email_template.replace(/##DATE##/, moment.unix(payout_response.arrival_date).format("MMMM Do YYYY, h:mm:ss a"));

                        await common_functions.send_email(agent_payout_list[i].agent_email, emails.subject, emails, true);
                        if (mail_res == true) {
                            // await functions.update('agent_payout_master' , {
                            //     email_status : 'Y'
                            // },{
                            //     log_id : temp.insertId
                            // });

                        } else {
                            // await functions.update('agent_payout_master' , {
                            //     email_status : 'N'
                            // },{
                            //     log_id : temp.insertId
                            // });
                        }

                    }

                } else {
                    failed.push(agent_payout_list[i]);
                }

            }

            req.response.status = true;
            req.response.successful_payouts = successful;
            req.response.failed_payouts = failed;
            req.response.message = 'Cron ran successfully';
            next();
        } catch (error) {

            req.response.error = error;
            req.response.message = 'Cron run failed';
            next();
        }
    },
    async cms_fetcher(req, next) {

        try {
            if (!req.body.keys) {
                throw {
                    errors: [
                        { msg: 'Please provide keys for the contents' }
                    ]
                }
            }
            if (req.body.keys.length == 0) {
                throw {
                    errors: [
                        { msg: 'Please provide keys for the contents' }
                    ]
                }
            }

            let cms_data = await common_functions.get_cms(req.body.keys);
            req.response.data = cms_data;
            req.response.status = true;
            next();

        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            req.response.error = error;
            next();

        }

    },
    async weekly_agent_money_req_payout_handler(req, next) {
        try {

            let money_request_list = await agentModel.get_weekly_agent_money_out();


            let constant_values = await userModel.get_config_values(['agent_additional_deduction',]);
            constant_values = userModel.get_formatted_config_values(constant_values);

            let emails = await common_functions.get_email_templates(['weekly_money_req_agent_email']);
            emails = emails[0];
            let mail_temp = emails.template;
            emails.email_template = emails.template;


            var temp;
            var temp2;

            var total_amount;

            let transfer_response;
            let payout_response;

            let succ = [];
            let fail = [];

            for (let i = 0; i < money_request_list.length; i++) {

                emails.email_template = mail_temp;

                var list = money_request_list[i].money_request_id_list.split(',');


                total_amount = parseFloat(
                    parseFloat(money_request_list[i].delivery_fee) -
                    parseFloat(constant_values.agent_additional_deduction * money_request_list[i].order_count)
                ).toFixed(2);



                emails.email_template = emails.email_template.replace(/##NAME##/g, money_request_list[i].agent_name);
                emails.email_template = emails.email_template.replace(/##AMOUNT##/g, total_amount);
                emails.email_template = emails.email_template.replace(/##ORDERS##/g, money_request_list[i].unique_id_list);


                transfer_response = await stripe_functions.transfer_money(
                    parseInt(total_amount * 100),
                    money_request_list[i].stripe_account_id,
                    'agent_weekly_money_request_payout'
                );


                if (transfer_response.status == true) {


                    let insert_id = []
                    for (j = 0; j < list.length; j++) {
                        var temp_data = await functions.get('money_request', { id: list[j] });
                        let amount = parseFloat(
                            parseFloat(temp_data[0].delivery_charge) -
                            parseFloat(constant_values.agent_additional_deduction)
                        ).toFixed(2);

                        await functions.update('money_request_status', { agent_cron_processed: 'Y' }, { money_request_id: list[j] })

                        temp2 = await functions.insert('agent_payments', {
                            agent_id: money_request_list[i].agent_id,
                            request_id: list[j],
                            service_type: 'money',
                            amount: amount,
                            total_amount: amount,
                            created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
                            transfer_id: transfer_response.transaction_id
                        });
                        insert_id.push(temp2.insertId);
                    }

                    payout_response = await stripe_functions.pay_out(
                        parseInt(total_amount * 100),
                        money_request_list[i].stripe_account_id
                    );

                    if (payout_response.status == true) {



                        for (j = 0; j < insert_id.length; j++) {
                            await functions.update('agent_payments', {
                                payout_id: payout_response.transaction_id,
                                estimated_payout_date: moment.unix(payout_response.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                            }, {
                                id: insert_id[j]
                            });
                        }

                        succ.push(money_request_list[i].agent_email);
                        common_functions.send_email(money_request_list[i].agent_email, emails.subject, {
                            ...emails,
                            email_template: emails.email_template.replace(/##DATE##/g,
                                moment.unix(payout_response.arrival_date).format("MMMM Do YYYY, h:mm:ss a"))
                        }, true);


                    } else {
                        fail.push(money_request_list[i].agent_email);

                        await functions.insert(
                            'agent_payment_failure',
                            {
                                total_amount: total_amount,
                                service_type: 'money',
                                payment_id: temp.insertId,
                                order_list: money_request_list[i].unique_id_list,
                                agent_id: money_request_list[i].agent_id,
                                agent_email: money_request_list[i].agent_email,
                                agent_name: money_request_list[i].agent_name,
                                transfer_status: 'Y',
                                payout_status: 'N',
                                error_code: payout_response.error_code
                            }
                        );
                    }

                } else {
                    fail.push(money_request_list[i].agent_email);
                    await functions.insert(
                        'agent_payment_failure',
                        {
                            total_amount: total_amount,
                            service_type: 'money',
                            order_list: money_request_list[i].unique_id_list,
                            agent_id: money_request_list[i].agent_id,
                            agent_email: money_request_list[i].agent_email,
                            agent_name: money_request_list[i].agent_name,
                            transfer_status: 'N',
                            payout_status: 'N',
                            error_code: transfer_response.error_code
                        }
                    );
                }

            }

            req.response.status = true;
            req.response.message = 'Cron processed';
            req.response.data = {
                failed: fail,
                successful: succ
            }
            next();

        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            req.response.error = error;
            next();

        }
    }, async weekly_agent_ride_req_payout_handler(req, next) {
        try {

            let ride_request_list = await agentModel.get_weekly_agent_ride_money_out();
            console.log(ride_request_list)
            let emails = await common_functions.get_email_templates(['weekly_ride_req_agent_email']);
            emails = emails[0];
            let mail_temp = emails.template;
            emails.email_template = emails.template;

            var temp;
            var total_amount;
            let transfer_response;
            let payout_response;

            let succ = [];
            let fail = [];


            for (let i = 0; i < ride_request_list.length; i++) {

                emails.email_template = mail_temp;

                var list = ride_request_list[i].ride_request_id_list.split(',');


                total_amount = Number(parseFloat(ride_request_list[i].agent_fee).toFixed(2))



                emails.email_template = emails.email_template.replace(/##NAME##/g, ride_request_list[i].agent_name);
                emails.email_template = emails.email_template.replace(/##AMOUNT##/g, total_amount);
                emails.email_template = emails.email_template.replace(/##ORDERS##/g, ride_request_list[i].unique_id_list);


                transfer_response = await stripe_functions.transfer_money(
                    parseInt(total_amount * 100),
                    ride_request_list[i].stripe_account_id,
                    'agent_weekly_ride_request_payout'
                );


                if (transfer_response.status == true) {


                    let insert_id = []
                    for (j = 0; j < list.length; j++) {
                        var temp_data = await functions.get('ride_requests', { id: list[j] });
                        let amount = Number(parseFloat(temp_data[0].agent_fee).toFixed(2))

                        await functions.update('ride_requests', { agent_cron_processed: 'Y' }, { id: list[j] })

                        temp = await functions.insert('agent_payments', {
                            agent_id: ride_request_list[i].agent_id,
                            request_id: list[j],
                            service_type: 'ride',
                            amount: amount,
                            total_amount: amount,
                            created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
                            transfer_id: transfer_response.transaction_id
                        });
                        insert_id.push(temp.insertId);
                    }

                    payout_response = await stripe_functions.pay_out(
                        parseInt(total_amount * 100),
                        ride_request_list[i].stripe_account_id
                    );

                    if (payout_response.status == true) {



                        for (j = 0; j < insert_id.length; j++) {
                            await functions.update('agent_payments', {
                                payout_id: payout_response.transaction_id,
                                estimated_payout_date: moment.unix(payout_response.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                            }, {
                                id: insert_id[j]
                            });
                        }

                        succ.push(ride_request_list[i].agent_email);
                        common_functions.send_email(ride_request_list[i].agent_email, emails.subject, {
                            ...emails,
                            email_template: emails.email_template.replace(/##DATE##/g,
                                moment.unix(payout_response.arrival_date).format("MMMM Do YYYY, h:mm:ss a"))
                        }, true);


                    } else {
                        fail.push(ride_request_list[i].agent_email);

                        await functions.insert(
                            'agent_payment_failure',
                            {
                                total_amount: total_amount,
                                service_type: 'ride',
                                payment_id: payout_response.transaction_id,
                                order_list: ride_request_list[i].unique_id_list,
                                agent_id: ride_request_list[i].agent_id,
                                agent_email: ride_request_list[i].agent_email,
                                agent_name: ride_request_list[i].agent_name,
                                transfer_status: 'Y',
                                payout_status: 'N',
                                error_code: payout_response.error_code
                            }
                        );
                    }

                } else {
                    fail.push(ride_request_list[i].agent_email);
                    await functions.insert(
                        'agent_payment_failure',
                        {
                            total_amount: total_amount,
                            service_type: 'ride',
                            payment_id: transfer_response.transaction_id,
                            order_list: ride_request_list[i].unique_id_list,
                            agent_id: ride_request_list[i].agent_id,
                            agent_email: ride_request_list[i].agent_email,
                            agent_name: ride_request_list[i].agent_name,
                            transfer_status: 'N',
                            payout_status: 'N',
                            error_code: transfer_response.error_code
                        }
                    );
                }

            }

            req.response.status = true;
            req.response.message = 'Cron processed';
            req.response.data = {
                failed: fail,
                successful: succ
            }
            next();

        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            req.response.error = error;
            next();

        }
    },
    async weekly_agent_laundry_req_payout_handler(req, next) {
        try {

            let agent_list = await agentModel.get_weekly_laundry_agent_money_out();


            let constant_values = await userModel.get_config_values(['agent_additional_deduction',]);
            constant_values = userModel.get_formatted_config_values(constant_values);


            let emails = await common_functions.get_email_templates(['weekly_laundry_req_agent_email']);
            emails = emails[0];
            let mail_temp = emails.template;
            emails.email_template = emails.template;

            let succ = [];
            let fail = [];



            var total_amount;

            let transfer_response;
            let payout_response;


            for (let i = 0; i < agent_list.length; i++) {

                emails.email_template = mail_temp;

                total_amount = parseFloat(agent_list[i].delivery_fee);

                var id_list = agent_list[i].laundry_request_id.split(',');

                // id_list.length here is to take the number of ordres. 
                total_amount = parseFloat(total_amount - parseFloat(id_list.length * constant_values.agent_additional_deduction))
                if (total_amount < 1) { total_amount = 1; }
                total_amount = total_amount.toFixed(2);

                emails.email_template = emails.email_template.replace(/##NAME##/g, agent_list[i].agent_name);
                emails.email_template = emails.email_template.replace(/##AMOUNT##/g, total_amount);
                emails.email_template = emails.email_template.replace(/##ORDERS##/g, agent_list[i].unique_id_list);

                transfer_response = await stripe_functions.transfer_money(
                    parseInt(total_amount * 100),
                    agent_list[i].stripe_account_id,
                    'agent_weekly_laundry_request_payout'
                );

                if (transfer_response.status == true) {


                    let insert_id = [];
                    for (let j = 0; j < id_list.length; j++) {

                        let temp_data = await functions.get('laundry_request', { id: id_list[j] });
                        let amount = parseFloat(
                            parseFloat(temp_data[0].delivery_fee / 2) - parseFloat(constant_values.agent_additional_deduction))
                        if (amount < 0) {
                            amount = 0;
                        }

                        let temp2 = await functions.insert('agent_payments', {
                            agent_id: agent_list[i].agent_id,
                            request_id: id_list[j],
                            service_type: 'laundry',
                            amount: amount.toFixed(2),
                            total_amount: amount.toFixed(2),
                            created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
                            transfer_id: transfer_response.transaction_id
                        });

                        await functions.update('laundry_request_status', { agent_cron_processed: 'Y' },
                            { laundry_request_id: id_list[j] })

                        insert_id.push(temp2.insertId);
                    }


                    payout_response = await stripe_functions.pay_out(
                        parseInt(total_amount * 100),
                        agent_list[i].stripe_account_id
                    );

                    if (payout_response.status == true) {


                        for (let j = 0; j < insert_id.length; j++) {
                            await functions.update('agent_payments', {
                                payout_id: payout_response.transaction_id,
                                estimated_payout_date: moment.unix(payout_response.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                            }, {
                                id: insert_id[j]
                            });
                        }

                        succ.push(agent_list[i].agent_email)
                        common_functions.send_email(agent_list[i].agent_email, emails.subject, {
                            ...emails,
                            email_template: emails.email_template.replace(/##DATE##/g, moment.unix(payout_response.arrival_date).format("MMMM Do YYYY, h:mm:ss a"))
                        }, true);

                    } else {
                        fail.push(agent_list[i].agent_email)
                        await functions.insert(
                            'agent_payment_failure',
                            {
                                total_amount: total_amount,
                                service_type: 'laundry',
                                payment_id: payout_response.id,
                                order_list: agent_list[i].unique_id_list,
                                agent_id: agent_list[i].agent_id,
                                agent_email: agent_list[i].agent_email,
                                agent_name: agent_list[i].agent_name,
                                transfer_status: 'Y',
                                payout_status: 'N',
                                error_code: payout_response.error_code
                            }
                        );
                    }

                } else {
                    fail.push(agent_list[i].agent_email)
                    await functions.insert(
                        'agent_payment_failure',
                        {
                            total_amount: total_amount,
                            service_type: 'laundry',
                            payment_id: transfer_response.id,
                            order_list: agent_list[i].unique_id_list,
                            agent_id: agent_list[i].agent_id,
                            agent_email: agent_list[i].agent_email,
                            agent_name: agent_list[i].agent_name,
                            transfer_status: 'N',
                            payout_status: 'N',
                            error_code: transfer_response.error_code
                        }
                    );
                }

            }

            req.response.status = true;
            req.response.message = 'Cron processed';
            req.response.data = {
                successful: succ,
                failed: fail
            }
            next();

        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            req.response.error = error;
            next();
        }
    },
    async weekly_laundromat_payout_handler(req, next) {
        try {



            let constant_values = await userModel.get_config_values(['laundromat_service_charge',]);
            constant_values = userModel.get_formatted_config_values(constant_values);

            let laundry_list = await laundromatModel.get_weekly_laundry_payout_list(parseFloat(constant_values.laundromat_service_charge / 100));



            let emails = await common_functions.get_email_templates(['weekly_laundromat_payout_email']);
            emails = emails[0];
            let mail_temp = emails.template;
            emails.email_template = emails.template;

            var laun_amount;

            let laund_transfer;
            let laun_ins;
            let laund_payout;
            let succ = [];
            let fail = [];



            for (let i = 0; i < laundry_list.length; i++) {
                emails.email_template = mail_temp;
                let laundromat_service_charge = 0;


                if (parseInt(laundry_list[i].order_count) > 0) {
                    laundromat_service_charge = parseFloat(
                        laundry_list[i].order_count * (constant_values.laundromat_service_charge / 100)
                    ).toFixed(2)
                }


                // tthe laundromat final amount calculation. note that additional service charge has been deducted from laundromat
                laun_amount = Number(
                    parseFloat(
                        parseFloat(
                            laundry_list[i].actual_total_service_charge +
                            laundry_list[i].additional_cost
                        ) - parseFloat(laundromat_service_charge)
                    )
                ).toFixed(2);

                console.log(parseFloat(
                    laundry_list[i].actual_total_service_charge +
                    laundry_list[i].additional_cost
                ), laundromat_service_charge, laun_amount);


                var id_list = laundry_list[i].id_list.split(',')

                emails.email_template = emails.email_template.replace(/##NAME##/g, laundry_list[i].business_name);
                emails.email_template = emails.email_template.replace(/##AMOUNT##/g, laun_amount);
                emails.email_template = emails.email_template.replace(/##ORDERS##/g, laundry_list[i].unique_id_list);

                laund_transfer = await stripe_functions.transfer_money(
                    parseInt(laun_amount * 100),
                    laundry_list[i].stripe_account_id,
                    'weekly_laundromat_payout'
                );

                if (laund_transfer.status == true) {

                    let insert_id = [];

                    for (let j = 0; j < id_list.length; j++) {
                        let temp_data = await functions.get('laundry_request', { id: id_list[j] });
                        let amount = parseFloat(
                            parseFloat(
                                (temp_data[0].actual_total_service_charge ? temp_data[0].actual_total_service_charge : 0) +
                                (temp_data[0].additional_cost ? temp_data[0].additional_cost : 0)
                            ) -
                            parseFloat(constant_values.laundromat_service_charge / 100)
                        )
                        if (parseFloat(amount) <= 0) {
                            amount = parseFloat(
                                (temp_data[0].actual_total_service_charge ? temp_data[0].actual_total_service_charge : 0) +
                                (temp_data[0].additional_cost ? temp_data[0].additional_cost : 0)
                            );
                        }
                        laun_ins = await functions.insert(
                            'laundromat_payout_master', {
                            laundromat_id: laundry_list[i].laundromat_id,
                            request_id: id_list[j],
                            amount: amount,
                            total_amount: amount,
                            created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
                            transfer_id: laund_transfer.transaction_id
                        });
                        insert_id.push(laun_ins.insertId)

                        await functions.update('laundry_request_status', {
                            laundromat_cron_processed: 'Y'
                        }, { laundry_request_id: id_list[j] })

                    }


                    laund_payout = await stripe_functions.pay_out(
                        parseInt(laun_amount * 100),
                        laundry_list[i].stripe_account_id);

                    if (laund_payout.status == true) {

                        for (let j = 0; j < insert_id.length; j++) {
                            await functions.update(
                                'laundromat_payout_master', {
                                payout_id: laund_payout.transaction_id,
                                estimated_payout_date: moment.unix(laund_payout.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                            }, {
                                id: insert_id[j]
                            })
                        }




                        succ.push(laundry_list[i].email)
                        await common_functions.send_email(laundry_list[i].email, emails.subject, {
                            ...emails,
                            email_template: emails.email_template.replace('##DATE##',
                                moment.unix(laund_payout.arrival_date).format("MMMM Do YYYY, h:mm:ss a"))
                        }, true);

                    } else {

                        // failed payout
                        fail.push(laundry_list[i].email)
                        await functions.insert(
                            'laundromat_payout_failure',
                            {
                                total_amount: laun_amount,
                                order_list: laundry_list[i].unique_id_list,
                                laundromat_id: laundry_list[i].laundromat_id,
                                email: laundry_list[i].email,
                                business_name: laundry_list[i].business_name,
                                transfer_status: 'N',
                                payout_status: 'N',
                                error_code: laund_payout.error_code
                            }
                        );

                    }

                } else {
                    fail.push(laundry_list[i].email)
                    // failed transfer
                    await functions.insert(
                        'laundromat_payout_failure',
                        {
                            total_amount: laun_amount,
                            order_list: laundry_list[i].unique_id_list,
                            laundromat_id: laundry_list[i].laundromat_id,
                            email: laundry_list[i].email,
                            business_name: laundry_list[i].business_name,
                            transfer_status: 'N',
                            payout_status: 'N',
                            error_code: laund_transfer.error_code
                        }
                    );

                }

            }
            req.response.status = true;
            req.response.message = 'Cron processed';
            req.response.data = {
                successful: succ,
                failed: fail
            }
            next();

        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            req.response.error = error;
            next();
        }
    },
    async weekly_admin_payment_handler(req, next) {
        try {

            let laundry_payout_data = await adminModel.get_weekly_admin_laundry_req_payout_amount();
            let money_payout_data = await adminModel.get_weekly_money_req_admin_payout();

            let total_service_charge = 0;
            let admin_payout;


            let total_money_service_charge = 0;
            let total_laundry_service_charge = 0;

            let constant_values = await userModel.get_config_values([
                'admin_email',
                'laundromat_service_charge',
                'agent_additional_deduction']);
            constant_values = userModel.get_formatted_config_values(constant_values);


            let sub_order_count = await adminModel.get_reduced_laundromat_order_count_weekly(parseFloat(constant_values.laundromat_service_charge / 100));
            let sub_count = sub_order_count[0].order_count;


            let emails = await common_functions.get_email_templates(['weekly_admin_payout_email']);
            emails = emails[0];
            emails.email_template = emails.template;

            if (laundry_payout_data.length > 0 && money_payout_data.length == 0) {
                console.log('are we here')
                total_service_charge = parseFloat(laundry_payout_data[0].service_charge);
                if (parseInt(laundry_payout_data[0].order_count) > 0) {
                    total_service_charge = parseFloat(
                        parseFloat(total_service_charge) +
                        parseFloat((laundry_payout_data[0].order_count - sub_count) * (constant_values.laundromat_service_charge / 100)) +
                        parseFloat((laundry_payout_data[0].order_count * 2) * (constant_values.agent_additional_deduction))
                    )
                    total_laundry_service_charge = total_service_charge;
                    console.log('extra fund taken from laundromat',
                        parseFloat((laundry_payout_data[0].order_count - sub_count) * (constant_values.laundromat_service_charge / 100)).toFixed(2)),
                        parseFloat((laundry_payout_data[0].order_count * 2) * (constant_values.agent_additional_deduction))
                }
            } else if (laundry_payout_data.length == 0 && money_payout_data.length > 0) {

                total_service_charge = parseFloat(
                    parseFloat(money_payout_data[0].service_charge + money_payout_data[0].original_amount) +
                    parseFloat(money_payout_data[0].order_count * (constant_values.agent_additional_deduction))
                );

                total_money_service_charge = total_service_charge;

            } else if (laundry_payout_data.length > 0 && money_payout_data.length > 0) {

                console.log('are we here', laundry_payout_data, money_payout_data)
                total_service_charge = parseFloat(laundry_payout_data[0].service_charge +
                    parseFloat(money_payout_data[0].service_charge + money_payout_data[0].original_amount));


                console.log('service charges', laundry_payout_data[0].service_charge, money_payout_data[0].service_charge)
                total_money_service_charge = parseFloat(money_payout_data[0].service_charge + money_payout_data[0].original_amount);
                total_laundry_service_charge = parseFloat(laundry_payout_data[0].service_charge);

                if (parseInt(laundry_payout_data[0].order_count) > 0) {

                    total_service_charge = parseFloat(
                        parseFloat(total_service_charge) +
                        parseFloat((laundry_payout_data[0].order_count - sub_count) * (constant_values.laundromat_service_charge / 100)) +
                        parseFloat((laundry_payout_data[0].order_count * 2) * (constant_values.agent_additional_deduction))
                    )

                    total_laundry_service_charge = parseFloat(
                        parseFloat(total_laundry_service_charge) +
                        parseFloat((laundry_payout_data[0].order_count - sub_count) * (constant_values.laundromat_service_charge / 100)) +
                        parseFloat((laundry_payout_data[0].order_count * 2) * (constant_values.agent_additional_deduction))
                    )

                    // consoling...
                    console.log('extra fund taken from laundromat',
                        parseFloat((laundry_payout_data[0].order_count - sub_count) * (constant_values.laundromat_service_charge / 100)).toFixed(2))
                    console.log('extra fund from laundry agents',
                        parseFloat((laundry_payout_data[0].order_count * 2) * (constant_values.agent_additional_deduction)))
                    //consoling end

                }

                if (parseInt(money_payout_data[0].order_count) > 0) {

                    total_service_charge = parseFloat(
                        parseFloat(total_service_charge) +
                        parseFloat(money_payout_data[0].order_count * (constant_values.agent_additional_deduction))
                    )

                    total_money_service_charge = parseFloat(
                        total_money_service_charge +
                        parseFloat(money_payout_data[0].order_count * (constant_values.agent_additional_deduction))
                    )

                    //consolling
                    console.log('extra from money agents',
                        parseFloat(money_payout_data[0].order_count * (constant_values.agent_additional_deduction)))
                    //consoling end
                }
            }

            total_service_charge = parseFloat(total_service_charge).toFixed(2);


            if (parseFloat(total_service_charge) == 0) {
                throw {
                    errors: [
                        { msg: 'Total service charge is zero' }
                    ]
                };
            }


            console.log(total_service_charge)
            console.log(total_laundry_service_charge)
            console.log(total_money_service_charge)
            console.log(laundry_payout_data[0].order_count - sub_count)

            admin_payout = await stripe_functions.pay_out(parseInt(total_service_charge * 100), '');

            if (admin_payout.status == true) {

                if (money_payout_data[0].id_list) {
                    let money_id_list = money_payout_data[0].id_list.split(',');
                    for (i = 0; i < money_id_list.length; i++) {

                        await functions.update('money_request_status', {
                            admin_cron_processed: 'Y'
                        }, { money_request_id: money_id_list[i] })

                    }
                }

                if (laundry_payout_data[0].id_list) {
                    let laundry_id_list = laundry_payout_data[0].id_list.split(',');
                    for (i = 0; i < laundry_id_list.length; i++) {

                        await functions.update('laundry_request_status', {
                            admin_cron_processed: 'Y'
                        }, { laundry_request_id: laundry_id_list[i] })

                    }
                }


                await functions.insert(
                    'admin_payout_master', {
                    total_amount: total_service_charge,
                    payout_id: admin_payout.transaction_id,
                    money_req_total: money_payout_data[0].service_charge,
                    laundry_req_total: laundry_payout_data[0].service_charge,
                    payout_status: 'success',
                    estimated_payout_date: moment.unix(admin_payout.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                })


                emails.email_template = emails.email_template.replace(/##AMOUNT##/g, total_service_charge);
                emails.email_template = emails.email_template.replace(/##DATE##/g, moment.unix(admin_payout.arrival_date).format("MMMM Do YYYY, h:mm:ss a"));
                emails.email_template = emails.email_template.replace(/##MONEY_ORDERS##/g, money_payout_data[0].unique_id_list ? money_payout_data[0].unique_id_list : '');
                emails.email_template = emails.email_template.replace(/##LAUNDRY_ORDERS##/g, laundry_payout_data[0].unique_id_list ? laundry_payout_data[0].unique_id_list : '');

                emails.email_template = emails.email_template.replace(/##MONEY_CHARGE##/g, total_money_service_charge);
                emails.email_template = emails.email_template.replace(/##LAUNDRY_CHARGE##/g, total_laundry_service_charge);

                mail_res = await common_functions.send_email(constant_values.admin_email, emails.subject, emails, true);
                consol.log('mailres', mail_res)
                req.response.status = true;
                req.response.message = 'Admin payout cron successfull';

            } else {

                await functions.insert(
                    'admin_payout_master', {
                    total_amount: total_service_charge,
                    payout_id: admin_payout.transaction_id,
                    money_req_total: money_payout_data[0].service_charge,
                    laundry_req_total: laundry_payout_data[0].service_charge,
                    payout_status: 'failed',
                    estimated_payout_date: moment.unix(admin_payout.arrival_date).format("YYYY-MM-DD HH:mm:ss"),
                    error_code: admin_payout.error_code
                })
                req.response.message = 'Admin payout cron failed';
            }

            next();
        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            req.response.error = error;
            next();
        }
    }, async weekly_admin_ride_payout_handler(req, next) {
        try {
            let ride_payout_data = await adminModel.get_weekly_admin_ride_req_payout_amount()

            let total_admin_charge = 0;

            let constant_values = await userModel.get_config_values([
                'admin_email']);
            constant_values = userModel.get_formatted_config_values(constant_values);

            let emails = await common_functions.get_email_templates(['weekly_admin_ride_payout_email']);
            emails = emails[0];
            emails.email_template = emails.template;
            if (ride_payout_data.length > 0 && ride_payout_data[0].admin_fee > 0) {

                total_admin_charge = ride_payout_data[0].admin_fee

                admin_payout = await stripe_functions.pay_out(parseInt(total_admin_charge * 100), '');

                if (admin_payout.status == true) {

                    if (ride_payout_data[0].id_list) {
                        let ride_id_list = ride_payout_data[0].id_list.split(',');
                        for (i = 0; i < ride_id_list.length; i++) {

                            await functions.update('ride_requests', {
                                admin_cron_processed: 'Y'
                            }, { id: ride_id_list[i] })

                        }
                    }


                    await functions.insert(
                        'admin_payout_master', {
                        total_amount: total_admin_charge,
                        payout_id: admin_payout.transaction_id,
                        ride_req_total: ride_payout_data[0].admin_fee,
                        payout_status: 'success',
                        estimated_payout_date: moment.unix(admin_payout.arrival_date).format("YYYY-MM-DD HH:mm:ss")
                    })


                    emails.email_template = emails.email_template.replace(/##AMOUNT##/g, total_admin_charge);
                    emails.email_template = emails.email_template.replace(/##DATE##/g, moment.unix(admin_payout.arrival_date).format("MMMM Do YYYY, h:mm:ss a"));
                    emails.email_template = emails.email_template.replace(/##RIDE_ORDERS##/g, ride_payout_data[0].unique_id_list ? ride_payout_data[0].unique_id_list : '');
                    emails.email_template = emails.email_template.replace(/##RIDE_CHARGE##/g, ride_payout_data[0].admin_fee);


                    mail_res = await common_functions.send_email(constant_values.admin_email, emails.subject, emails, true);
                    console.log('mailres', mail_res)
                    req.response.status = true;
                    req.response.message = 'Admin payout cron successfull';

                } else {

                    await functions.insert(
                        'admin_payout_master', {
                        total_amount: total_service_charge,
                        payout_id: admin_payout.transaction_id,
                        ride_req_total: ride_payout_data[0].admin_fee,
                        payout_status: 'failed',
                        estimated_payout_date: moment.unix(admin_payout.arrival_date).format("YYYY-MM-DD HH:mm:ss"),
                        error_code: admin_payout.error_code
                    })
                    req.response.message = 'Admin payout cron failed';
                }

            } else {

                throw {
                    errors: [
                        { msg: 'Total admin charge is zero' }
                    ]
                };

            }

            next();
        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            req.response.error = error;
            next();
        }
    },
    async save_api_log(req, next) {
        try {


            switch (req.response.from) {
                case 'user': await functions.insert('api_log', {
                    api: req.originalUrl,
                    called_by: req.decoded ? req.decoded.user_id : 'guest',
                    user_type: 'user'
                })
                    break;
                case 'laundromat': await functions.insert('api_log', {
                    api: req.originalUrl,
                    called_by: req.decoded ? req.decoded.user_id : 'guest',
                    user_type: 'laundromat'
                })
                    break;
                case 'agent': await functions.insert('api_log', {
                    api: req.originalUrl,
                    called_by: req.decoded ? req.decoded.user_id : 'guest',
                    user_type: 'agent'
                })
                    break;
            }
            next();

        } catch (error) {
            console.log(error);
            next()
        }
    },
    async update_push_token(req, next) {
        try {
            validationResult(req).throw();

            switch (req.response.from) {

                case 'user': await functions.update('users', { device_token: req.body.token }, { user_id: req.decoded.user_id });
                    break;
                case 'laundromat': await functions.update('laundromat_master', { device_token: req.body.token }, { id: req.decoded.user_id });
                    break;
            }

            req.response.status = true;
            req.response.message = "Token Updated";
            next();

        } catch (error) {
            console.log(error)
            req.response.message = "Server error"
            if (error.errors) {
                req.response.message = error.errors[0].msg;
            }
            req.response.error = error;
            next();
        }
    },
    async test_mail(req, next) {

        try {
            let emails = await common_functions.get_email_templates(['verification_email']);
            emails = emails[0];
            emails.email_template = emails.template;


            for (let i = 0; i < 27; i++) {
                common_functions.send_email(req.body.email, emails.subject, emails, true)
                console.log(i)
            }
            next();
        } catch (error) {
            console.log(error)
            next();
        }
    },
    async app_version(req, next) {
        try {

            let data;

            switch (req.response.from) {
                case 'user': data = await functions.get('versions', { label: 'user_app' });
                    data = data[0];
                    break;
                case 'laundromat': data = await functions.get('versions', { label: 'laundromat_app' });
                    data = data[0];
                    break;
            }

            req.response.status = true;
            req.response.message = 'Version fetched';
            req.response.data = data;
            next();

        } catch (error) {
            console.log(error)
            next();
        }
    }

}

module.exports = Commonhandler;