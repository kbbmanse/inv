const os = require("os");
const util = require("util");
const sqlite3 = require("sqlite3");
const OrderComm = require("./order_base.js");
const CommRedis = require("./order_redis_mgr.js");
const OrderStruct = require("./order_struct_mod.js");
const CompositeOrderRequest = OrderStruct.CompositeOrderRequest;
const CompositeCoveredOrderRequest = OrderStruct.CompositeCoveredOrderRequest;
const PositionInfo = OrderStruct.PositionInfo;
const OrderRequestMgr = require("./order_request_mgr.js").OrderRequestMgr;
const Config = require("./config.js");
require("date-utils")

var DbFilePath = "./history.db";
var FCode;
var Board;
var YmCode;
var YmCodeNext;
var PositionMap = new Map();
var CurNewOrderRequestInfo = null;
var CurEnterCnt = 0;
var CurDate;
var CurDateStr;
var CurDateYMDStr;
var BaseJisuDir = null;
var FMidBase = 0.0;
var FMidPrev = 0.0;
var FMidArray = new Array();

var OrderUnit = 1;
var OptMonIdx = 0;
var FutMonIdx = 0;
var MaxEnterCnt = 1;
var OrderRequestDir = "U";
var IsLongPeriod = false;
var CloseHour = 15;
var CloseMin = 32;
var CloseSec = 0;
var Day20Dir = "U";
var LastDayStr;
var LastDayK200 = 10000.0;
var LastDayFuture = 10000.0;
var IsChangeLastDay = false;

console.log(util.format("Usage: node %s OrderUnit CloseHour CloseMin CloseSec", process.argv[1]));
console.log(util.format("ex: node %s %d %d %d %d",
            process.argv[1], OrderUnit, CloseHour, CloseMin, CloseSec));

if (process.argv.length >= 3) 
    OrderUnit = parseInt(process.argv[2]);

if (process.argv.length >= 4) 
    CloseHour = parseInt(process.argv[3]);

if (process.argv.length >= 5) 
    CloseMin = parseInt(process.argv[4]);

if (process.argv.length >= 6) 
    CloseSec = parseInt(process.argv[5]);

const orderComm = new OrderComm(Config["comm_port"]);
const orderRequestMgr = new OrderRequestMgr(orderComm);
const commRedis = new CommRedis(Config["redis_host"], Config["redis_port"], trading, OptMonIdx, FutMonIdx);

const HistoryDb = new sqlite3.Database(DbFilePath, sqlite3.OPEN_READWRITE, function(error) {

    this.get("select * from latest_goods_info_tbl where goods_code='last_day' and date='last_day';", [], (err, row)=> {
        LastDayStr = row.price;
        console.log("LastDay:", LastDayStr);
        this.get("select * from latest_goods_info_tbl where goods_code='KOSPI200' and date=?;", [LastDayStr], (err, row)=> {
            LastDayK200 = parseFloat(row.price);
            console.log("LastDayK200:", LastDayK200);
        });

        this.get("select * from latest_goods_info_tbl where goods_code='FUTURE' and date=?;", [LastDayStr], (err, row)=> {
            LastDayFuture = parseFloat(row.price);
            console.log("LastDayFuture:", LastDayFuture);
        });
    });

    this.get("select * from latest_goods_info_tbl where goods_code='day_20_dir';", [], (err, row)=> {
        Day20Dir = row.price;
        console.log("Day20Dir:", Day20Dir);
    });

    this.each("select * from c_positions_tbl order by idx;", function(err, row) {
        var position_info = new PositionInfo(parseFloat(row["base_jisu"]).toFixed(2), row["gcode"], row["lors"], 
				parseFloat(row["price"]).toFixed(2), row["quantity"], null, row["pair_id"], row["init_jisu"].toFixed(2));
        position_info.setId(row["idx"]);
        PositionMap[position_info.getId()] = position_info;

		var pair_id = row["pair_id"];
        if (pair_id !== undefined) {
            position_info.setPairId(pair_id);
        }

        if (position_info.getId() + 1 > PositionInfo.positionIdSeq_) 
            PositionInfo.positionIdSeq_ = position_info.getId() + 1;

        var insertedDate = row["inserted_date"];
        position_info.setInsertedDate(insertedDate);

        position_info.setPayoffTargetJisu(payoffTargetJisu);
        var payoffTargetJisu = row["payoff_target_jisu"];
        position_info.setPayoffTargetJisu(payoffTargetJisu);

		var losscutTargetJisu = row["losscut_target_jisu"];
        position_info.setLosscutTargetJisu(losscutTargetJisu);

		var dir = row["order_request_dir"];
        if (!dir) {
            position_info.setDir(OrderRequestDir);
        }
        else {
            position_info.setDir(dir);
        }

        var order_request_id = row["order_request_id"];
        if (order_request_id === null || order_request_id === undefined) {
            var orid = CompositeOrderRequest.orderRequestInfoIdSeq_++;
            position_info.setOrderRequestInfoId(orid);
        }
        else {
            if (CompositeOrderRequest.orderRequestInfoIdSeq_ <= order_request_id)
                CompositeOrderRequest.orderRequestInfoIdSeq_ = order_request_id + 1;
            position_info.setOrderRequestInfoId(order_request_id);
        }

        var long_period = row["long_period"];
        if (long_period !== null && long_period !== undefined && long_period !== 1) {
            position_info.setLongPeriod(false);
        }

        console.log("HistoryDb. 저장된 포지션정보: ", position_info.toString());
    });
});

function trading(board, fCode, yMCode) {
    if (fCode && !FCode) {
        FCode = fCode;
        YmCode = yMCode;
        Board = board;
        YmCodeNext = commRedis.getYmCodeNext();
    }

    if (commRedis.isReady()) {
        const fitem = Board[FCode];
        const kitem = Board["KOSPI200"];
        const base_jisu = fitem.price;

        doPayoffJob(fitem, base_jisu, BaseJisuDir);
        doNewEnterJob(fitem, kitem, base_jisu, BaseJisuDir);
    }
}

function getLeadingZeroStr(data, fixedCnt) {
    var zero = '';
    data = data.toString();

    if (data.length < fixedCnt) {
        for (i = 0; i < fixedCnt - data.length; i++)
            zero += '0';
    }
    return zero + data;
}

function processNewOrder(orderReqInfo, baseJisuDir) {
    if (!baseJisuDir || !orderReqInfo)
        return;

    if (orderReqInfo.isAbleToOrderAll() !== true)
        return;

    const base_jisu = orderReqInfo.getBaseJisu();
    const item_code_0 = orderReqInfo.getGoodsCode(0, 0);
    const item_code_1 = orderReqInfo.getGoodsCode(0, 1);
    const item_code_2 = orderReqInfo.getGoodsCode(1);
    const item_lors_0 = orderReqInfo.getLongOrShort(0, 0);
    const item_lors_1 = orderReqInfo.getLongOrShort(0, 1);
    const item_lors_2 = orderReqInfo.getLongOrShort(1);
    const item_0 = Board[item_code_0];
    const item_1 = Board[item_code_1];
    const item_2 = Board[item_code_2];

    var order_cnt = orderReqInfo.canOrderCnt(0, 0);
    if (orderReqInfo.canOrderCnt(0, 1) < order_cnt)
        order_cnt = orderReqInfo.canOrderCnt(0, 1);
    if (orderReqInfo.canOrderCnt(1) < order_cnt)
        order_cnt = orderReqInfo.canOrderCnt(1);

    if (item_lors_0 === "L") {
        if (item_0.offerrem1 < order_cnt)
            order_cnt = item_0.offerrem1;
    }
    else {
        if (item_0.bidrem1 < order_cnt)
            order_cnt = item_0.bidrem1;
    }

    if (item_lors_1 === "L") {
        if (item_1.offerrem1 < order_cnt)
            order_cnt = item_1.offerrem1;
    }
    else {
        if (item_1.bidrem1 < order_cnt)
            order_cnt = item_1.bidrem1;
    }

    if (item_lors_2 === "L") {
        if (item_2.offerrem1 < order_cnt)
            order_cnt = item_2.offerrem1;
    }
    else {
        if (item_2.bidrem1 < order_cnt)
            order_cnt = item_2.bidrem1;
    }

    if (order_cnt < 1) 
        return;

    if (baseJisuDir === "U") {
        if (item_lors_0 === "L") 
            enterNewOrder(orderReqInfo, base_jisu, 0, 0, item_0, item_code_0, item_lors_0, 0, 1, item_1, item_code_1, item_lors_1, 1, 0, item_2, item_code_2, item_lors_2, order_cnt);
        else
            enterNewOrder(orderReqInfo, base_jisu, 1, 0, item_2, item_code_2, item_lors_2, 0, 1, item_1, item_code_1, item_lors_1, 0, 0, item_0, item_code_0, item_lors_0, order_cnt);
    }
    else {
        if (item_lors_0 === "L") 
            enterNewOrder(orderReqInfo, base_jisu, 1, 0, item_2, item_code_2, item_lors_2, 0, 1, item_1, item_code_1, item_lors_1, 0, 0, item_0, item_code_0, item_lors_0, order_cnt);
        else
            enterNewOrder(orderReqInfo, base_jisu, 0, 0, item_0, item_code_0, item_lors_0, 0, 1, item_1, item_code_1, item_lors_1, 1, 0, item_2, item_code_2, item_lors_2, order_cnt);
    }
}

const setPositionInfo = function(orderReqInfo, curBaseJisu, positionInfo, isLongPeriod, isNewEnter) {
    positionInfo.setPayoffTargetJisu(0);
    positionInfo.setLosscutTargetJisu(0);
    positionInfo.setDir(orderReqInfo.getDir());
   
    positionInfo.setLongPeriod(isLongPeriod);
    positionInfo.setNewEnter(isNewEnter);
    positionInfo.setOrderInfo(null);
    positionInfo.setInsertedDate(CurDateStr);
    HistoryDb.run("insert into c_positions_tbl values (?,?,?,?,?,?,?,?,?,?,?,?,?,?);",
        [positionInfo.getId(), positionInfo.getGoodsCode(), positionInfo.getLongOrShort(), positionInfo.getPrice(), positionInfo.getQuantity(),
            positionInfo.getBaseJisu(), positionInfo.getBaseJisu(), positionInfo.getPayoffTargetJisu(), positionInfo.getLosscutTargetJisu(),
            null, orderReqInfo.getDir(), orderReqInfo.getId(), CurDateStr, positionInfo.isLongPeriod()?1:0]);
    HistoryDb.run("insert into c_positions_history_tbl values (NULL,?,?,?,?,?,?,?,?,?);", [CurDateStr, 'E', positionInfo.getGoodsCode(),
        positionInfo.getLongOrShort(), positionInfo.getPrice(), positionInfo.getQuantity(), positionInfo.getBaseJisu(), null, null]);
    console.log(util.format("setPositionInfo.cb. 포지션 체결- PID:%d, 진입지수:%s, 코드:%s, %s, %s, %d", positionInfo.getId(), parseFloat(positionInfo.getBaseJisu()).toFixed(2),
        positionInfo.getGoodsCode(), positionInfo.getLongOrShort(), parseFloat(positionInfo.getPrice()).toFixed(2), positionInfo.getQuantity()));
    PositionMap[positionInfo.getId()] = positionInfo;
};

async function createNewOrderRequest(orderReqInfo, curBaseJisu, posIdx, posSubIdx, item, itemCode, lors, orderCnt, posPair, isNewEnter) {
    var order_price;
    // 해당 지수 호가 남은 카운트에서 주문 하는 양을 빼준다. 다음 호가 정보가 오기전까지는 내부적으로 더 정확하게 유지하기 위함 
    if (lors === "S") {
        item.bidrem1 -= orderCnt;
        order_price = item.bidho1;
    }
    else {
        item.offerrem1 -= orderCnt;
        order_price = item.offerho1;
    }
    const position_info = await orderRequestMgr.createOrderRequestPromise(curBaseJisu, item, itemCode, lors, order_price, orderCnt);
    orderReqInfo.incSigned(posIdx, position_info.getPrice(), orderCnt, posSubIdx);
    orderReqInfo.resetOrderedCnt(posIdx, posSubIdx);
    setPositionInfo(orderReqInfo, curBaseJisu, position_info, IsLongPeriod, isNewEnter);
    posPair[("" + posIdx) + ("" + posSubIdx)] = position_info;
}

async function enterNewOrder(orderReqInfo, curBaseJisu, idx0, sidx0, item0, itemCode0, lors0, idx1, sidx1, item1, itemCode1, lors1, idx2, sidx2, item2, itemCode2, lors2, orderCnt) {
    const posPair = {};
    orderReqInfo.setOrderedCnt(0, orderCnt, 0);
    orderReqInfo.setOrderedCnt(0, orderCnt, 1);
    orderReqInfo.setOrderedCnt(1, orderCnt);
    await createNewOrderRequest(orderReqInfo, curBaseJisu, idx0, sidx0, item0, itemCode0, lors0, orderCnt, posPair, CurNewOrderRequestInfo === orderReqInfo);
    await createNewOrderRequest(orderReqInfo, curBaseJisu, idx1, sidx1, item1, itemCode1, lors1, orderCnt, posPair, CurNewOrderRequestInfo === orderReqInfo);
    await createNewOrderRequest(orderReqInfo, curBaseJisu, idx2, sidx2, item2, itemCode2, lors2, orderCnt, posPair, CurNewOrderRequestInfo === orderReqInfo);
    const pos_0 = posPair[("" + idx0) + ("" + sidx0)];
    const pos_1 = posPair[("" + idx1) + ("" + sidx1)];
    const pos_2 = posPair[("" + idx2) + ("" + sidx2)];

    if (pos_0 || pos_1 || pos_2) {
        const pair_id = orderReqInfo.addPositionInfoPair(pos_0, pos_1, pos_2);
        if (pos_0) {
            HistoryDb.run("update c_positions_tbl set pair_id=? where idx=?;", [pair_id, pos_0.getId()]);
            pos_0.setPairId(pair_id);
        }
        if (pos_1) {
            HistoryDb.run("update c_positions_tbl set pair_id=? where idx=?;", [pair_id, pos_1.getId()]);
            pos_1.setPairId(pair_id);
        }
        if (pos_2) {
            HistoryDb.run("update c_positions_tbl set pair_id=? where idx=?;", [pair_id, pos_2.getId()]);
            pos_2.setPairId(pair_id);
        }
    }
    
    if (orderReqInfo.isCompletedAll()) {
        const position_info_pairs = orderReqInfo.getPositionInfoPairs();
        console.log(util.format("enterNewOrder. 진입 주문 체결 완료- ORID:%d, F_C:%s, %s, %s, %d, F_P:%s, %s, %s, %d, CVD:%s, %s, %s, %d, 부분체결된 포지션쌍 카운트:%d",
            orderReqInfo.getId(),
            orderReqInfo.getGoodsCode(0, 0), orderReqInfo.getLongOrShort(0, 0), parseFloat(orderReqInfo.getPrice(0, 0)).toFixed(2), orderReqInfo.getQuantity(0, 0),
            orderReqInfo.getGoodsCode(0, 1), orderReqInfo.getLongOrShort(0, 1), parseFloat(orderReqInfo.getPrice(0, 1)).toFixed(2), orderReqInfo.getQuantity(0, 1),
            orderReqInfo.getGoodsCode(1), orderReqInfo.getLongOrShort(1), parseFloat(orderReqInfo.getPrice(1)).toFixed(2), orderReqInfo.getQuantity(1),
            position_info_pairs.length));

        if (CurNewOrderRequestInfo && CurNewOrderRequestInfo === orderReqInfo) 
            CurNewOrderRequestInfo = null;
    }
    else 
        trading(Board, FCode, YmCode);
}

function doNewEnterJob(fitem, kitem, curBaseJisu, curBaseJisuDir) {
    const composite_info = getTargetItemsInfoByDir(fitem, kitem);
    if (!composite_info)
        return;
    // 만약 이미 주문이 들어가 있다면 바로 리턴
    if (CurNewOrderRequestInfo) {
        processNewOrder(CurNewOrderRequestInfo, curBaseJisuDir);
        return;
    }
    // 신규 진입 조건 확인 및 처리 
    if (!CurNewOrderRequestInfo && CurEnterCnt < MaxEnterCnt) {
        const str_base_jisu = curBaseJisu.toFixed(2);
        console.log(util.format("doNewEnterJob. 포지션 신규 진입- 진입지수:%s, F_C:%s, %s, %s, F_P:%s, %s, %s, CVD:%s, %s, %s, 주문수량:%d", 
                    str_base_jisu, 
                    composite_info.goods0.getGoodsCode(), composite_info.goods0.getLongOrShort(), parseFloat(composite_info.goods0.getPrice()).toFixed(2),
                    composite_info.goods1.getGoodsCode(), composite_info.goods1.getLongOrShort(), parseFloat(composite_info.goods1.getPrice()).toFixed(2), 
                    composite_info.goods2.getGoodsCode(), composite_info.goods2.getLongOrShort(), parseFloat(composite_info.goods2.getPrice()).toFixed(2), 
                    OrderUnit));

        // 신규 주문을 생성한다. 
        CurNewOrderRequestInfo = new CompositeCoveredOrderRequest(curBaseJisu, composite_info.getFutureLongOrShort(), 
            composite_info.goods0.getGoodsCode(), composite_info.goods0.getPrice(), composite_info.goods0.getQuantity(), 
            composite_info.goods1.getGoodsCode(), composite_info.goods1.getPrice(), composite_info.goods1.getQuantity(), 
            composite_info.goods2.getLongOrShort(), composite_info.goods2.getGoodsType(), 
            composite_info.goods2.getGoodsCode(), composite_info.goods2.getPrice(), composite_info.goods2.getQuantity(), 
            null, composite_info.getOrderRequestDir(), composite_info.IsLongPeriod());
        // 생성한 주문을 처리한다. 
        processNewOrder(CurNewOrderRequestInfo, curBaseJisuDir);

        ++CurEnterCnt;
    }
}

function getMovingAvg(fitem) {
    let f_mid_cur = (fitem.bidho1 + fitem.offerho1) * 0.5;//중간값 계산
    if (FMidPrev === 0.0) {
        FMidPrev = f_mid_cur;
    }

    FMidBase = 0.8 * f_mid_cur + 0.2 * FMidPrev;// 인터폴레이션
    FMidArray.push(FMidBase);
    FMidPrev = f_mid_cur;

    if (FMidArray.length > 5) // 5이동평균을 유지하기 위해 
        FMidArray.shift();

    var f_mid_sum = 0.0;
    for (var fidx = 0; fidx < FMidArray.length; ++fidx) {
        f_mid_sum += FMidArray[fidx];
    }
    // 이동 평균 구함
    return f_mid_sum / FMidArray.length;
}

function decideBaseJisuDir(fAvg) {
    if (fAvg <= FMidBase) // 이동 평균보다 크거나 같으면 up
        return 1;
    else // 이동 평균보다 작으면 down
        return -1;
}

function getTargetActPrice(fitem) {
    var trg_act_price = fitem.price / 2.5;
    if (trg_act_price - parseInt(trg_act_price) >= 0.5) 
        trg_act_price = (parseInt(trg_act_price) + 1) * 2.5;
    else 
        trg_act_price = (parseInt(trg_act_price)) * 2.5;

    return trg_act_price;
}

function getTargetItemsInfoByDir(fitem, kitem) {
    if (!CurDate)
        return null;
    if (CurDate.getHours() < CloseHour)
        return null;
    if (CurDate.getHours() === CloseHour && CurDate.getMinutes() < CloseMin)
        return null;
    if (CurDate.getHours() === CloseHour && CurDate.getMinutes() === CloseMin && CurDate.getSeconds() < CloseSec)
        return null;
    if (Day20Dir === "D" && fitem.price <= LastDayFuture)
        return null;
    var item_0_code, item_1_code, item_2_code, item_0, item_1, item_2;

    var trg_act_price = getTargetActPrice(fitem);
    var trg_act_price_int = parseInt(trg_act_price);
    var trg_act_price_U1 = parseInt(trg_act_price + 2.5);
    var trg_act_price_D1 = parseInt(trg_act_price - 2.5);
    var item_0_type = "C", item_1_type = "P", item_2_type = "C";

    item_0_code = "201" + YmCode + getLeadingZeroStr(trg_act_price_int, 3);
    item_1_code = "301" + YmCode + getLeadingZeroStr(trg_act_price_int, 3);
    if (OrderRequestDir === "U") 
        item_2_code = "201" + YmCode + getLeadingZeroStr(trg_act_price_U1, 3);
    else {
        item_2_code = "301" + YmCode + getLeadingZeroStr(trg_act_price_D1, 3);
        item_2_type = "P";
    }

    item_0 = Board[item_0_code];
    item_1 = Board[item_1_code];
    item_2 = Board[item_2_code];

    if (item_2.price < 1.4) {
        if (OrderRequestDir === "U") 
            item_2_code = "201" + YmCodeNext + getLeadingZeroStr(trg_act_price_U1, 3);
        else 
            item_2_code = "301" + YmCodeNext + getLeadingZeroStr(trg_act_price_D1, 3);
        
        item_2 = Board[item_2_code];
    }
        
    if (OrderRequestDir === "U") {
        return {
            "goods0": {
                "getGoodsType": function(){ return item_0_type;},
                "getGoodsCode": function(){ return item_0_code;},
                "getLongOrShort": function(){ return "L";},
                "getPrice": function(){ return item_0.price;},
                "getQuantity": function(){ return OrderUnit;},
                "getItem": function(){ return item_0;},
            },
            "goods1": {
                "getGoodsType": function(){ return item_1_type;},
                "getGoodsCode": function(){ return item_1_code;},
                "getLongOrShort": function(){ return "S";},
                "getPrice": function(){ return item_1.price;},
                "getQuantity": function(){ return OrderUnit;},
                "getItem": function(){ return item_1;},
            },
            "goods2": {
                "getGoodsType": function(){ return item_2_type;},
                "getGoodsCode": function(){ return item_2_code;},
                "getLongOrShort": function(){ return "S";},
                "getPrice": function(){ return item_2.price;},
                "getQuantity": function(){ return OrderUnit;},
                "getItem": function(){ return item_2;},
            },
            "getOrderRequestDir": function(){ return "U";},
            "getFutureLongOrShort": function(){ return "L";},
            "IsLongPeriod": function(){ return IsLongPeriod;},
        };
    }
    else {
        return {
            "goods0": {
                "getGoodsType": function(){ return item_0_type;},
                "getGoodsCode": function(){ return item_0_code;},
                "getLongOrShort": function(){ return "S";},
                "getPrice": function(){ return item_0.price;},
                "getQuantity": function(){ return OrderUnit;},
                "getItem": function(){ return item_0;},
            },
            "goods1": {
                "getGoodsType": function(){ return item_1_type;},
                "getGoodsCode": function(){ return item_1_code;},
                "getLongOrShort": function(){ return "L";},
                "getPrice": function(){ return item_1.price;},
                "getQuantity": function(){ return OrderUnit;},
                "getItem": function(){ return item_1;},
            },
            "goods2": {
                "getGoodsType": function(){ return item_2_type;},
                "getGoodsCode": function(){ return item_2_code;},
                "getLongOrShort": function(){ return "S";},
                "getPrice": function(){ return item_2.price;},
                "getQuantity": function(){ return OrderUnit;},
                "getItem": function(){ return item_2;},
            },
            "getOrderRequestDir": function(){ return "D";},
            "getFutureLongOrShort": function(){ return "S";},
            "IsLongPeriod": function(){ return IsLongPeriod;},
        };
    }
}

function doLogic() {
    if (!commRedis.isReady() || Board === undefined) 
        return;

    CurDate = new Date();
    CurDateStr = CurDate.toFormat('YYYY-MM-DD HH24:MI:SS');
    CurDateYMDStr = (CurDateStr.split(" "))[0];
    const fitem = Board[FCode];
    const kitem = Board["KOSPI200"];

    if (!fitem || !kitem)
        return;
    // 이동 평균 구함
    const f_avg = getMovingAvg(fitem);
    // 현재 지수 추세 방향 결정
    BaseJisuDir = decideBaseJisuDir(f_avg);
    console.log(util.format("doLogic. %s - dir: %d, F-c:%s, o:%s, h:%s, l:%s, K-c:%s, o:%s, h:%s, l:%s",
            (new Date()).toLocaleTimeString(), BaseJisuDir, parseFloat(fitem.price).toFixed(2),parseFloat(fitem.open).toFixed(2),parseFloat(fitem.high).toFixed(2),parseFloat(fitem.low).toFixed(2),
            parseFloat(kitem.price).toFixed(2),parseFloat(kitem.open).toFixed(2),parseFloat(kitem.high).toFixed(2),parseFloat(kitem.low).toFixed(2)));
    trading(Board, FCode, YmCode);
   
    if (CurDate.getHours() > 15) {
        if (IsChangeLastDay === false) {
            HistoryDb.run("REPLACE INTO latest_goods_info_tbl(goods_code, date, price) VALUES('last_day', 'last_day', ?);", [CurDateYMDStr]);
            IsChangeLastDay = true;
        }
        return;
    }
    if (CurDate.getHours() === 15 && CurDate.getMinutes() > 45) {
        if (IsChangeLastDay === false) {
            HistoryDb.run("REPLACE INTO latest_goods_info_tbl(goods_code, date, price) VALUES('last_day', 'last_day', ?);", [CurDateYMDStr]);
            IsChangeLastDay = true;
        }
        return;
    }
    if (CurDate.getHours() === 15 && CurDate.getMinutes() === 45 && CurDate.getSeconds() > 10) {
        if (IsChangeLastDay === false) {
            HistoryDb.run("REPLACE INTO latest_goods_info_tbl(goods_code, date, price) VALUES('last_day', 'last_day', ?);", [CurDateYMDStr]);
            IsChangeLastDay = true;
        }
        return;
    }

    if (CurDate.getSeconds() === 5)
        UpdateLatestGoodsInfos();
}

function UpdateLatestGoodsInfos() {
    let query = "REPLACE INTO latest_goods_info_tbl(goods_code, date, price, open, high, low) VALUES(?, ?, ?, ?, ?, ?);";
    for (let k in Board) {
        let item = Board[k];
        HistoryDb.run(query, [k, CurDateYMDStr, parseFloat(item.price).toFixed(2), parseFloat(item.open).toFixed(2), parseFloat(item.high).toFixed(2), parseFloat(item.low).toFixed(2)]);
        if (k === FCode)
            HistoryDb.run(query, ['FUTURE', CurDateYMDStr, parseFloat(item.price).toFixed(2), parseFloat(item.open).toFixed(2), parseFloat(item.high).toFixed(2), parseFloat(item.low).toFixed(2)]);
    }
}

function doPayoffJob(fitem, curBaseJisu, curBaseJisuDir) {
    if (!curBaseJisu || !curBaseJisuDir)
        return;

    // 신규 청산 주문을 찾기위해 조건 검색을 한다.
    for (var key in PositionMap) {
        const position_info = PositionMap[key];
        if (!position_info || position_info.isProcessing())
            continue;
        const inserted_date_ymd = position_info.getInsertedDateYMD();
        if (!inserted_date_ymd || inserted_date_ymd === CurDateYMDStr)
            continue;

        let is_process = false;
        if (position_info.getDir() === "U") {// 상방포지션 처리
            if (position_info.isLongPeriod()) {
                if (position_info.getPayoffTargetJisu() && position_info.getPayoffTargetJisu() <= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.U.LPeriod.payoffTargetJisu: %d, %s",
                                position_info.getPayoffTargetJisu(), position_info.toString()));
                else if (position_info.getLosscutTargetJisu() && position_info.getLosscutTargetJisu() >= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.U.LPeriod.losscutTargetJisu: %d, %s",
                                position_info.getLosscutTargetJisu(), position_info.toString()));
            }
            else 
                is_process = true;
        }
        else {// 하방 포지션 처리
            if (position_info.isLongPeriod()) {
                if (position_info.getPayoffTargetJisu() && position_info.getPayoffTargetJisu() >= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.D.LPeriod.payoffTargetJisu: %d, %s",
                                position_info.getPayoffTargetJisu(), position_info.toString()));
                else if (position_info.getLosscutTargetJisu() && position_info.getLosscutTargetJisu() <= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.D.LPeriod.losscutTargetJisu: %d, %s",
                                position_info.getLosscutTargetJisu(), position_info.toString()));
            }
            else 
                is_process = true;
        }

        if (is_process)
            processPayoff(curBaseJisu, curBaseJisuDir, position_info);
    }
}

function doPostPayoff(positionInfo, positionInfoPayoff, goodsCode, lors, payoffLors, orderPrice, orderCnt, orgBaseJisuStr, curBaseJisuStr) {
    if (positionInfoPayoff) {
        let remain_cnt = positionInfo.getQuantity() - orderCnt;

        console.log(util.format("doPostPayoff. positionInfo: %s, positionInfoPayoff: %s, remain: %d", positionInfo.toString(), positionInfoPayoff.toString(), remain_cnt));
        if (remain_cnt) {// 해당 포지션이 완전히 청산되지 않았을경우
            positionInfo.setQuantity(remain_cnt);
            HistoryDb.run("update c_positions_tbl set quantity=? where idx=?;", [remain_cnt, positionInfo.getId()]);
            orderRequestMgr.deletePositionInfo(positionInfoPayoff.getId());
            console.log(util.format("doPostPayoff. 포지션 부분 청산 - ORG_ID:%d BJ:%s 코드:%s LS:%s 매입가:%s 수량:%d | BJ:%s 청산가:%s LS:%s 청산수량:%d",
                        positionInfo.getId(), orgBaseJisuStr,
                        goodsCode, lors, parseFloat(positionInfo.getPrice()).toFixed(2), positionInfo.getQuantity(),
                        curBaseJisuStr, parseFloat(orderPrice).toFixed(2), payoffLors, orderCnt));
        }
        else {// 완전히 청산된 경우
            HistoryDb.run("delete from c_positions_tbl where idx=?;", [positionInfo.getId()]);// 원래 포지션 정보 디비에서 삭제
            let pl;
            if (lors === "L")
                pl = (positionInfoPayoff.getPrice() - positionInfo.getPrice()) * positionInfo.getQuantity();
            else
                pl = (positionInfo.getPrice() - positionInfoPayoff.getPrice()) * positionInfo.getQuantity();

            HistoryDb.run("insert into c_positions_history_tbl values (NULL,?,?,?,?,?,?,?,?,?);",
                    [CurDateStr, 'P', goodsCode, payoffLors, positionInfo.getPrice(), positionInfo.getQuantity(), positionInfo.getBaseJisu(), positionInfoPayoff.getPrice(), pl]);
            PositionMap.delete(positionInfo.getId());
            orderRequestMgr.deletePositionInfo(positionInfoPayoff.getId());
            console.log(util.format("doPostPayoff. 포지션 청산 완료 - ORG_ID:%d BJ:%s 코드:%s LS:%s 매입가:%s 수량:%d | BJ:%s 청산가:%s LS:%s 청산수량:%d",
                        positionInfo.getId(), orgBaseJisuStr,
                        goodsCode, lors, parseFloat(positionInfo.getPrice()).toFixed(2), positionInfo.getQuantity(),
                        curBaseJisuStr, parseFloat(orderPrice).toFixed(2), payoffLors, orderCnt));
            return false;
        }
    }
    return true;
}

async function processPayoff(curBaseJisu, curBaseJisuDir, positionInfo) {
    if (!curBaseJisu || !curBaseJisuDir)
        return;

    const goods_code = positionInfo.getGoodsCode();
    const item = Board[goods_code];
    const lors = positionInfo.getLongOrShort();
    const cur_base_jisu_str = parseFloat(curBaseJisuDir).toFixed(2);
    const org_base_jisu_str = parseFloat(positionInfo.getBaseJisu()).toFixed(2);
    var order_cnt = positionInfo.getQuantity(), order_price, payoff_lors;
    
    if (lors === "S") {
        payoff_lors = "L";
        if (item.offerrem1 < order_cnt)
            order_cnt = item.offerrem1;
        item.offerrem1 -= order_cnt;
        order_price = item.offerho1;
    }
    else {
        payoff_lors = "S";
        if (item.bidrem1 < order_cnt)
            order_cnt = item.bidrem1;
        item.bidrem1 -= order_cnt;
        order_price = item.bidho1;
    }

    if (order_cnt < 1) 
        return;
    
    positionInfo.setProcessing(true);

    console.log(util.format("processPayoff. 포지션 청산 주문 - ORG_ID:%d BJ:%s 코드:%s LS:%s 매입가:%s 수량:%d | BJ:%s 청산가:%s LS:%s 청산수량:%d",
        positionInfo.getId(), org_base_jisu_str,
        goods_code, lors, parseFloat(positionInfo.getPrice()).toFixed(2), positionInfo.getQuantity(), 
        cur_base_jisu_str, parseFloat(order_price).toFixed(2), payoff_lors, order_cnt));
    // 가지고 있는 포지션과 반대로 주문한다.
    var position_info_payoff = null;
    var is_change_processing = true;
    try {
        position_info_payoff = await orderRequestMgr.createOrderRequestPromise(curBaseJisu, item, goods_code, payoff_lors, order_price, order_cnt);
        is_change_processing = doPostPayoff(positionInfo, position_info_payoff, goods_code, lors, payoff_lors, order_price, order_cnt, org_base_jisu_str, cur_base_jisu_str);
    }
    catch(e) {
        console.log(e);
    }

    if (!position_info_payoff)
        console.log("failed to invoke orderRequestMgr.createOrderRequestPromise(", curBaseJisu, item, goods_code, payoff_lors, 0, order_cnt, ")");
    else 
        console.log(util.format("processPayoff. position_info_payoff : %s", position_info_payoff.toString()));

    if (is_change_processing)
        positionInfo.setProcessing(false);
}

// 여기가 메인 함수
setTimeout(function() {
    console.log("Initialized.");

    setTimeout(function() { 
        setInterval(doLogic, 1000);
    }, 2000);
}, 3000);


