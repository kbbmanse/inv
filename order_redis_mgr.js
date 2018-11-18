const os = require("os");
const util = require("util");
const redis = require("redis");
require("date-utils")

var CommRedis = function(redisServerAddr, redisServerPort, tradingCB, optMonIdx = 0, futMonIdx = 0) {
    var client_ = redis.createClient(redisServerPort, redisServerAddr);
    var subGoodsInfo_; 
    var fcode_;
    var fieldMap_ = {};
    fieldMap_["price"] = 2;
    fieldMap_["open"] =  2;
    fieldMap_["high"] =  2;
    fieldMap_["low"] =  2;
    fieldMap_["offerho1"] =  2;
    fieldMap_["bidho1"] =  2;
    fieldMap_["cpower"] =  2;
    fieldMap_["volume"] =  1;
    fieldMap_["offerrem1"] =  1;
    fieldMap_["bidrem1"] =  1;
    fieldMap_["offercnt1"] =  1;
    fieldMap_["bidcnt1"] =  1;
    fieldMap_["mdvolume"] =  1;
    fieldMap_["msvolume"] =  1;

    var board_ = {};
    var ymCode_;
    var ymCodeNext_;
    var isReady_ = false;
    var optMonIdx_ = optMonIdx;
    var futMonIdx_ = futMonIdx;
    const targetCodes_ = new Set();
    setInterval(function() { if (client_) client_.ping();}, 10000);
    
    board_["KOSPI200"] = {};
    targetCodes_.add("KOSPI200");

    client_.hgetall("GCS", function(err, obj) {
        const strJsonData = obj['GCS'];
        const jsonObj = JSON.parse(strJsonData);

        const fList = jsonObj['F'];
        const optMonthCP = jsonObj['O' + optMonIdx];
        var callCnt = 0;
        var doneCnt = 0;

        fcode_ = fList[futMonIdx_];
        optMonthCP["C"].push(fcode_);
        for (var i in optMonthCP) {
            for (var j in optMonthCP[i]) {
                const tok = optMonthCP[i][j];
                targetCodes_.add(tok);
                if (!ymCode_) {
                    ymCode_ = tok.slice(3, 5);	
                }

                (function(key){ 
                    callCnt++;
                    client_.hgetall(key, function(err, obj) {
                        board_[key] = {};
                        for (var pk in obj) {
                            var vtype = fieldMap_[pk];
                            if (!vtype) {
                                board_[key][pk] = obj[pk];
                            }
                            else {
                                if (vtype === 2) {
                                    board_[key][pk] = parseFloat(obj[pk]);
                                }
                                else if (vtype === 1) {
                                    board_[key][pk] = parseInt(obj[pk]);
                                }
                                else {
                                    board_[key][pk] = obj[pk];
                                }
                            }
                        }
                        doneCnt++;

                        if (callCnt === doneCnt) { 
                            console.log(callCnt, doneCnt);
                            isReady_ = true;
                        }
                    });
                })(tok);
            }
        }

        const optMonthCPNext = jsonObj['O' + (optMonIdx + 1)];
        for (var i in optMonthCPNext) {
            for (var j in optMonthCPNext[i]) {
                const tok = optMonthCPNext[i][j];
                targetCodes_.add(tok);
                if (!ymCodeNext_) {
                    ymCodeNext_ = tok.slice(3, 5);	
                }

                (function(key){ 
                    callCnt++;
                    client_.hgetall(key, function(err, obj) {
                        board_[key] = {};
                        for (var pk in obj) {
                            var vtype = fieldMap_[pk];
                            if (!vtype) {
                                board_[key][pk] = obj[pk];
                            }
                            else {
                                if (vtype === 2) {
                                    board_[key][pk] = parseFloat(obj[pk]);
                                }
                                else if (vtype === 1) {
                                    board_[key][pk] = parseInt(obj[pk]);
                                }
                                else {
                                    board_[key][pk] = obj[pk];
                                }
                            }
                        }
                        doneCnt++;

                        if (callCnt === doneCnt) { 
                            console.log(callCnt, doneCnt);
                            isReady_ = true;
                        }
                    });
                })(tok);
            }
        }

    });

    subGoodsInfo_ = redis.createClient(redisServerPort, redisServerAddr,{
        retry_strategy: function (options) {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                // End reconnecting on a specific error and flush all commands with
                // a individual error
                return new Error('The server refused the connection');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                // End reconnecting after a specific timeout and flush all commands
                // with a individual error
                return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
                // End reconnecting with built in error
                return undefined;
            }
            // reconnect after
            return Math.min(options.attempt * 100, 3000);
        }
    });

    subGoodsInfo_.on("message", function(channel, message) {
        if (isReady_) {
            if (channel === "FO_HOGA") {
                data  = JSON.parse(message);
                var gcode = data.optcode;
                if (!gcode)
                    gcode = data.futcode;
                if (targetCodes_.has(gcode)) {
                    board_[gcode]["bidho1"] = parseFloat(data.bidho1);
                    board_[gcode]["offerho1"] = parseFloat(data.offerho1);
                    board_[gcode]["bidrem1"] = parseInt(data.bidrem1);
                    board_[gcode]["offerrem1"] = parseInt(data.offerrem1);
                    board_[gcode]["totbidrem"] = parseInt(data.totbidrem);
                    board_[gcode]["totofferrem"] = parseInt(data.totofferrem);
                }
            }
            else if (channel === "FO_SISE") {
                data  = JSON.parse(message);
                var gcode = data.optcode;
                if (!gcode)
                    gcode = data.futcode;
                //console.log("S " + gcode);
                if (targetCodes_.has(gcode)) {
                    board_[gcode]["high"] = parseFloat(data.high);
                    board_[gcode]["low"] = parseFloat(data.low);
                    board_[gcode]["price"] = parseFloat(data.price);
                    board_[gcode]["open"] = parseFloat(data.open);
                    board_[gcode]["cpower"] = parseFloat(data.cpower);
                    board_[gcode]["mdvolume"] = parseInt(data.mdvolume);
                    board_[gcode]["msvolume"] = parseInt(data.msvolume);

                    if (fcode_ && gcode === fcode_) {
                        if (tradingCB) 
                            tradingCB(board_, fcode_, ymCode_);
                    }
                }
            }
            else if (channel === "KOSPI200") {
                data  = JSON.parse(message);
                board_['KOSPI200']["high"] = parseFloat(data.highjisu);
                board_['KOSPI200']["low"] = parseFloat(data.lowjisu);
                board_['KOSPI200']["price"] = parseFloat(data.jisu);
                board_['KOSPI200']["open"] = parseFloat(data.openjisu);
            }
        }
    });

    subGoodsInfo_.on("error", function(err) {
        console.log("Error: " + err);
    });

    subGoodsInfo_.on("reconnecting", function(info) {
        console.log("Reconnecting: " + info);
    });

    subGoodsInfo_.on("connect", function() {
        console.log("connected to the redis server.");
        subGoodsInfo_.subscribe("FO_SISE");
        subGoodsInfo_.subscribe("FO_HOGA");
        subGoodsInfo_.subscribe("KOSPI200");
    });

    return {
        isReady: function() { return isReady_;},
        getYmCode: function() { return ymCode_;},
        getYmCodeNext: function() { return ymCodeNext_;},
    };
};
module.exports = CommRedis;
