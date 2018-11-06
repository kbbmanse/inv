const os = require("os");
const util = require("util");
const net = require("net");
const EventEmitter = require('events').EventEmitter;
const Config = require("./config.js");
require("date-utils")

var OrderInfo = function(orderProtocolType, goodsCode, longOrShort, price, quantity, orgOrderInfo, resultCB, clientOrderid, sessionId) {
	var orderProtocolType_ = orderProtocolType;
	var goodsCode_ = goodsCode;
	var longOrShort_ = longOrShort;
	var price_ = price;
	var quantity_ = quantity;
	var orgOrderInfo_ = orgOrderInfo;
	var resultCB_ = resultCB;
	var clientOrderid_ = clientOrderid;
	var sessionId_ = sessionId;
	var signedCnt_ = 0;
	var status_ = OrderComm.OIS_NONE;
	var orderNo_ = "";
    var positionInfoId_ = -1;
    var orderRequestInfo_ = null;

	return {
		"getOrderProtocolType" : function() { return orderProtocolType_;},
		"getGoodsCode" : function() { return goodsCode_;},
		"getLongOrShort" : function() { return longOrShort_;},
		"getPrice" : function() { return price_;},
		"getQuantity" : function() { return quantity_;},
		"setQuantity" : function(value) { quantity_ = value;},
		"getOrgOrderInfo" : function() { return orgOrderInfo_;},
		"getResultCB" : function() { return resultCB_;},
		"getClientOrderid" : function() { return clientOrderid_;},
		"getSessionId" : function() { return sessionId_;},
		"getSignedCnt" : function() { return signedCnt_;},
		"incSignedCnt" : function(cnt) { signedCnt_ += cnt; return signedCnt_; },
		"getStatus" : function() { return status_; },
		"setStatus" : function(stat) { status_ = stat; },
		"getPositionInfoId" : function() { return positionInfoId_; },
		"setPositionInfoId" : function(id) { positionInfoId_ = id; },
		"getOrderRequestInfo" : function() { return orderRequestInfo_; },
		"setOrderRequestInfo" : function(info) { orderRequestInfo_ = info; },
		"getOrderNo" : function() { return orderNo_; },
		"setOrderNo" : function(orderNo) { orderNo_ = orderNo; }
	};
};

var SignInfo = function(stat, signed_price, signed_quantity) {
	var price_ = signed_price;
	var quantity_ = signed_quantity;
	var status_ = stat;

	return {
		"getSignedPrice" : function() { return price_;},
		"getSignedQuantity" : function() { return quantity_;},
		"getStatus" : function() { return status_; },
		"setStatus" : function(stat) { status_ = stat; },
	};
};

var OrderComm = function(port, host) {
    const config = new Config();
    var clientOrderId = 0;
    var orderMap = new Map();
    var infoMap = new Map();
    var recvBuffer = new Buffer(8192);
    var recvTotal = 0;
    var connStatus = 0;
    var sessionId = -1;

    function FormatNumberLength(num, length) {
        var r = "" + num;
        while (r.length < length) {
            r = "0" + r;
        }
        return r;
    }

    function writeData(socket, data){
        var success = socket.write(data);
        if(!success){
            (function(socket, data){
                socket.once('drain', function(){
                    writeData(socket, data);
                });
            })(socket, data)
        }
    }
    if (host) 
        conn = net.createConnection(port, host);
    else 
        conn = net.createConnection(port, config['comm_host']);
    conn.on('connect', function() {
        console.log("연결됨.");
        var jobj = {"from" : 1, "req_rsp" : 0, "msg_type" : 0};
        var data = JSON.stringify(jobj);
        var hdr = FormatNumberLength(data.length, OrderComm.HDR_LEN);
        connStatus = 1;
        writeData(conn, hdr + data);
    });

    var AliveSender = function () {
        var self = this;
        setInterval(function() {
            self.emit('ping');
        }, 30000);
    };

    util.inherits(AliveSender, EventEmitter);

    var aliveSender;
    var processOrder = function(msg_type, msg_data) {
        var client_order_id = msg_data[OrderComm.ORDER_PROTOCOL_FIELD_CLIENT_ORDER_ID];
        var result_msg_type = msg_data[OrderComm.ORDER_PROTOCOL_FIELD_RESULT_MSG_TYPE];
        var order_info = orderMap[client_order_id];
        if (order_info) {
            if (result_msg_type === OrderComm.ORDER_PROTOCOL_FIELD_RESULT_MSG_TYPE_REGISTER) {
                var result = msg_data[OrderComm.ORDER_PROTOCOL_FIELD_REGISTERED_STATUS];
                if (result === OrderComm.ORDER_PROTOCOL_FIELD_REGISTERED_STATUS_FAIL) {
                    order_info.setStatus(OrderComm.OIS_REGISTER_FAIL);
                    order_info.getResultCB()(order_info, null);
                }
                else {
                    order_info.setOrderNo(msg_data[OrderComm.ORDER_PROTOCOL_FIELD_ORDER_NO]);	
                    order_info.setStatus(OrderComm.OIS_REGISTER_SUCCESS);
                    order_info.getResultCB()(order_info, null);
                }
            }
            else if (result_msg_type === OrderComm.ORDER_PROTOCOL_FIELD_RESULT_MSG_TYPE_REGISTER_RESULT) {
                order_info.setStatus(OrderComm.OIS_REGISTER_RESULT);
                var signed_price = parseFloat(msg_data[OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_PRICE]);
                var signed_quantity = parseInt(msg_data[OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_QUANTITY]);
                var sign_info = new SignInfo(OrderComm.OIS_REGISTER_RESULT, signed_price, signed_quantity);

                order_info.getResultCB()(order_info, sign_info);
            }
            else {
                var result = msg_data[OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_STATUS];
                var signed_price = parseFloat(msg_data[OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_PRICE]);
                var signed_quantity = parseInt(msg_data[OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_QUANTITY]);
                order_info.incSignedCnt(signed_quantity);
                if (result === OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_STATUS_PARTIAL) {
                    var sign_info = new SignInfo(OrderComm.OIS_PARTIAL_COMPLETED, signed_price, signed_quantity);
                    order_info.setStatus(OrderComm.OIS_PARTIAL_COMPLETED);
                    order_info.getResultCB()(order_info, sign_info);
                }
                else {
                    var sign_info = new SignInfo(OrderComm.OIS_COMPLETED, signed_price, signed_quantity);
                    order_info.setStatus(OrderComm.OIS_COMPLETED);
                    order_info.getResultCB()(order_info, sign_info);
                    orderMap.delete(client_order_id);
                }
            }
        }
    };

    var processInfo = function(msg_type, msg_data) {
        var client_order_id = msg_data[OrderComm.ORDER_PROTOCOL_FIELD_CLIENT_ORDER_ID];
        var result = msg_data[OrderComm.INFO_PROTOCOL_FIELD_RESULT_MSG_TYPE_REGISTER_RESULT];
        var type = msg_data[OrderComm.INFO_PROTOCOL_FIELD_TYPE];
        var info_cb = infoMap[client_order_id];
        if (info_cb) {
            if (type === OrderComm.INFO_PROTOCOL_FIELD_TYPE_REGISTER_REAL ||
                    type === OrderComm.INFO_PROTOCOL_FIELD_TYPE_UNREGISTER_REAL) {
                info_cb(result);
            }
            else {
                info_cb(result, msg_data["infos"]);
            }
        }
    };

    var processMsg = function(jbody) {
        if (connStatus == 1) {
            sessionId = jbody["sid"];
            var jobj = {"from" : 1, "req_rsp" : 0, "msg_type" : OrderComm.PROTOCOL_MSG_TYPE_PING, "sid" : sessionId};
            var data = JSON.stringify(jobj);
            var hdr = FormatNumberLength(data.length, OrderComm.HDR_LEN);
            connStatus = 2;
            writeData(conn, hdr + data);
        }
        else if (connStatus == 2) {
            aliveSender  = new AliveSender();
            aliveSender.on("ping", function() {
                var jobj = {"from" : 1, "req_rsp" : 0, "msg_type" : OrderComm.PROTOCOL_MSG_TYPE_PING, "sid" : sessionId};
                var data = JSON.stringify(jobj);
                var hdr = FormatNumberLength(data.length, OrderComm.HDR_LEN);
                writeData(conn, hdr + data);
            });

            connStatus = 3;
        }
        else if (connStatus == 3) {
            var msg_type = jbody["msg_type"];
            if (msg_type == OrderComm.PROTOCOL_MSG_TYPE_PING) {
            }
            else if (msg_type == OrderComm.PROTOCOL_MSG_TYPE_ORDER) {
                processOrder(msg_type, jbody["msg_data"]);
            }
            else if (msg_type == OrderComm.PROTOCOL_MSG_TYPE_INFO) {
                processInfo(msg_type, jbody["msg_data"]);
            }
        }
    };

    conn.on('data', function(data) {
        data.copy(recvBuffer, recvTotal, 0, data.length);
        recvTotal += data.length;
        while (recvTotal >= OrderComm.HDR_LEN) {
            var hdr = recvBuffer.slice(0, OrderComm.HDR_LEN);
            var body_len = parseInt(hdr);
            var msg_len = OrderComm.HDR_LEN + body_len;
            if (msg_len <= recvTotal) {
                var body = recvBuffer.slice(OrderComm.HDR_LEN, msg_len);
                var jobj = JSON.parse(body);
                processMsg(jobj);

                if (recvTotal - msg_len > 0) {
                    recvBuffer.copy(recvBuffer, 0, msg_len, recvTotal);	
                }
                recvTotal -= msg_len;
            }
            else {
                break;
            }
        }	
    }); 
    this.getConnStatus = function() { return connStatus;};
    this.sendOrder = function(orderProtocolType, goodsCode, longOrShort, price, quantity, orgOrderInfo, resultCB) {
        var cur_client_order_id = clientOrderId++;
        var order_info = null;
        if (orderProtocolType === OrderComm.OPT_NEW) {
            order_info = new OrderInfo(orderProtocolType, goodsCode, longOrShort, price, quantity, orgOrderInfo, resultCB, cur_client_order_id, sessionId);
            var jobj = {}, msg_data = {};
            jobj["from"] = 1;
            jobj["req_rsp"] = 0;
            jobj["msg_type"] = OrderComm.PROTOCOL_MSG_TYPE_ORDER;
            jobj["sid"] = sessionId;
            msg_data[OrderComm.ORDER_PROTOCOL_FIELD_TYPE] = OrderComm.ORDER_PROTOCOL_FIELD_TYPE_NEW;
            msg_data[OrderComm.ORDER_PROTOCOL_FIELD_GOODS_CODE] = goodsCode;
            msg_data[OrderComm.ORDER_PROTOCOL_FIELD_LONG_OR_SHORT] = longOrShort;
            msg_data[OrderComm.ORDER_PROTOCOL_FIELD_PRICE] = price.toFixed(2);
            msg_data[OrderComm.ORDER_PROTOCOL_FIELD_QUANTITY] = "" + quantity;
            msg_data[OrderComm.ORDER_PROTOCOL_FIELD_CLIENT_ORDER_ID] = cur_client_order_id;
            jobj["msg_data"] = msg_data;
            var data = JSON.stringify(jobj);
            var hdr = FormatNumberLength(data.length, OrderComm.HDR_LEN);
            writeData(conn, hdr + data);
            orderMap[cur_client_order_id] = order_info;
            return order_info;
        }

        return null;
    };

    this.registerReal = function(stockCodes, resultCB) {
        var cur_client_order_id = clientOrderId++;
        var jobj = {}, msg_data = {};
        jobj["from"] = 1;
        jobj["req_rsp"] = 0;
        jobj["msg_type"] = OrderComm.PROTOCOL_MSG_TYPE_INFO;
        jobj["sid"] = sessionId;
        msg_data[OrderComm.INFO_PROTOCOL_FIELD_TYPE] = OrderComm.INFO_PROTOCOL_FIELD_TYPE_REGISTER_REAL;
        msg_data[OrderComm.INFO_PROTOCOL_FIELD_GOODS_CODES] = stockCodes;
        msg_data[OrderComm.ORDER_PROTOCOL_FIELD_CLIENT_ORDER_ID] = cur_client_order_id;
        jobj["msg_data"] = msg_data;
        var data = JSON.stringify(jobj);
        console.log(data);
        var hdr = FormatNumberLength(data.length, OrderComm.HDR_LEN);
        writeData(conn, hdr + data);
        infoMap[cur_client_order_id] = resultCB;
    };

    this.unregisterReal = function(stockCodes, resultCB) {
        var cur_client_order_id = clientOrderId++;
        var jobj = {}, msg_data = {};
        jobj["from"] = 1;
        jobj["req_rsp"] = 0;
        jobj["msg_type"] = OrderComm.PROTOCOL_MSG_TYPE_INFO;
        jobj["sid"] = sessionId;
        msg_data[OrderComm.INFO_PROTOCOL_FIELD_TYPE] = OrderComm.INFO_PROTOCOL_FIELD_TYPE_UNREGISTER_REAL;
        msg_data[OrderComm.INFO_PROTOCOL_FIELD_GOODS_CODES] = stockCodes;
        msg_data[OrderComm.ORDER_PROTOCOL_FIELD_CLIENT_ORDER_ID] = cur_client_order_id;
        jobj["msg_data"] = msg_data;
        var data = JSON.stringify(jobj);
        var hdr = FormatNumberLength(data.length, OrderComm.HDR_LEN);
        writeData(conn, hdr + data);
        infoMap[cur_client_order_id] = resultCB;
    };

    this.getCurInfo = function(stockCodes, resultCB) {
        var cur_client_order_id = clientOrderId++;
        var jobj = {}, msg_data = {};
        jobj["from"] = 1;
        jobj["req_rsp"] = 0;
        jobj["msg_type"] = OrderComm.PROTOCOL_MSG_TYPE_INFO;
        jobj["sid"] = sessionId;
        msg_data[OrderComm.INFO_PROTOCOL_FIELD_TYPE] = OrderComm.INFO_PROTOCOL_FIELD_TYPE_GET_CUR_INFO;
        msg_data[OrderComm.INFO_PROTOCOL_FIELD_GOODS_CODES] = stockCodes;
        msg_data[OrderComm.ORDER_PROTOCOL_FIELD_CLIENT_ORDER_ID] = cur_client_order_id;
        jobj["msg_data"] = msg_data;
        var data = JSON.stringify(jobj);
        var hdr = FormatNumberLength(data.length, OrderComm.HDR_LEN);
        writeData(conn, hdr + data);
        infoMap[cur_client_order_id] = resultCB;
    };
};
OrderComm.PROTOCOL_MSG_TYPE = "msg_type";
OrderComm.PROTOCOL_MSG_TYPE_HELLO = 0;
OrderComm.PROTOCOL_MSG_TYPE_PING = 1;
OrderComm.PROTOCOL_MSG_TYPE_ORDER = 2;
OrderComm.PROTOCOL_MSG_TYPE_INFO = 3;
OrderComm.OPT_NEW = 0;
OrderComm.OPT_MODIFY = 1;
OrderComm.OPT_CANCEL = 2;
OrderComm.OPRS_SUCCESS = 0;
OrderComm.OPRS_FAIL = 1;
OrderComm.OPSS_PARTIAL = 0;
OrderComm.OPSS_COMPLETED = 1;
OrderComm.OPRMT_REGISTER = 0;
OrderComm.OPRMT_SIGN = 1;
OrderComm.OPRMT_REGISTER_RESULT = 2;
OrderComm.OIS_NONE = 0;
OrderComm.OIS_REGISTER_FAIL = 1;
OrderComm.OIS_REGISTER_SUCCESS = 2;
OrderComm.OIS_PARTIAL_COMPLETED = 3;
OrderComm.OIS_COMPLETED = 4;
OrderComm.OIS_REGISTER_RESULT = 5;
OrderComm.ORDER_PROTOCOL_FIELD_TYPE = "type";
OrderComm.ORDER_PROTOCOL_FIELD_TYPE_NEW = "new";
OrderComm.ORDER_PROTOCOL_FIELD_TYPE_MODIFY = "modify";
OrderComm.ORDER_PROTOCOL_FIELD_TYPE_CANCEL = "cancel";
OrderComm.ORDER_PROTOCOL_FIELD_REGISTERED_STATUS = "registeredStatus";
OrderComm.ORDER_PROTOCOL_FIELD_REGISTERED_STATUS_SUCCESS = "success";
OrderComm.ORDER_PROTOCOL_FIELD_REGISTERED_STATUS_FAIL = "fail";
OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_STATUS = "signedStatus";
OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_STATUS_PARTIAL = "partial";
OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_STATUS_COMPLETED = "completed";
OrderComm.ORDER_PROTOCOL_FIELD_RESULT_MSG_TYPE = "resultMsgType";
OrderComm.ORDER_PROTOCOL_FIELD_RESULT_MSG_TYPE_REGISTER = "register";
OrderComm.ORDER_PROTOCOL_FIELD_RESULT_MSG_TYPE_SIGN = "sign";
OrderComm.ORDER_PROTOCOL_FIELD_RESULT_MSG_TYPE_REGISTER_RESULT = "registerResult";
OrderComm.ORDER_PROTOCOL_FIELD_GOODS_CODE = "goodsCode";
OrderComm.ORDER_PROTOCOL_FIELD_LONG_OR_SHORT = "longOrShort";
OrderComm.ORDER_PROTOCOL_FIELD_PRICE = "price";
OrderComm.ORDER_PROTOCOL_FIELD_QUANTITY = "quantity";
OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_PRICE = "signedPrice";
OrderComm.ORDER_PROTOCOL_FIELD_SIGNED_QUANTITY = "signedQuantity";
OrderComm.ORDER_PROTOCOL_FIELD_ORDER_NO = "orderNo";
OrderComm.ORDER_PROTOCOL_FIELD_ORG_ORDER_NO = "orgOrderNo";
OrderComm.ORDER_PROTOCOL_FIELD_INTERNAL_ORDER_ID = "internalOrderId";
OrderComm.ORDER_PROTOCOL_FIELD_CLIENT_ORDER_ID = "clientOrderId";
OrderComm.HDR_LEN = 4;

OrderComm.INFO_PROTOCOL_FIELD_TYPE = "type";
OrderComm.INFO_PROTOCOL_FIELD_TYPE_REGISTER_REAL = "registerReal";
OrderComm.INFO_PROTOCOL_FIELD_TYPE_GET_CUR_INFO = "getCurInfo";
OrderComm.INFO_PROTOCOL_FIELD_TYPE_UNREGISTER_REAL = "unregisterReal";
OrderComm.INFO_PROTOCOL_FIELD_GOODS_CODES = "goodsCodes";
OrderComm.INFO_PROTOCOL_FIELD_RESULT_MSG_TYPE_REGISTER_RESULT = "registerResult";
OrderComm.INFO_PROTOCOL_FIELD_REGISTERED_SUCCESS = "success";
OrderComm.INFO_PROTOCOL_FIELD_REGISTERED_FAIL = "fail";

module.exports = OrderComm;
module.exports.OrderInfo = OrderInfo;
module.exports.SignInfo = SignInfo;
