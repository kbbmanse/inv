const os = require("os");
const util = require("util");
const sqlite3 = require("sqlite3");
const OrderComm = require("./order_base.js");
const CommRedis = require("./order_redis_mgr.js");
const OrderStruct = require("./order_struct_mod.js");
const OrderRequestInfoLongShort = OrderStruct.OrderRequestInfoLongShort;
const PositionInfo = OrderStruct.PositionInfo;
const OrderRequestMgr = require("./order_request_mgr.js").OrderRequestMgr;
const Config = require("./config.js");
require("date-utils")

var DbFilePath = "./history.db";
var FCode;
var Board;
var YmCode;
var PositionMap = new Map();
var NewEnterOrderCntMap = new Map();
var CurNewOrderRequestInfo = null;
var HedgeNewOrderRequestInfo = null;
var CurEnterCnt = 0;
var TotalOrderedCnt = 0;
var FirstEnterBaseJisu;
var EnterTargetInfos = {};
var CurDate;
var CurDateStr;
var BaseJisuDir = null;
var FMidBase = 0.0;
var FMidPrev = 0.0;
var FMidArray = new Array();

var OrderUnit = 1;
var EnterPointUnit = 1.25;
var PayoffPointUnit = 2.5;
var OrderMultiplier = 2;
var EnterMinProfit = 1.35
var EnterStartPrice;
var OrderTypeCOrP = "P";
var IsFixedOrderUnit = true;
var OptMonIdx = 0;
var FutMonIdx = 0;
var MaxEnterCnt = 4;
var OrderRequestDir = "U";
var IsLongPeriod = true;
var IsLongPeriodHedge = true;
var IsChangeStartPrice = true;

console.log(util.format("Usage: node %s OrderRequestDir OrderTypeCOrP IsLongPeriod OrderUnit EnterPointUnit PayoffPointUnit EnterMinProfit EnterStartPrice IsFixedOrderUnit MaxEnterCnt IsLongPeriodHedge IsChangeStartPrice OptMonIdx FutMonIdx", process.argv[1]));
console.log(util.format("ex: node %s %s %s 1 %d %d %d %d %d 1 %d 1 1 %d %d", 
            process.argv[1], OrderRequestDir, OrderTypeCOrP, OrderUnit, EnterPointUnit, PayoffPointUnit, EnterMinProfit, 270.20, MaxEnterCnt, OptMonIdx, FutMonIdx));

if (process.argv.length >= 3) {
   if (process.argv[2] === "D")
       OrderRequestDir = "D";
}

if (process.argv.length >= 4) 
    OrderTypeCOrP = process.argv[3];

if (process.argv.length >= 5) {
   if (!parseInt(process.argv[4]))
       IsLongPeriod = false;
}

if (process.argv.length >= 6) 
    OrderUnit = parseInt(process.argv[5]);

if (process.argv.length >= 7) 
    EnterPointUnit = parseFloat(process.argv[6]);

if (process.argv.length >= 8) 
    PayoffPointUnit = parseFloat(process.argv[7]);

if (process.argv.length >= 9) 
   EnterMinProfit = parseFloat(process.argv[8]);

if (process.argv.length >= 10) 
    EnterStartPrice = parseFloat(process.argv[9]);

if (process.argv.length >= 11) {
    let fixed = parseInt(process.argv[10]);
    if (!fixed) 
        IsFixedOrderUnit = false;
}

if (process.argv.length >= 12) 
    MaxEnterCnt = parseInt(process.argv[11]);

if (process.argv.length >= 13) {
   if (!parseInt(process.argv[12]))
       IsLongPeriodHedge = false;
}

if (process.argv.length >= 14) {
   if (!parseInt(process.argv[13]))
       IsChangeStartPrice = false;
}

if (process.argv.length >= 15) 
   OptMonIdx = parseInt(process.argv[14]);

if (process.argv.length >= 16) 
   FutMonIdx = parseInt(process.argv[15]);

const orderComm = new OrderComm(Config["comm_port"]);
const orderRequestMgr = new OrderRequestMgr(orderComm);
const commRedis = new CommRedis(Config["redis_host"], Config["redis_port"], trading, OptMonIdx, FutMonIdx);

const HistoryDb = new sqlite3.Database(DbFilePath, sqlite3.OPEN_READWRITE, function(error) {
    this.each("select * from p_positions_tbl order by idx;", function(err, row) {
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

        var payoffTargetJisu = row["payoff_target_jisu"];
        if (!payoffTargetJisu) {
            position_info.setPayoffTargetJisu(position_info.getBaseJisu() + PayoffPointUnit);
        }
        else {
            position_info.setPayoffTargetJisu(payoffTargetJisu);
        }

		var losscutTargetJisu = row["losscut_target_jisu"];
        if (!losscutTargetJisu) {
            position_info.setLosscutTargetJisu(position_info.getBaseJisu() - PayoffPointUnit);
        }
        else {
            position_info.setLosscutTargetJisu(losscutTargetJisu);
        }

		var dir = row["order_request_dir"];
        if (!dir) {
            position_info.setDir(OrderRequestDir);
        }
        else {
            position_info.setDir(dir);
        }

        var order_request_id = row["order_request_id"];
        if (order_request_id === null || order_request_id === undefined) {
            var orid = OrderRequestInfoLongShort.orderRequestInfoIdSeq_++;
            position_info.setOrderRequestInfoId(orid);
        }
        else {
            if (OrderRequestInfoLongShort.orderRequestInfoIdSeq_ <= order_request_id)
                OrderRequestInfoLongShort.orderRequestInfoIdSeq_ = order_request_id + 1;
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
    }

    if (commRedis.isReady()) {
        const fitem = Board[FCode];
        const kitem = Board["KOSPI200"];
        const base_jisu = fitem.price;

        doPayoffJob(fitem, base_jisu, BaseJisuDir);
        doNewEnterJob(fitem, kitem, base_jisu, BaseJisuDir, OrderRequestDir, OrderTypeCOrP);
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
    const item_code_L = orderReqInfo.getGoodsCode("L"); 
    const item_code_S = orderReqInfo.getGoodsCode("S"); 
    const item_L = Board[item_code_L];
    const item_S = Board[item_code_S];

    var order_cnt = orderReqInfo.canOrderCnt();
    if (item_L.offerrem1 < order_cnt) 
        order_cnt = item_L.offerrem1;

    if (item_S.bidrem1 < order_cnt) 
        order_cnt = item_S.bidrem1;

    if (order_cnt < 1) 
        return;

    if (baseJisuDir > 0) {
        if (orderReqInfo.getOptionType() === "C") 
            enterNewOrder(orderReqInfo, base_jisu, item_L, item_code_L, "L", item_S, item_code_S, "S", order_cnt);
        else 
            enterNewOrder(orderReqInfo, base_jisu, item_S, item_code_S, "S", item_L, item_code_L, "L", order_cnt);
    }
    else {
        if (orderReqInfo.getOptionType() === "C") 
            enterNewOrder(orderReqInfo, base_jisu, item_S, item_code_S, "S", item_L, item_code_L, "L", order_cnt);
        else 
            enterNewOrder(orderReqInfo, base_jisu, item_L, item_code_L, "L", item_S, item_code_S, "S", order_cnt);
    }
}

const setPositionInfo = function(orderReqInfo, curBaseJisu, positionInfo, isLongPeriod, isNewEnter) {
    if (orderReqInfo.getDir() === 'U') {
        positionInfo.setPayoffTargetJisu(curBaseJisu + PayoffPointUnit);
        positionInfo.setLosscutTargetJisu(curBaseJisu - PayoffPointUnit);
    }
    else {
        positionInfo.setPayoffTargetJisu(curBaseJisu - PayoffPointUnit);
        positionInfo.setLosscutTargetJisu(curBaseJisu + PayoffPointUnit);
    }
    positionInfo.setDir(orderReqInfo.getDir());
   
    positionInfo.setLongPeriod(isLongPeriod);
    positionInfo.setNewEnter(isNewEnter);
    positionInfo.setOrderInfo(null);
    HistoryDb.run("insert into p_positions_tbl values (?,?,?,?,?,?,?,?,?,?,?,?,?,?);",
        [positionInfo.getId(), positionInfo.getGoodsCode(), positionInfo.getLongOrShort(), positionInfo.getPrice(), positionInfo.getQuantity(),
            positionInfo.getBaseJisu(), positionInfo.getBaseJisu(), positionInfo.getPayoffTargetJisu(), positionInfo.getLosscutTargetJisu(),
            null, orderReqInfo.getDir(), orderReqInfo.getId(), CurDateStr, positionInfo.isLongPeriod()?1:0]);
    HistoryDb.run("insert into p_positions_history_tbl values (NULL,?,?,?,?,?,?,?,?,?);", [CurDateStr, 'E', positionInfo.getGoodsCode(),
        positionInfo.getLongOrShort(), positionInfo.getPrice(), positionInfo.getQuantity(), positionInfo.getBaseJisu(), null, null]);
    console.log(util.format("setPositionInfo.cb. 포지션 체결- PID:%d, 진입지수:%s, 코드:%s, %s, %s, %d", positionInfo.getId(), parseFloat(positionInfo.getBaseJisu()).toFixed(2),
        positionInfo.getGoodsCode(), positionInfo.getLongOrShort(), parseFloat(positionInfo.getPrice()).toFixed(2), positionInfo.getQuantity()));
    PositionMap[positionInfo.getId()] = positionInfo;
};

async function createNewOrderRequest(orderReqInfo, curBaseJisu, item, itemCode, lors, orderCnt, posLS, isNewEnter) {
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
    orderReqInfo.incSigned(lors, position_info.getPrice(), orderCnt);
    orderReqInfo.resetOrderedCnt(lors);
    setPositionInfo(orderReqInfo, curBaseJisu, position_info, IsLongPeriod, isNewEnter);
    posLS[lors] = position_info;
}

async function enterNewOrder(orderReqInfo, curBaseJisu, item0, itemCode0, lors0, item1, itemCode1, lors1, orderCnt) {
    console.log("enterNewOrder. start");
    const posLS = {};
    orderReqInfo.setOrderedCnt(lors0, orderCnt);
    orderReqInfo.setOrderedCnt(lors1, orderCnt);
    await createNewOrderRequest(orderReqInfo, curBaseJisu, item0, itemCode0, lors0, orderCnt, posLS, CurNewOrderRequestInfo === orderReqInfo);
    await createNewOrderRequest(orderReqInfo, curBaseJisu, item1, itemCode1, lors1, orderCnt, posLS, CurNewOrderRequestInfo === orderReqInfo);
    const pos_L = posLS["L"];
    const pos_S = posLS["S"];

    if (pos_L || pos_S) {
        const pair_id = orderReqInfo.addPositionInfoPair(pos_L, pos_S);
        if (pos_L) {
            HistoryDb.run("update p_positions_tbl set pair_id=? where idx=?;", [pair_id, pos_L.getId()]);
            pos_L.setPairId(pair_id);
        }
        if (pos_S) {
            HistoryDb.run("update p_positions_tbl set pair_id=? where idx=?;", [pair_id, pos_S.getId()]);
            pos_S.setPairId(pair_id);
        }
    }
    
    if (orderReqInfo.isCompletedAll()) {
        const position_info_pairs = orderReqInfo.getPositionInfoPairs();
        console.log(util.format("enterNewOrder. 진입 주문 체결 완료- ORID:%d, L:%s, %s, %d, S:%s, %s, %d, 부분체결된 포지션쌍 카운트:%d",
            orderReqInfo.getId(),
            orderReqInfo.getGoodsCode("L"), parseFloat(orderReqInfo.getPrice("L")).toFixed(2), orderReqInfo.getQuantity("L"),
            orderReqInfo.getGoodsCode("S"), parseFloat(orderReqInfo.getPrice("S")).toFixed(2), orderReqInfo.getQuantity("S"),
            position_info_pairs.length));

        if (CurNewOrderRequestInfo && CurNewOrderRequestInfo === orderReqInfo) 
            CurNewOrderRequestInfo = null;
        else if (HedgeNewOrderRequestInfo && HedgeNewOrderRequestInfo === orderReqInfo) 
            HedgeNewOrderRequestInfo = null;
    }
    else 
        trading(Board, FCode, YmCode);

    console.log("enterNewOrder. end");
}

function getEnterTargetInfos(curBaseJisu, orderRequestDir) {
    // 신규 진입을 여러번 나눠 한다면 최초 진입가격이 있을것인데, 여기서 최초 진입가격을 설정
    if (!FirstEnterBaseJisu) {
        FirstEnterBaseJisu = curBaseJisu;
        EnterTargetInfos = {};
        let orderCnt = 0;
        for (var i = 0; i < MaxEnterCnt; ++i) {//여기서 신규 진입할 각 지수별 주문 갯수를 미리 세팅해놓는다
            if (IsFixedOrderUnit) 
                orderCnt = OrderUnit;
            else 
                orderCnt = OrderMultiplier * OrderUnit * i;
            if (!orderCnt) 
                orderCnt = OrderUnit;
            if (orderRequestDir === 'U')
                EnterTargetInfos[parseFloat(FirstEnterBaseJisu - EnterPointUnit * i).toFixed(2)] = orderCnt;
            else
                EnterTargetInfos[parseFloat(FirstEnterBaseJisu + EnterPointUnit * i).toFixed(2)] = orderCnt;
        }
    }
    return EnterTargetInfos;
}

function changeEnterStartJisu(curBaseJisu, orderRequestDir, minStartPrice, remain) {
    // 최초 수익 목표 도달했다면 다음번 신규 진입을 결정하는 가격을 변경(수익을 얻어 청산을 했으면 최초 진입가보다 더 낮은 가격이 안되면 진입안하게 하려는 의도)
    if (IsChangeStartPrice && FirstEnterBaseJisu && remain == 0.0 && ((orderRequestDir === "U" && curBaseJisu >= FirstEnterBaseJisu + PayoffPointUnit) || (orderRequestDir === "D" && curBaseJisu <= FirstEnterBaseJisu - PayoffPointUnit))) {
        var enter_jisu;
        if (orderRequestDir === "U")
            enter_jisu = FirstEnterBaseJisu - PayoffPointUnit;
        else
            enter_jisu = FirstEnterBaseJisu + PayoffPointUnit;
        console.log("changeEnterStartJisu. 최초 수익 목표 달성후 최소 진입 기준 가격 변경: " + parseFloat(min_start_price).toFixed(2) + " => " + parseFloat(enter_jisu).toFixed(2));
        EnterStartPrice = enter_jisu;
        FirstEnterBaseJisu = 0;
        return true;
    }
    return false;
}

function doNewEnterJob(fitem, kitem, curBaseJisu, curBaseJisuDir, orderRequestDir, orderTypeCOrP) {
    const items_info = getTargetItemsInfoByDir(fitem, orderRequestDir, orderTypeCOrP);
    if (!items_info)
        return;

    var min_start_price = fitem.open;
    if (EnterStartPrice !== undefined) {
        min_start_price = EnterStartPrice;
    }

    if (HedgeNewOrderRequestInfo)
        processNewOrder(HedgeNewOrderRequestInfo, curBaseJisuDir);

    var remain = (min_start_price + EnterPointUnit - curBaseJisu) / EnterPointUnit;
    remain = Number(remain.toFixed(3));
    remain -= parseInt(remain);

    if (changeEnterStartJisu(curBaseJisu, orderRequestDir, min_start_price, remain))
        return;
    // 만약 이미 주문이 들어가 있다면 바로 리턴 
    if (CurNewOrderRequestInfo) {
        processNewOrder(CurNewOrderRequestInfo, curBaseJisuDir);
        return;
    }
    // 신규 진입
    if (remain == 0.0 && CurEnterCnt < MaxEnterCnt && ((orderRequestDir === 'U' && curBaseJisu <= min_start_price) || (orderRequestDir === 'D' && curBaseJisu >= min_start_price))) {
        const str_base_jisu = curBaseJisu.toFixed(2);
        const enter_target_infos = getEnterTargetInfos(curBaseJisu, orderRequestDir);
        var orderCnt = enter_target_infos[str_base_jisu];
        if (!orderCnt)// 현재 지수에는 신규 진입 정보가 없으므로 리턴
            return;

        console.log(util.format("doNewEnterJob. 포지션 신규 진입- 진입지수:%s(지수별 누적수량:%d), L:%s, %s, S:%s, %s, 주문수량:%d", 
                    str_base_jisu, NewEnterOrderCntMap[str_base_jisu], items_info.item_l_code, parseFloat(items_info.item_l.price).toFixed(2),
                    items_info.item_s_code, parseFloat(items_info.item_s.price).toFixed(2), orderCnt));

        var order_record = NewEnterOrderCntMap[str_base_jisu];
        if (order_record)
            NewEnterOrderCntMap[str_base_jisu] += 2 * orderCnt;// L/S하나씩 요청 두개가 발생하므로 곱하기 2해준다
        else 
            NewEnterOrderCntMap[str_base_jisu] = 2 * orderCnt;// L/S하나씩 요청 두개가 발생하므로 곱하기 2해준다
        // 신규 주문을 생성한다. 
        CurNewOrderRequestInfo = new OrderRequestInfoLongShort(orderTypeCOrP, curBaseJisu, 
                items_info.item_l_code, items_info.item_l.price, orderCnt, items_info.item_s_code, items_info.item_s.price, orderCnt, 
                null, orderRequestDir, IsLongPeriod);
        // 생성한 주문을 처리한다. 
        processNewOrder(CurNewOrderRequestInfo, curBaseJisuDir);

        ++CurEnterCnt;
        TotalOrderedCnt += orderCnt;

        if (CurEnterCnt == MaxEnterCnt && IsLongPeriod && IsLongPeriodHedge) {
            IsLongPeriodHedge = false;// 헷지 진입은 한번만 되게 한다. 
            const order_req_dir_inv = orderRequestDir === "U"?"D":"U";
            const order_type_corp_inv = orderTypeCOrP === "C"?"P":"C";
            const items_info_inv = getTargetItemsInfoByDir(fitem, order_req_dir_inv, order_type_corp_inv);
            HedgeNewOrderRequestInfo = new OrderRequestInfoLongShort(order_type_corp_inv, curBaseJisu, 
                    items_info_inv.item_l_code, items_info_inv.item_l.price, TotalOrderedCnt, items_info_inv.item_s_code, items_info_inv.item_s.price, TotalOrderedCnt, 
                    null, order_req_dir_inv, IsLongPeriod);
            console.log(util.format("doNewEnterJob. 헷지포지션 신규 진입- 진입지수:%s, L:%s, %s, S:%s, %s, 주문수량:%d", 
                        str_base_jisu, items_info_inv.item_l_code, parseFloat(items_info_inv.item_l.price).toFixed(2),
                        items_info_inv.item_s_code, parseFloat(items_info_inv.item_s.price).toFixed(2), TotalOrderedCnt));
            // 생성한 주문을 처리한다. 
            processNewOrder(HedgeNewOrderRequestInfo, curBaseJisuDir);
        }
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

function getTargetItemsInfoByDir(fitem, orderRequestDir, orderTypeCOrP) {
    var item_0_code, item_1_code, item_0, item_1, diff = 0.0, d = 0.0;//d는 최대 손실 

    var trg_act_price = getTargetActPrice(fitem);
    var trg_act_price_int = parseInt(trg_act_price);
    var trg_act_price_cnt = parseInt(trg_act_price / 2.5) + ((orderRequestDir === "U")?(-1):1);
    var trg_act_price_U1 = parseInt(trg_act_price + 2.5);

    for (var lcnt = 0; lcnt < 4; ++lcnt) {
        trg_act_price = (trg_act_price_cnt + ((orderRequestDir === "U")?lcnt:(-lcnt))) * 2.5;
        trg_act_price_int = parseInt(trg_act_price);
        trg_act_price_U1 = parseInt(trg_act_price + 2.5);

        if (orderTypeCOrP === "C") {
            item_0_code = "201" + YmCode + trg_act_price_int;
            item_1_code = "201" + YmCode + trg_act_price_U1;
        }
        else {
            item_0_code = "301" + YmCode + trg_act_price_int;
            item_1_code = "301" + YmCode + trg_act_price_U1;
        }

        item_0 = Board[item_0_code];
        item_1 = Board[item_1_code];

        if (!item_0 || !item_1 || item_1.bidho1 === undefined || item_0.offerho1 === undefined)
            return null;
        // 상방 포지션을 구할때 
        if (orderRequestDir === "U") {
            if (orderTypeCOrP === "C") {
                diff = item_1.bidho1 - item_0.offerho1 + 2.5;
                d = 2.5 - diff;
            } else {
                diff = item_1.bidho1 - item_0.offerho1;
                d = -2.5 + diff;
            }
        }
        else {// 하방 포지션을 구할때 
            if (orderTypeCOrP === "C") {
                diff = item_0.bidho1 - item_1.offerho1;
                d = 2.5 - diff;
            } else {
                diff = item_0.bidho1 - item_1.offerho1 + 2.5;
                d = -2.5 + diff;
            }
        }

        if (diff >= EnterMinProfit) {
            break;
        }
    }

    if (orderRequestDir === "U") {
        return {
            "item_l_code": item_0_code, 
                "item_s_code": item_1_code, 
                "item_l": item_0, 
                "item_s": item_1,
                "diff": diff,
                "d": d,
        };
    }
    else {
        return {
            "item_l_code": item_1_code, 
                "item_s_code": item_0_code, 
                "item_l": item_1, 
                "item_s": item_0,
                "diff": diff,
                "d": d,
        };
    }
}

function doLogic() {
    if (!commRedis.isReady() || Board === undefined) 
        return;

    CurDate = new Date();
    CurDateStr = CurDate.toFormat('YYYY-MM-DD HH24:MI:SS');
    const fitem = Board[FCode];
    const kitem = Board["KOSPI200"];

    if (!fitem || !kitem)
        return;
    // 이동 평균 구함
    const f_avg = getMovingAvg(fitem);
    // 현재 지수 추세 방향 결정
    BaseJisuDir = decideBaseJisuDir(f_avg);
    const items_info = getTargetItemsInfoByDir(fitem, OrderRequestDir, OrderTypeCOrP);
    if (items_info)
        console.log(util.format("doLogic. %s - dir: %d, F-c:%s, o:%s, h:%s, l:%s, K-c:%s, o:%s, h:%s, l:%s, %s, %s, u:%d, d:%d",
            (new Date()).toLocaleTimeString(), BaseJisuDir, parseFloat(fitem.price).toFixed(2),parseFloat(fitem.open).toFixed(2),parseFloat(fitem.high).toFixed(2),parseFloat(fitem.low).toFixed(2),
            parseFloat(kitem.price).toFixed(2),parseFloat(kitem.open).toFixed(2),parseFloat(kitem.high).toFixed(2),parseFloat(kitem.low).toFixed(2), 
            items_info.item_l_code, items_info.item_s_code, parseFloat(items_info.diff).toFixed(2), parseFloat(items_info.d).toFixed(2)));
    trading(Board, FCode, YmCode);
}

function doPayoffJob(fitem, curBaseJisu, curBaseJisuDir) {
    if (!curBaseJisu || !curBaseJisuDir)
        return;

    // 신규 청산 주문을 찾기위해 조건 검색을 한다.
    for (var key in PositionMap) {
        const position_info = PositionMap[key];
        if (!position_info || position_info.isProcessing())
            continue;
        let is_process = false;
        if (position_info.getDir() === "U") {// 상방포지션 처리
            if (position_info.isLongPeriod()) {
                if (position_info.getPayoffTargetJisu() && position_info.getPayoffTargetJisu() <= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.U.LPeriod.payoffTargetJisu: %d, %s",
                        position_info.getPayoffTargetJisu(), position_info.toString()));
            }
            else {
                if (position_info.getPayoffTargetJisu() && position_info.getPayoffTargetJisu() <= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.U.SPeriod.payoffTargetJisu: %d, %s",
                        position_info.getPayoffTargetJisu(), position_info.toString()));
                else if (position_info.getLosscutTargetJisu() && position_info.getLosscutTargetJisu() >= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.U.SPeriod.losscutTargetJisu: %d, %s",
                        position_info.getLosscutTargetJisu(), position_info.toString()));
            }
        }
        else {// 하방 포지션 처리
            if (position_info.isLongPeriod()) {
                if (position_info.getPayoffTargetJisu() && position_info.getPayoffTargetJisu() >= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.D.LPeriod.payoffTargetJisu: %d, %s",
                    position_info.getPayoffTargetJisu(), position_info.toString()));
            }
            else {
                if (position_info.getPayoffTargetJisu() && position_info.getPayoffTargetJisu() >= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.D.SPeriod.payoffTargetJisu: %d, %s",
                        position_info.getPayoffTargetJisu(), position_info.toString()));
                else if (position_info.getLosscutTargetJisu() && position_info.getLosscutTargetJisu() <= curBaseJisu)
                    is_process = true, console.log(util.format("doPayoffJob.D.SPeriod.losscutTargetJisu: %d, %s",
                    position_info.getLosscutTargetJisu(), position_info.toString()));
            }
        }

        if (is_process)
            processPayoff(curBaseJisu, curBaseJisuDir, position_info);
    }
}

function doPostPayoff(positionInfo, positionInfoPayoff, goodsCode, lors, payoffLors, orderPrice, orderCnt, orgBaseJisuStr, curBaseJisuStr) {
    if (positionInfoPayoff) {
        if (positionInfo.isNewEnter()) {// 신규 진입 했던 포지션이 청산되는 경우
            let cnt = NewEnterOrderCntMap[orgBaseJisuStr] - orderCnt; 
            NewEnterOrderCntMap[orgBaseJisuStr] = cnt;
            
            if (!cnt) // 해당 진입 지수에 포지션이 0이 됐다면 청산이 완전히 끝난것이고 다시 진입할 기회를 준다. 
                --CurEnterCnt;
        }
        let remain_cnt = positionInfo.getQuantity() - orderCnt;

        console.log(util.format("doPostPayoff. positionInfo: %s, positionInfoPayoff: %s, remain: %d", positionInfo.toString(), positionInfoPayoff.toString(), remain_cnt));
        if (remain_cnt) {// 해당 포지션이 완전히 청산되지 않았을경우
            positionInfo.setQuantity(remain_cnt);
            HistoryDb.run("update p_positions_tbl set quantity=? where idx=?;", [remain_cnt, positionInfo.getId()]);
            orderRequestMgr.deletePositionInfo(positionInfoPayoff.getId());
            console.log(util.format("doPostPayoff. 포지션 부분 청산 - ORG_ID:%d BJ:%s 코드:%s LS:%s 매입가:%s 수량:%d | BJ:%s 청산가:%s LS:%s 청산수량:%d",
                        positionInfo.getId(), orgBaseJisuStr,
                        goodsCode, lors, parseFloat(positionInfo.getPrice()).toFixed(2), positionInfo.getQuantity(),
                        curBaseJisuStr, parseFloat(orderPrice).toFixed(2), payoffLors, orderCnt));
        }
        else {// 완전히 청산된 경우
            HistoryDb.run("delete from p_positions_tbl where idx=?;", [positionInfo.getId()]);// 원래 포지션 정보 디비에서 삭제
            let pl;
            if (lors === "L")
                pl = (positionInfoPayoff.getPrice() - positionInfo.getPrice()) * positionInfo.getQuantity();
            else
                pl = (positionInfo.getPrice() - positionInfoPayoff.getPrice()) * positionInfo.getQuantity();

            HistoryDb.run("insert into p_positions_history_tbl values (NULL,?,?,?,?,?,?,?,?,?);",
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


