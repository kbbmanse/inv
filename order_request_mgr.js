const os = require("os");
const util = require("util");
const OrderComm = require("./order_base.js");
const OrderInfo = OrderComm.OrderInfo;
const SignInfo = OrderComm.SignInfo;
const OrderStruct= require("./order_struct_mod.js");
const OrderRequestInfo = OrderStruct.OrderRequestInfo;
const PositionInfo = OrderStruct.PositionInfo;

class OrderRequestMgr {
    constructor(orderComm) {
        this.orderComm_ = orderComm;
        this.orderRequestInfoMap_ = new Map();
        this.positionMap_ = new Map();
    }

    deleteOrderRequestInfo(id) {
        this.orderRequestInfoMap_.delete(id);
    }

    deletePositionInfo(id) {
        this.positionMap_.delete(id);
    }
    
    createOrderRequestPromise(curBaseJisu, item, itemCode, lOrS, orderPrice, orderCnt) {
        if (!itemCode || !lOrS || !orderCnt || (!item && !orderPrice))
            return Promise.resolve(null);

        var order_price;
        if (!orderPrice) {
            if (lOrS === "L") 
                order_price = item.offerho1;
            else 
                order_price = item.bidho1;
        }
        else
            order_price = orderPrice;

        const order_req_info = new OrderRequestInfo(curBaseJisu, itemCode.startsWith("2")?"C":"P", lOrS, order_price, orderCnt);
        const order_req_id = order_req_info.getId();
        this.orderRequestInfoMap_[order_req_id] = order_req_info;  
        const position_map = this.positionMap_;
        const order_comm = this.orderComm_;

        return new Promise(function(resolve,reject) {
            console.log("createOrderRequestPromise. ORID:", order_req_id, OrderComm.OPT_NEW, itemCode, lOrS, order_price, orderCnt);
            var order_info = order_comm.sendOrder(OrderComm.OPT_NEW, itemCode, lOrS, order_price, orderCnt, null, 
                function(orderInfo, signInfo) {
                    var order_req_info = orderInfo.getOrderRequestInfo();

                    if (orderInfo.getStatus() == OrderComm.OIS_COMPLETED) {
                        var position_info = position_map[orderInfo.getPositionInfoId()];
                        position_info.setOrderInfo(null);
                        console.log(util.format("createOrderRequestPromise.cb. 포지션 체결- PID:%d, 진입지수:%s, 코드:%s, %s, %s, %d", position_info.getId(), parseFloat(position_info.getBaseJisu()).toFixed(2), 
                                    position_info.getGoodsCode(), position_info.getLongOrShort(), parseFloat(position_info.getPrice()).toFixed(2), position_info.getQuantity()));

                        resolve(position_info);
                        position_map.delete(order_req_id);
                    }
                });

            if (order_info) {
                order_req_info.setOrderedCnt(lOrS, orderCnt);
                order_info.setOrderRequestInfo(order_req_info);
                const position_info = new PositionInfo(curBaseJisu, itemCode, lOrS, order_price, orderCnt, order_info, null, curBaseJisu);
                order_info.setPositionInfoId(position_info.getId());
                position_map[position_info.getId()] = position_info;
            }
            else {
                reject(null);
                position_map.delete(order_req_id);
            }
        });
    }

    createOrderRequest(curBaseJisu, item, itemCode, lOrS, orderPrice, orderCnt, cbFunc) {
        if (!itemCode || !lOrS || !orderCnt || (!item && !orderPrice))
            return null;

        var order_price;
        if (!orderPrice) {
            if (lOrS === "L") 
                order_price = item.offerho1;
            else 
                order_price = item.bidho1;
        }
        else
            order_price = orderPrice;

        const order_req_info = new OrderRequestInfo(curBaseJisu, itemCode.startsWith("2")?"C":"P", lOrS, order_price, orderCnt, cbFunc);
        const order_req_id = order_req_info.getId();
        this.orderRequestInfoMap_[order_req_id] = order_req_info;  
        const position_map = this.positionMap_;

        console.log("createOrderRequest. ORID:", order_req_id, OrderComm.OPT_NEW, itemCode, lOrS, order_price, orderCnt);
        const order_info = this.orderComm_.sendOrder(OrderComm.OPT_NEW, itemCode, lOrS, order_price, orderCnt, null, 
                function(orderInfo, signInfo) {
                    var order_req_info = orderInfo.getOrderRequestInfo();

                    if (orderInfo.getStatus() == OrderComm.OIS_COMPLETED) {
                        const position_info = position_map[orderInfo.getPositionInfoId()];
                        position_info.setOrderInfo(null);
                        console.log(util.format("createOrderRequest.cb. 포지션 체결- PID:%d, 진입지수:%s, 코드:%s, %s, %s, %d", position_info.getId(), parseFloat(position_info.getBaseJisu()).toFixed(2), 
                                    position_info.getGoodsCode(), position_info.getLongOrShort(), parseFloat(position_info.getPrice()).toFixed(2), position_info.getQuantity()));
                        order_req_info.on("sign_completed", orderInfo);
                    }
                    else if (orderInfo.getStatus() == OrderComm.OIS_REGISTER_RESULT) {
                        if (orderInfo.getQuantity() != signInfo.getSignedQuantity()) 
                            order_req_info.on("register_result", orderInfo, signInfo);
                    }
                });

        if (order_info) {
            order_req_info.setOrderedCnt(lOrS, orderCnt);
            order_info.setOrderRequestInfo(order_req_info);
            const position_info = new PositionInfo(curBaseJisu, itemCode, lOrS, order_price, orderCnt, order_info, null, curBaseJisu);
            order_info.setPositionInfoId(position_info.getId());
            this.positionMap_[position_info.getId()] = position_info;
            return [order_req_info, position_info];
        }
            
        return null;
    }
}

module.exports.OrderRequestMgr = OrderRequestMgr;
