const functions = require('../helpers/functions');
const config = require('../server/config');
const moment = require('moment');


var AWS = require('aws-sdk');
const ID = config.s3_id;
const SECRET = config.s3_secret_access_key;
const BUCKET_NAME = config.s3_default_bucket;
const s3 = new AWS.S3({
    accessKeyId: ID,
    secretAccessKey: SECRET
});

let common_handler = {


    detect_type_of_request: function (status) { // this is basically detecing who is supposed to act when these statuses come;


        switch (status) {
            case 'requested':
                return 'laundromat';
            case 'accepted':
                return 'user';
            case 'send_pickup':
            case 'pickup_agent_accept':
            case 'pickup_agent_start':
            case 'pickup_agent_arrived':
            case 'pickup_agent_collected':
            case 'pickup_agent_delivered':
                return 'pickup_agent';
            case 'laundromat_laundry_collected':
            case 'invoice_sent':
                return 'laundromat_request';
            case 'invoice_paid':
            case 'invoice_rejected':
                return 'user';
            case 'cloth_wash_processing':
                'user';
            case 'send_delivery':
            case 'delivery_agent_accept':
            case 'delivery_agent_start':
            case 'delivery_agent_arrived':
            case 'delivery_agent_collected':
            case 'delivery_agent_delivered':
                return 'delivery_agent';
            default: return 'user';
        }




    },
    insert_tracking_log: async function (type, date, event, request_id, updated_by) {

        switch (type) {

            case 'money': return functions.insert('money_request_tracking_log', {
                money_request_id: request_id,
                event: event,
                recorded_datetime: date,
                updated_by: updated_by
            })

            case 'ride': return functions.insert('ride_request_tracking_log', {
                request_id: request_id,
                event: event,
                recorded_date: date,
                updated_by: updated_by
            })

            case 'laundry':

                let res = await functions.get('laundry_request_tracking_log', { event: event, laundry_request_id: request_id });
                if (res.length > 0) {
                    return functions.update('laundry_request_tracking_log', {
                        recorded_datetime: date,
                        updated_by: updated_by
                    }, {
                        event: event,
                        laundry_request_id: request_id
                    })
                } else {
                    return functions.insert('laundry_request_tracking_log', {
                        laundry_request_id: request_id,
                        event: event,
                        recorded_datetime: date,
                        updated_by: updated_by
                    })
                }

        }
    },
    get_tracking_log: function (type, request_id, user_id) {
        let sql = ``;
        switch (type) {

            case 'money':
                sql = `SELECT
                                            MTL.event,
                                            DATE_FORMAT( MTL.recorded_datetime, '%b %d %a %h:%i %p' ) AS event_time,
                                            MTL.recorded_datetime
                                        FROM
                                            money_request_tracking_log MTL
                                            
                                        WHERE
                                            money_request_id = ${request_id}`;
                break;

            case 'laundry':
                sql = `SELECT
                                            LTL.event,
                                            DATE_FORMAT( LTL.recorded_datetime, '%b %d %a %h:%i %p' ) AS event_time,
                                            LTL.recorded_datetime,
                                            LOSR.label
                                        FROM
                                            laundry_request_tracking_log LTL
                                            LEFT JOIN laundromat_order_status_values LOSR ON LOSR.status = LTL.event
                                        WHERE
                                            laundry_request_id = ${request_id}`;
                break;

        }
        return functions.processQuery(sql);
    },
    invoice_id_gen: function (id, date) {
        return 'IN' + date.valueOf().toString().substring(0, 4) + id;
    },
    save_push_notification: function (
        request_id,
        from,
        to,
        sent_by_user_type,
        sent_to_user_type,
        push_data,
        send_date_time,
        preference_duration = '',
        event) {

        return functions.insert('push_notification_master', {
            request_id: request_id,
            push_data: JSON.stringify(push_data),
            sent_by: from,
            sent_to: to,
            sent_by_user_type: sent_by_user_type,
            sent_to_user_type: sent_to_user_type,
            event: event,
            created_datetime: moment().format("YYYY-MM-DD HH:mm:ss"),
            sending_date: send_date_time,
            preference_duration: preference_duration
        })

    },
    get_push_list: function (limit) {
        let sql = `SELECT
                        * 
                    FROM
                        push_notification_master 
                    WHERE 
                        send_status = 'N'
                    LIMIT `+ limit;
        return functions.processQuery(sql);
    },
    get_user_data_for_push: function (user_id, user_type) {
        let data;
        return new Promise(async (resolve, reject) => {
            try {
                switch (user_type) {

                    case 'agent':
                    case 'user':

                        data = await functions.get('users', {
                            user_id: user_id
                        })
                        resolve({
                            name: data[0].first_name + ' ' + data[0].last_name,
                            device_token: data[0].device_token
                        })
                        break;
                    case 'laundromat':
                        data = await functions.get('laudromat_master', {
                            id: user_id
                        })

                        resolve({
                            name: data[0].business_name,
                            device_token: data[0].device_token
                        })
                        break;
                    default: resolve({
                        name: 'Error',
                        device_token: null
                    })
                        break;
                }

            } catch (error) {
                console.log(error, '--------------------------------------------------')
                reject({
                    error: error
                })
            }


        })

    },
    convert_date_function: function (date) {
        return date.getUTCFullYear() + '-' +
            ('00' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
            ('00' + date.getUTCDate()).slice(-2) + ' ' +
            ('00' + date.getUTCHours()).slice(-2) + ':' +
            ('00' + date.getUTCMinutes()).slice(-2) + ':' +
            ('00' + date.getUTCSeconds()).slice(-2)
    },
    check_rating_exist: function (request_id, requester, agent_id, request_type, agent_type) {
        return functions.get('agent_rating_master', {
            request_id: request_id,
            rated_by: requester,
            agent_id: agent_id,
            request_type: request_type,
            agent_type: agent_type
        });
    },
    get_email_templates(keys) {
        let sql = `SELECT * FROM email_templates WHERE `;
        for (let i = 0; i < keys.length; i++) {

            if (i != keys.length - 1) {
                sql += ` name = '` + keys[i] + `' OR `;
            } else {
                sql += ` name = '` + keys[i] + `'`
            }
        }

        return functions.processQuery(sql);
    },
    send_email: function (email, subject, email_data, is_email) {
        try {
            return new Promise((resolve, reject) => {
                functions.sendMail(email, subject, email_data, is_email, function (result) {
                    if (result?.status === 'success') {
                        resolve(true);
                    } else {
                        reject(false)
                    }
                })
            })
        } catch (error) {
            console.log(error);
            return new Promise((resolve, reject) => { reject(false) })
        }

    },
    get_s3_signed_url: function (key) {

        const signedUrlExpireSeconds = 60 * 20
        return new Promise((resolve, reject) => {
            try {
                resolve(s3.getSignedUrl('getObject', {
                    Bucket: BUCKET_NAME,
                    Key: key,
                    Expires: signedUrlExpireSeconds
                }))
            } catch (error) {
                console.log(error)
                reject(null);
            }

        })

    },
    get_cms: function (keys) {
        let sql = `SELECT * FROM cms WHERE `;
        for (let i = 0; i < keys.length; i++) {

            if (i != parseInt(keys.length - 1)) {
                sql += ` key_value  = '${keys[i]}' OR `;
            } else {
                sql += ` key_value  = '${keys[i]}' `;
            }
        }
        return functions.processQuery(sql);
    },
    isJson: function (json) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;

    },
    insert_delete_log: function (type, entity_id, deleted_date) {

        return functions.insert('delete_log', {
            entity_id: entity_id,
            entity_type: type,
            deleted_date: deleted_date
        })
    },
    db_like_finder: function (table, like_field, likables) {

        let sql = ` SELECT * FROM ${table} WHERE  ${like_field} LIKE `;
        for (let i = 0; i < likables.length; i++) {
            if (i == parseInt(likables.length - 1)) {
                sql += ` %${likables[i]}% `;
            } else {
                sql += ` %${likables[i]}% OR LIKE `;
            }
        }

        console.log(sql)
    }

}

module.exports = common_handler;