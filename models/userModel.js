let functions = require('../helpers/functions')
config = require('.././server/config')
let limit = config.pagination_limit;


let userModel = {
  get_user_detail: function (user_id = "") {
    var sql = `SELECT 
                        u.first_name,
                        u.last_name,
                        u.phone_prefix,
                        u.phone,
                        u.verification_status,
                        u.email,
                        u2.type,
                        u.profile_image 
                   FROM 
                        users u 
                        LEFT JOIN user_type u2 on u.user_type = u2.id 
                   WHERE u.user_id = ${user_id}`;
    console.log(sql);
    return functions.selectQuery(sql);
  },
  get_agent_detail: function (agent_id = "") {
    let sql = `SELECT
                        A.*,
                        U.user_id,
                        U.first_name,
                        U.last_name,
                        U.phone_prefix,
                        U.phone,
                        U.email,
                        U.is_blocked,
                        U.is_deleted,
                        U.verification_status,
                        U2.type AS user_type,
                        AIF.in_hand_money as moneyInHand 
                    FROM
                        agent_details A
                        LEFT JOIN users U ON A.agent_id = U.user_id
                        LEFT JOIN user_type U2 ON U.user_type = U2.id 
                        LEFT JOIN agents_inhand_finances AIF ON AIF.agent_id = U.user_id
                    WHERE A.agent_id = ${agent_id}`;
    return functions.selectQuery(sql);
  },
  get_laundromats: function (data) {
    console.log(data);
    let outerSql = "";

    let sql = `SELECT
                    L.id AS laundromat_id,
                    L.business_name,
                    L.email,
                    L.phone_prefix,
                    L.phone,
                    L.phone_country_code,
                    L.location,
                    L.created_date,
                    L.latitude,
                    L.longitude,
                    L.verification_status,
                    L.profile_image,
                    L.is_profile_complete `;
    if (data.latitude !== "" && data.longitude !== "") {
      sql += `,
            ROUND(
                SQRT(
                    POW( 69.1 * ( L.latitude - ${data.latitude} ), 2 ) + POW( 69.1 * ( ${data.longitude} - L.longitude ) * COS( L.latitude / 57.3 ), 2 ) 
                    ),
                    2
            ) AS distance `;
    }

    sql += ` FROM
                    laundromat_master L
                LEFT JOIN laundromat_service_settings_master LSSM ON LSSM.laundromat_id = L.id
                LEFT JOIN service_master SM ON LSSM.service_id = SM.id
                WHERE
                    is_active = 'Y'`;
    if (data.search_key != "") {
      sql += ` AND (L.business_name LIKE '%${data.search_key}%' OR L.location LIKE '%${data.search_key}%')`;
    }

    if (data.service != "") {
      sql += ` AND LSSM.service_id = ${data.service}  `;
    }

    sql += ` AND ( L.is_deleted = 'N' AND L.is_blocked = 'N' AND L.is_profile_complete = 'Y' AND (L.stripe_account_id IS NOT NULL) AND L.application_status = 'approved' )`;
    sql += ` GROUP BY L.id `;

    if (data.latitude !== "" && data.longitude !== "") {
      sql += ` ORDER BY distance ASC `;
    }

    if (data.latitude !== "" && data.longitude !== "" && data.radius) {
      outerSql = ` SELECT * FROM  (${sql}) AS dt WHERE dt.distance <= ${data.radius}  `;
    } else {
      outerSql = sql;
    }


    return functions.selectQuery(outerSql);
  },
  get_laundromat_details: function (laundromat_id) {
    let sql = `SELECT
                        L.id as laundromat_id,
                        L.business_name,
                        L.email,
                        L.phone_prefix,
                        L.phone,
                        L.phone_country_code,
                        L.location,
                        L.created_date,
                        L.latitude,
                        L.longitude,
                        L.verification_status,
                        L.profile_image,
                        L.is_profile_complete,
                        L.is_active
                    FROM
                        laundromat_master L
                    WHERE
                        L.id = ${laundromat_id}
                        AND ( L.is_deleted = 'N' AND L.is_blocked = 'N' AND L.is_profile_complete = 'Y' )`;
    // is_active = 'Y' AND
    return functions.selectQuery(sql);
  },
  get_unbiased_laundromat_details: function (laundromat_id) {
    let sql = `SELECT
                        L.id as laundromat_id,
                        L.business_name,
                        L.email,
                        L.phone_prefix,
                        L.phone,
                        L.phone_country_code,
                        L.location,
                        L.created_date,
                        L.latitude,
                        L.longitude,
                        L.verification_status,
                        L.profile_image,
                        L.is_profile_complete,
                        L.is_active,
                        LS.normal_wash_price,
                        LS.minimum_order_quantity,
                        LS.maximum_order_quantity
                    FROM
                        laundromat_master L
                        LEFT JOIN laundromat_settings LS ON L.id = LS.laundromat_id
                    WHERE
                        L.id = ${laundromat_id}
                        `;
    // is_active = 'Y' AND
    return functions.selectQuery(sql);
  },
  get_basic_laundromat_view_detail: function (laundromat_id) {
    let sql = `SELECT
                            L.id as laundromat_id,
                            L.business_name,
                            L.email,
                            L.phone_prefix,
                            L.phone,
                            L.phone_country_code,
                            L.location,
                            L.latitude,
                            L.longitude,
                            L.verification_status,
                            L.profile_image,
                            L.is_profile_complete,
                            L.is_active,
                            LS.normal_wash_price,
                            LS.minimum_order_quantity,
                            LS.maximum_order_quantity
                        FROM
                            laundromat_master L
                        LEFT JOIN laundromat_settings LS ON L.id = LS.laundromat_id  
                        WHERE
                            L.is_active = 'Y' AND L.id = ${laundromat_id}
                            AND ( L.is_deleted = 'N' AND L.is_blocked = 'N' AND L.is_profile_complete = 'Y' )`;

    return functions.selectQuery(sql);
  },
  get_config_values: function (fields) {
    let sql = `SELECT * FROM general_config WHERE 1 = 1 `;
    if (fields.length != 0) {
      sql += ` AND (`;
      if (fields.length == 1) {
        sql += ` field = '${fields[0]}'`;
      } else {
        for (let i = 0; i < fields.length; i++) {
          if (i != fields.length - 1) {
            sql += ` field = '${fields[i]}' OR`;
          } else {
            sql += ` field = '${fields[i]}'`;
          }
        }
      }
      sql += `)`;
    }
    return functions.selectQuery(sql);
  },
  get_formatted_config_values: function (data) {
    var element = {};
    data.map((item, index) => {
      element[item.field] = item.value;
    });
    return element;
  },
  get_last_used_pickup_location: function (user_id) {
    // to find the last address used by the user
    let sql = `SELECT * FROM laundry_delivery_address WHERE requester_id = '${user_id}' ORDER BY id DESC LIMIT 1 `;
    return functions.selectQuery(sql);
  },
  check_laundry_request_exist: function (user_id) {
    let sql = `SELECT
                        * 
                    FROM
                        laundry_request LR
                        LEFT JOIN laundry_request_status LRS ON LR.id = LRS.laundry_request_id
                    WHERE LR.requester_id = ${user_id} AND LRS.status != 'delivery_agent_delivered' 
                    AND LRS.status != 'user_cancelled' AND LRS.status != 'laundromat_rejected'`;
    return functions.selectQuery(sql);
  },
  check_user_application_status: function (user_id, type) {
    let sql = ``;
    switch (type) {
      case "laundry":
        sql = `SELECT
                                        LRS.status,
                                        LR.unique_id as request_id,
                                        LR.created_date,
                                        LOSR.label as order_status_label
                                    FROM
                                        laundry_request LR
                                        LEFT JOIN laundry_request_status LRS ON LR.id = LRS.laundry_request_id
                                        LEFT JOIN laundromat_order_status_values LOSR ON LOSR.status = LRS.status 
                                    WHERE
                                        LR.requester_id = ${user_id} 
                                        AND LRS.status != 'delivery_agent_delivered' AND LRS.status != 'user_cancelled' 
                                        AND LRS.status != 'laundromat_rejected'`;
        break;

      case "money":
        sql = `SELECT
                                    MRS.status,
                                    MR.unique_id as request_id,
                                    MR.created_date
                                FROM
                                    money_request MR
                                    LEFT JOIN money_request_status MRS ON MR.id = MRS.money_request_id 
                                WHERE
                                    MR.requester_id = ${user_id} 
                                    AND MRS.status != 'delivered' AND MRS.status != 'cancelled'`;
        break;

      case "ride":
        sql = `SELECT
                                        RR.status,
                                        RR.unique_id as request_id,
                                        RR.created_date,
                                        RRS.label
                                    FROM
                                        ride_requests RR
                                        LEFT JOIN ride_request_statuses RRS ON RRS.status = RR.status
                                    WHERE
                                        RR.requester_id = ${user_id} 
                                        AND RR.status != 'payment_completed' AND RR.status != 'cancelled' OR RR.agent_rate_status = 'pending'`;
        break;
    }
    return functions.selectQuery(sql);
  },
  get_money_request_data: function (unique_id) {
    let sql = `SELECT
                        MR.id as money_request_id,
                        MR.unique_id,
                        MR.original_amount,
                        MR.final_amount,
                        MR.delivery_charge,
                        MR.time_duration,
                        MR.service_charge,
                        MR.stripe_transaction_charge,
                        MR.created_date,
                        MR.stripe_charge_id,
                        DATE_FORMAT(MR.created_date, "%h:%i %p") as created_time,
                        MR.accepted_agent_id,
                        MR.requester_id,
                        MRS.status,
                        MR.delivery_otp,
                        MR.is_otp_verified,
                        MDA.delivery_address,
                        MDA.latitude as delivery_latitude,
                        MDA.longitude as delivery_longitude
                    FROM
                        money_request MR 
                        LEFT JOIN money_request_status MRS ON MR.id = MRS.money_request_id
                        LEFT JOIN money_delivery_address MDA ON MDA.money_request_id = MR.id
                    WHERE
                        unique_id = '${unique_id}'`;
    return functions.selectQuery(sql);
  },
  get_money_request_list: function (
    user_id,
    offset = 0,
    filter = "",
    start = "",
    end = ""
  ) {
    let sql = `SELECT
                    MR.unique_id AS unique_money_request_id,
                    MR.final_amount,
                    MR.original_amount,
                    MR.delivery_charge,
                    MR.time_duration,
                    MR.service_charge,
                    MR.stripe_transaction_charge,
                    MR.created_date,
                    MRS.status,
                    MDA.delivery_address as pickup_location,
                    MDA.latitude as pickup_latitude,
                    MDA.longitude as pickup_longitude,
                    AD.first_name as agent_first_name,
                    AD.last_name as agent_last_name,
                    AD.phone_prefix as agent_phone_prefix,
                    AD.phone_prefix AS agent_phone_prefix,
                    AD.phone AS agent_phone,
                    AD.email AS agent_email,
                    AD.profile_image AS agent_profile_image
                FROM   
                    money_request MR 
                    LEFT JOIN money_request_status MRS ON MRS.money_request_id = MR.id
                    LEFT JOIN money_delivery_address MDA ON MDA.money_request_id = MR.id
                    LEFT JOIN users UM ON UM.user_id = MR.requester_id 
                    LEFT JOIN users AD ON AD.user_id = MR.accepted_agent_id
                WHERE
                    MR.requester_id = ${user_id} AND (MRS.status = 'cancelled' OR MRS.status = 'delivered') `;

    if (start != "" && end != "") {
      sql += ` AND (CAST(MR.created_date AS DATE) BETWEEN  '${start}' AND '${end}') `;
    }

    if (filter != "") {
      if (filter == "Desc") {
        sql += ` ORDER BY  MR.created_date DESC `;
      }

      if (filter == "Asc") {
        sql += ` ORDER BY  MR.created_date ASC `;
      }
    }

    if (offset >= 0) {
      sql += ` LIMIT ` + offset * limit + `,` + limit;
    }

    return functions.selectQuery(sql);
  },
  get_laundry_request_list: function (
    user_id,
    offset,
    filter = "",
    start = "",
    end = ""
  ) {
    let sql = `SELECT
                    LR.unique_id AS unique_laundry_request_id,
                    LR.id as request_id,
                    LR.pickup_agent_id,
                    LR.drop_agent_id,
                    LR.pickup_date, 
                    LR.pickup_time,
                    LR.delivery_fee,
                    LR.total_approximate_amount,
                    LR.service_charge,
                    LR.stripe_transaction_fee,
                    LR.created_date,
                    LR.is_otp_verified,
                    LRS.status,
                    LOSV.label as status_label,
                    LR.laundromat_id,
                    UM.first_name AS requester_first_name,
                    UM.last_name AS requester_last_name,
                    UM.phone_prefix AS requester_phone_prefix,
                    UM.phone AS requester_phone,
                    UM.email AS requester_email,
                    UM.profile_image AS requester_profile_image,
                    LDA.delivery_address as pickup_location,
                    LDA.latitude as pickup_latitude,
                    LDA.longitude as pickup_longitude,
                    LOSV.order     
                FROM
                    laundry_request LR 
                    LEFT JOIN laundry_request_status LRS ON LRS.laundry_request_id = LR.id
                    LEFT JOIN laundry_delivery_address LDA ON LDA.laundry_request_id = LR.id
                    LEFT JOIN users UM ON UM.user_id = LR.requester_id
                    LEFT JOIN laundromat_order_status_values LOSV ON LOSV.status = LRS.status
                WHERE
                    LR.requester_id = ${user_id} AND (LOSV.order >= 19 OR LOSV.order = 3) `;

    if (start != "" && end != "") {
      sql += ` AND (DATE(LR.created_date) >= DATE('${start}') AND  DATE(LR.created_date) <= DATE('${end}')) `;
    }

    if (filter != "") {
      if (filter == "Desc") {
        sql += ` ORDER BY  LR.created_date DESC `;
      }

      if (filter == "Asc") {
        sql += ` ORDER BY  LR.created_date ASC `;
      }
    }

    if (offset >= 0) {
      sql += ` LIMIT ` + offset * limit + `,` + limit;
    }

    // LOSV.order >= 19 for all user cancelled and delivered orders
    // LOSV.order = 3 for laundromat rejected orders

    return functions.selectQuery(sql);
  },
  get_agent_list_of_money_req: function (unique_id) {
    let sql = `SELECT
                        MR.id,
                        OMR.*,
                        AD.agent_id,
                        UM.email 
                    FROM
                        money_request MR
                        LEFT JOIN outgoing_money_request_log OMR ON OMR.request_id = MR.id
                        LEFT JOIN agent_details AD ON AD.unique_agent_id = OMR.agent_unique_id
                        LEFT JOIN users UM ON UM.user_id = AD.agent_id 
                    WHERE
                        MR.unique_id = '${unique_id}'`;
    return functions.selectQuery(sql);
  },
  get_laundromat_sub_services_user_perspective: function (
    laundromat_id,
    service_id
  ) {
    let sql = `SELECT
                        LSSM.id as sub_service_id,
                        LSSM.sub_service_label as name,
                        LSSM.price,
                        LSSM.creator
                    FROM
                        laundromat_service_sub_master LSSM
                    WHERE
                        LSSM.service_id = ${service_id} AND LSSM.laundromat_id = ${laundromat_id} AND LSSM.is_deleted = 'N' `;

    return functions.selectQuery(sql);
  },
  get_settings: function (settings_array) {
    let sql = ` SELECT * FROM general_config WHERE `;
    for (let i = 0; i < settings_array.length; i++) {
      if (i == settings_array.length - 1) {
        sql += `field = '${settings_array[i]}' `;
      } else {
        sql += `field = '${settings_array[i]}' OR `;
      }
    }

    return functions.processQuery(sql);
  },
  get_ride_request_data: async function (request_id, populate = []) {
    let request_data = {};
    let sql = `SELECT
                        RR.id,
                        RR.unique_id,
                        RR.requester_id,
                        RR.original_ride_duration,
                        RR.extra_duration,
                        RR.incoming_rider_duration,
                        RR.final_ride_duration,
                        RR.is_airport_ride,
                        RR.ride_fee,
                        RR.agent_fee,
                        RR.agent_original_fee,
                        RR.operation_fee,
                        RR.airport_ride_fee,
                        RR.offer_price,
                        RR.service_charge,
                        RR.additional_cost,
                        RR.additional_cost_reason,
                        RR.total_additional_cost,
                        RR.per_minute_extra_fee,
                        RR.transaction_fee,
                        RR.additional_cost_transaction_fee,
                        RR.status,
                        RRS.label as status_label,
                        RR.original_payable_price,
                        RR.final_payable_price,
                        RR.stripe_charge_id,
                        RR.created_date,
                        RR.vehicle_type,
                        RR.agent_id
                    FROM
                        ride_requests RR
                        LEFT JOIN ride_request_statuses RRS ON RRS.status = RR.status
                        
                    WHERE RR.unique_id = '${request_id}'`;

    let result_1 = await functions.selectQuery(sql);

    if (result_1.length > 0) {
      request_data = result_1[0];

      if (populate.includes("address")) {
        let sql_2 = ` SELECT 
                                RRAD.pickup_location,
                                RRAD.pickup_longitude,
                                RRAD.pickup_latitude,
                                RRAD.dropoff_location,
                                RRAD.dropoff_longitude,
                                RRAD.dropoff_latitude,
                                RRAD.travel_distance
                            FROM ride_request_address_details  RRAD
                            WHERE RRAD.request_id = ${request_data.id} `;

        let result_2 = await functions.selectQuery(sql_2);
        request_data.address = result_2.length > 0 ? result_2[0] : {};
      }

      if (populate.includes("vehicle_type_details")) {
        let veh_data = await functions.get("vehicle_types", {
          id: request_data.vehicle_type,
        });
        request_data.vehicle_type_details = veh_data[0];
      }

      if (populate.includes("language")) {
        let sql_3 = `SELECT
                            RRL.language_id,
                            L.code,
                            L.value as label
                        FROM
                            ride_request_languages RRL
                            LEFT JOIN language L ON L.language_id = RRL.language_id
                        WHERE
                            request_id = ${request_data.id}`;
        let result_3 = await functions.selectQuery(sql_3);
        request_data.languages = result_3;
      }

      if (populate.includes("customer")) {
        let sql_4 = `SELECT
                                UM.email,
                                UM.first_name,
                                UM.last_name,
                                UM.phone_prefix,
                                UM.phone,
                                UM.profile_image,
                                UM.device_token
                            FROM
                                users UM
                            WHERE
                                user_id = ${request_data.requester_id}`;
        let result_4 = await functions.selectQuery(sql_4);
        request_data.customer = result_4.length > 0 ? result_4[0] : {};
      }

      if (populate.includes("logs")) {
        let sql_5 = `SELECT
                                RRL.*,
                                RRS.label
                            FROM
                                ride_request_tracking_log RRL
                                LEFT JOIN ride_request_statuses RRS ON  RRL.event = RRS.status
                            WHERE
                                request_id = ${request_data.id}`;
        let result_5 = await functions.selectQuery(sql_5);
        request_data.logs = result_5.length > 0 ? result_5 : {};
      }

      if (populate.includes("agent")) {
        let sql_6 = `SELECT
                                AD.unique_agent_id,
                                UM.first_name,
                                UM.last_name,
                                UM.email,
                                UM.phone_prefix,
                                UM.phone,
                                UM.profile_image,
                                AD.vehicle_number,
                                AD.vehicle_image,
                                AD.vehicle_model,
                                AD.vehicle_type 
                            FROM
                                agent_details AD
                                LEFT JOIN users UM ON UM.user_id = AD.agent_id 
                            WHERE
                                AD.agent_id = ${request_data.agent_id}`;

        let result_6 = await functions.selectQuery(sql_6);
        request_data.agent_data = result_6.length > 0 ? result_6[0] : {};

        if (result_6.length > 0) {
          if (request_data.agent_data.vehicle_type) {
            let agent_Vehicle = await functions.get("vehicle_types", {
              id: request_data.agent_data.vehicle_type,
            });
            request_data.agent_data.vehicle_data =
              agent_Vehicle.length > 0 ? agent_Vehicle[0] : {};
          } else {
            request_data.agent_data.vehicle_data = {};
          }

          let agent_rating = `SELECT
                                        IF
                                            ( ROUND( AVG( rating ), 2 ) IS NULL, 0, ROUND( AVG( rating ), 2 ) ) AS avg_rating 
                                        FROM
                                            agent_rating_master 
                                        WHERE
                                            agent_id =  ${request_data.agent_id}`;
          let agent_rating_res = await functions.selectQuery(agent_rating);
          request_data.agent_data.rating = agent_rating_res[0].avg_rating;

          let sql_agent_lang = `SELECT
                                            RRL.language_id,
                                            L.code,
                                            L.value as label
                                        FROM
                                            agent_languages RRL
                                            LEFT JOIN language L ON L.language_id = RRL.language_id
                                        WHERE
                                            agent_id = ${request_data.agent_id}`;
          let sql_agent_lang_result_3 = await functions.selectQuery(
            sql_agent_lang
          );
          request_data.agent_data.languages = sql_agent_lang_result_3;
        }
      }

      return request_data;
    } else {
      return false;
    }
  },
  get_ride_request_history: function (
    user_id,
    offset = 0,
    filter = "",
    start = "",
    end = ""
  ) {
    let sql = `SELECT
                    RR.unique_id AS unique_ride_request_id,
                    RR.original_payable_price,
                    RR.final_payable_price,
                    RR.total_additional_cost,
                    RR.service_charge,
                    RR.additional_cost_transaction_fee,
                    RR.final_ride_duration,
                    RR.status,
                    RR.created_date,
                    RDA.pickup_location,
                    RDA.pickup_latitude,
                    RDA.pickup_longitude,
                    RDA.dropoff_location,
                    RDA.dropoff_latitude,
                    RDA.dropoff_longitude,
                    RDA.travel_distance,
                    AD.first_name as agent_first_name,
                    AD.last_name as agent_last_name,
                    AD.phone_prefix as agent_phone_prefix,
                    AD.phone_prefix AS agent_phone_prefix,
                    AD.phone AS agent_phone,
                    AD.email AS agent_email,
                    AD.profile_image AS agent_profile_image
                FROM   
                    ride_requests RR 
                    LEFT JOIN ride_request_address_details RDA ON RDA.request_id = RR.id
                    LEFT JOIN users UM ON UM.user_id = RR.requester_id 
                    LEFT JOIN users AD ON AD.user_id = RR.agent_id
                WHERE
                    RR.requester_id = ${user_id} AND RR.status = 'payment_completed'`;

    if (start != "" && end != "") {
      sql += ` AND (CAST(RR.created_date AS DATE) BETWEEN  '${start}'  AND  '${end}' ) `;
    }

    if (filter != "") {
      if (filter == "Desc") {
        sql += ` ORDER BY  RR.created_date DESC `;
      }

      if (filter == "Asc") {
        sql += ` ORDER BY  RR.created_date ASC `;
      }
    }

    if (offset >= 0) {
      sql += ` LIMIT ` + offset * limit + `,` + limit;
    }

    return functions.selectQuery(sql);
  },
};

module.exports = userModel;