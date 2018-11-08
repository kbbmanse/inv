const util = require("util");
var PairId = 0;

var OrderRequestInfoLongShort = function(optionType, baseJisu, goodsCodeL, priceL, quantityL, goodsCodeS, priceS, quantityS, cbFunc, dir = "U", isLongPeriod = true) {
    var id_ = OrderRequestInfoLongShort.orderRequestInfoIdSeq_++;
	var baseJisu_ = baseJisu;
	var goodsCodeL_ = goodsCodeL;
	var priceL_ = priceL;
	var quantityL_ = quantityL;
	var orderedCntL_ = 0;
	var signedCntL_ = 0;
	var signedPriceTotalL_ = 0.0;
    var dir_ = dir;

    var goodsCodeS_ = goodsCodeS;
	var priceS_ = priceS;
	var quantityS_ = quantityS;
	var orderedCntS_ = 0;
	var signedCntS_ = 0;
	var signedPriceTotalS_ = 0.0;
    var cbFunc_ = cbFunc;
    var optionType_ = optionType;

    var positionInfoPairArray_ = new Array();
    var positionInfoPairId_ = 0;
    var isLongPeriod_ = isLongPeriod;

	return {
        "addPositionInfoPair" : function(positionInfoL, positionInfoS) {
            if (!positionInfoL && !positionInfoS)
                return -1;
            var tmp = PairId++; 
            if (positionInfoL) {
                positionInfoL.setPairId(tmp);
            }
            if (positionInfoS) {
                positionInfoS.setPairId(tmp);
            }
            positionInfoPairArray_.push({"id":tmp, "L":positionInfoL, "S":positionInfoS, "ot":optionType_, "orid":id_});
            return tmp;
        },
        "getPositionInfoPairs" : function() { return positionInfoPairArray_;},
		"getId" : function() { return id_;},
		"setId" : function(id) { id_ = id;},
		"getBaseJisu" : function() { return baseJisu_;},
		"getOptionType" : function() { return optionType_;},
		"getGoodsCode" : function(lors) { if (lors==="L") return goodsCodeL_;return goodsCodeS_;},
		"getPrice" : function(lors) { if (lors==="L") return priceL_;return priceS_;},
		"getQuantity" : function(lors) { if (lors==="L") return quantityL_;return quantityS_;},
		"setQuantity" : function(lors, value) { if (lors==="L") quantityL_ = value;else quantityS_ = value;},
		"getSignedCnt" : function(lors) { if (lors==="L") return signedCntL_;return signedCntS_;},
		"canOrderCnt" : function(lors) { if (lors==="L") return quantityL_ - signedCntL_;return quantityS_ - signedCntS_;},
        "incSigned" : function(lors, signedPrice, signedCnt) { 
            if (lors==="L") {
                signedCntL_ += signedCnt; signedPriceTotalL_ += signedPrice * signedCnt;
            }
            else {
                signedCntS_ += signedCnt; signedPriceTotalS_ += signedPrice * signedCnt;
            }
        },
		"getSignedPrice" : function(lors) { 
            if (lors==="L") {
                if (signedCntL_ > 0) 
                    return signedPriceTotalL_ / signedCntL_; 
            }
            else {
                if (signedCntS_ > 0) 
                    return signedPriceTotalS_ / signedCntS_; 
            }
                
            return 0.0;
        }, 
		"setOrderedCnt" : function(lors, orderCnt) { if (lors==="L") orderedCntL_ = orderCnt; else orderedCntS_ = orderCnt;},
		"getOrderedCnt" : function(lors) { if (lors==="L") return orderedCntL_;return orderedCntS_;},
		"resetOrderedCnt" : function(lors) { if (lors==="L") orderedCntL_= 0;else orderedCntS_= 0;},
        "isAbleToOrder" : function(lors) { 
            if (!this.getGoodsCode(lors)) {
                return true;
            }

            if (lors==="L") {
                if (this.getOrderedCnt(lors) > 0) 
                    return false;
                return this.canOrderCnt(lors) > 0;
            }
            else {
                if (this.getOrderedCnt(lors) > 0) 
                    return false;
                return this.canOrderCnt(lors) > 0;
            }
        },
        "isAbleToOrderAll" : function() { 
            if (this.isAbleToOrder("L") && this.isAbleToOrder("S"))
                return true;
            else
                return false;
        },
        "isCompleted" : function(lors) { 
            if (lors==="L") {
                if (this.getOrderedCnt("L") > 0) 
                    return false;
                return this.canOrderCnt("L") === 0;
            }
            else {
                if (this.getOrderedCnt("S") > 0) 
                    return false;
                return this.canOrderCnt("S") === 0;
            }
        },
        "isCompletedAll" : function() { 
            if (this.getOrderedCnt("L") > 0) 
                return false;
            if (this.getOrderedCnt("S") > 0) 
                return false;
            if (this.canOrderCnt("L") === 0 && this.canOrderCnt("S") === 0) {
                return true;
            }
            return false;
        },
        "on" : function(eventType, orderInfo, signInfo) { 
            if (cbFunc_ != null) {
                cbFunc_(eventType, orderInfo, signInfo);
            }
        },
        "getDir" : function() {
            return dir_;
        },
        "setDir" : function(value) {
            dir_ = value;
        },
        "isLongPeriod" : function() {
            return isLongPeriod_;
        },
        "setLongPeriod" : function(value) {
            isLongPeriod_ = value;
        },
    };
};

OrderRequestInfoLongShort.orderRequestInfoIdSeq_ = 0;

var PositionInfo = function(baseJisu, goodsCode, longOrShort, price, quantity, orderInfo, pairId, initJisu, isLongPeriod = true) {
    var actPrice_ = null;
    var actPriceUp_ = null;
    var actPriceDown_ = null;
    var cOrP_ = null;
    var ymCode_ = null;
    var id_ = PositionInfo.positionIdSeq_++;
    var initPrice_ = initJisu;
    var goodsCode_ = goodsCode;
    if (goodsCode_) {
        if (goodsCode_[0] === "2")
            cOrP_ = "C";
        else
            cOrP_ = "P";
    }

    this.calcActPrice = function(goodsCode) {
        if (goodsCode !== null) {
            if (goodsCode[0] === "2")
                cOrP_ = "C";
            else
                cOrP_ = "P";
            ymCode_ = goodsCode.substring(3, 5);
            var act_price = parseInt(goodsCode.substring(5, goodsCode.length));
            if (act_price % 5 !== 0) {
                actPriceUp_ = act_price + 3;
                actPriceDown_ = act_price - 2;
            }
            else {
                actPriceUp_ = act_price + 2;
                actPriceDown_ = act_price - 3;
            }
            actPrice_ = act_price; 
        }
    };
    this.calcActPrice(goodsCode);
	var longOrShort_ = longOrShort;
	var price_ = price;
	var quantity_ = quantity;
    var orderInfo_ = orderInfo;
    var basePrice_ = baseJisu;
    var linkedPositionId_ = null;
    var payoffTargetPrice_ = null;
    var losscutTargetPrice_ = null;
    var pairId_ = pairId;
    var orderRequestInfoId_ = null;
    var dir_ = null;
    var isLongPeriod_ = isLongPeriod;
    var isProcessing_ = false;
    var isNewEnter_ = false;
    return {
		"getId" : function() { return id_;},
		"setId" : function(id) { id_ = id;},
		"getBasePrice" : function() { return basePrice_;},
		"getInitPrice" : function() { return initPrice_;},
		"getBaseJisu" : function() { return basePrice_;},
		"getInitJisu" : function() { return initPrice_;},
		"getGoodsCode" : function() { return goodsCode_;},
		"setGoodsCode" : function(goodsCode) { goodsCode_ = goodsCode;
            this.calcActPrice(goodsCode);
        },
		"getLongOrShort" : function() { return longOrShort_;},
		"setLongOrShort" : function(longOrShort) { longOrShort_ = longOrShort;},
		"getPrice" : function() { return price_;},
		"setPrice" : function(price) { price_ = price;},
		"getQuantity" : function() { return quantity_;},
		"setQuantity" : function(quantity) { quantity_ = quantity;},
		"getOrderInfo" : function() { return orderInfo_;},
		"setOrderInfo" : function(orderInfo) { orderInfo_ = orderInfo;},
		"isAbleToPayoff" : function() { return orderInfo_ == null; },
        "setLinkedPositionId" : function(id) { linkedPositionId_ = id;},
        "getLinkedPositionId" : function() { return linkedPositionId_;},
        "setPayoffTargetJisu" : function(price) { payoffTargetPrice_ = price;},
        "getPayoffTargetJisu" : function() { return payoffTargetPrice_;},
        "setLosscutTargetJisu" : function(price) { losscutTargetPrice_ = price;},
        "getLosscutTargetJisu" : function() { return losscutTargetPrice_;},
        "setPairId" : function(id) { pairId_ = id;},
        "getPairId" : function() { return pairId_;},
        "setOrderRequestInfoId" : function(id) { orderRequestInfoId_ = id;},
        "getOrderRequestInfoId" : function() { return orderRequestInfoId_;},
        "setDir" : function(dir) { dir_ = dir;},
        "getDir" : function() { return dir_;},
        "setActPrice" : function(value) { actPrice_ = value;},
        "getActPrice" : function() { return actPrice_;},
        "setActPriceUp" : function(value) { actPriceUp_ = value;},
        "getActPriceUp" : function() { return actPriceUp_;},
        "setActPriceDown" : function(value) { actPriceDown_ = value;},
        "getActPriceDown" : function() { return actPriceDown_;},
        "getCorP" : function() { return cOrP_;},
        "getYmCode" : function() { return ymCode_;},
        "isLongPeriod" : function() {
            return isLongPeriod_;
        },
        "setLongPeriod" : function(value) {
            isLongPeriod_ = value;
        },
        "isProcessing" : function() {
            return isProcessing_;
        },
        "setProcessing" : function(value) {
            isProcessing_ = value;
        },
        "isNewEnter" : function() {
            return isNewEnter_;
        },
        "setNewEnter" : function(value) {
            isNewEnter_ = value;
        },
        "toString" : function() { 
            return util.format("dir:%s,lp:%s,id:%d,C/P:%s,ij:%d,bj:%d,gc:%s,L/S:%s,p:%d,q:%d,li:%d,pt:%d,lp:%d,pi:%d,orid:%d,ap:%d,au:%d,ad:%d,ym:%s", 
                    dir_, isLongPeriod_, id_, cOrP_, initPrice_, basePrice_, goodsCode_, longOrShort_, price_, 
                        quantity_, linkedPositionId_, payoffTargetPrice_, losscutTargetPrice_, pairId_, orderRequestInfoId_, 
                        actPrice_, actPriceUp_, actPriceDown_, ymCode_);
        }, 
    };
};
PositionInfo.positionIdSeq_ = 0;

var OrderRequestInfoPayoff = function(dir, optionType, baseJisu, initJisu, payoffTargetJisu, losscutTargetJisu, srcPairId,
        goodsCodeL, priceL, quantityL, newL, goodsCodeS, priceS, quantityS, newS, 
        cbFunc, orgPosLorS, isLongPeriod = true) {
    var id_ = OrderRequestInfoLongShort.orderRequestInfoIdSeq_++;
	var baseJisu_ = baseJisu;
	var initJisu_ = initJisu;
	var payoffTargetPrice_ = payoffTargetJisu;
	var losscutTargetprice_ = losscutTargetJisu;
	var goodsCodeL_ = goodsCodeL;
	var priceL_ = priceL;
	var quantityL_ = quantityL;
	var orderedCntL_ = 0;
	var signedCntL_ = 0;
	var signedPriceTotalL_ = 0.0;
	var newL_ = newL;

    var goodsCodeS_ = goodsCodeS;
	var priceS_ = priceS;
	var quantityS_ = quantityS;
	var orderedCntS_ = 0;
	var signedCntS_ = 0;
	var signedPriceTotalS_ = 0.0;
	var newS_ = newS;

    var cbFunc_ = cbFunc;
    var optionType_ = optionType;

    var srcPairId_ = srcPairId;
    var dir_ = dir;
    var positionInfoPairArray_ = new Array();
    var positionInfoPairId_ = 0;
    var payoffPairId_ = -1;
    var orgPosLorS_ = orgPosLorS;
    var isLongPeriod_ = isLongPeriod;

	return {
        "addPositionInfoPair" : function(positionInfoL, positionInfoS) {
            if (!positionInfoL && !positionInfoS)
                return -1;
            var tmp = PairId++; 
            if (positionInfoL) {
                positionInfoL.setPairId(tmp);
            }
            if (positionInfoS) {
                positionInfoS.setPairId(tmp);
            }
            positionInfoPairArray_.push({"id":tmp, "L":positionInfoL, "S":positionInfoS, "ot":optionType_, "orid":id_});
            return tmp;
        },
        "getPositionInfoPairs" : function() { return positionInfoPairArray_;},
		"getId" : function() { return id_;},
		"setId" : function(id) { id_ = id;},
		"getBaseJisu" : function() { return baseJisu_;},
		"getInitJisu" : function() { return initJisu_;},
		"getPayoffTargetJisu" : function() { return payoffTargetPrice_;},
		"getLosscutTargetJisu" : function() { return losscutTargetprice_;},
		"getOptionType" : function() { return optionType_;},
		"getGoodsCode" : function(lors) { if (lors==="L") return goodsCodeL_;return goodsCodeS_;},
		"getPrice" : function(lors) { if (lors==="L") return priceL_;return priceS_;},
		"getQuantity" : function(lors) { if (lors==="L") return quantityL_;return quantityS_;},
		"setQuantity" : function(lors, value) { if (lors==="L") quantityL_ = value;else quantityS_ = value;},
		"getSignedCnt" : function(lors) { if (lors==="L") return signedCntL_;return signedCntS_;},
		"canOrderCnt" : function(lors) { if (lors==="L") return quantityL_ - signedCntL_;return quantityS_ - signedCntS_;},
        "incSigned" : function(lors, signedPrice, signedCnt) { 
            if (lors==="L") {
                signedCntL_ += signedCnt; signedPriceTotalL_ += signedPrice * signedCnt;
            }
            else {
                signedCntS_ += signedCnt; signedPriceTotalS_ += signedPrice * signedCnt;
            }
        },
		"getSignedPrice" : function(lors) { 
            if (lors==="L") {
                if (signedCntL_ > 0) 
                    return signedPriceTotalL_ / signedCntL_; 
            }
            else {
                if (signedCntS_ > 0) 
                    return signedPriceTotalS_ / signedCntS_; 
            }
                
            return 0.0;
        }, 
        "isNewPosition" : function(lors) { 
            if (lors==="L") {
                return newL_;
            }
            else {
                return newS_;
            }
                
            return false;
        }, 
		"setOrderedCnt" : function(lors, orderCnt) { if (lors==="L") orderedCntL_ = orderCnt; else orderedCntS_ = orderCnt;},
		"getOrderedCnt" : function(lors) { if (lors==="L") return orderedCntL_;return orderedCntS_;},
		"resetOrderedCnt" : function(lors) { if (lors==="L") orderedCntL_= 0;else orderedCntS_= 0;},
        "isAbleToOrder" : function(lors) { 
            if (!this.getGoodsCode(lors)) {
                return true;
            }

            if (lors==="L") {
                if (this.getOrderedCnt(lors) > 0) 
                    return false;
                return this.canOrderCnt(lors) > 0;
            }
            else {
                if (this.getOrderedCnt(lors) > 0) 
                    return false;
                return this.canOrderCnt(lors) > 0;
            }
        },
        "isAbleToOrderAll" : function() { 
            if (this.isAbleToOrder("L") && this.isAbleToOrder("S"))
                return true;
            else
                return false;
        },
        "isCompleted" : function(lors) { 
            if (lors==="L") {
                if (this.getOrderedCnt("L") > 0) 
                    return false;
                return this.canOrderCnt("L") === 0;
            }
            else {
                if (this.getOrderedCnt("S") > 0) 
                    return false;
                return this.canOrderCnt("S") === 0;
            }
        },
        "isCompletedAll" : function() { 
            if (this.getOrderedCnt("L") > 0) 
                return false;
            if (this.getOrderedCnt("S") > 0) 
                return false;
            if (this.canOrderCnt("L") === 0 && this.canOrderCnt("S") === 0) {
                return true;
            }
            return false;
        },
        "on" : function(eventType, orderInfo, signInfo) { 
            if (cbFunc_ != null) {
                cbFunc_(eventType, orderInfo, signInfo);
            }
        },
        "getDir" : function() {
            return dir_;
        },
        "setDir" : function(value) {
            dir_ = value;
        },
        "getSrcPairId" : function() {
            return srcPairId_;
        },
        "setSrcPairId" : function(value) {
            srcPairId_ = value;
        },
		"getPayoffPairId" : function() { return payoffPairId_;},
		"setPayoffPairId" : function(id) { payoffPairId_ = id;},
		"getOrgPosLorS" : function() { return orgPosLorS_;},
        "isLongPeriod" : function() {
            return isLongPeriod_;
        },
        "setLongPeriod" : function(value) {
            isLongPeriod_ = value;
        },
    };
};

class OrderRequestInfo{ 
    constructor(baseJisu, optionType, lOrS, goodsCode, price, quantity, cbFunc) {
        this.id_ = OrderRequestInfo.orderRequestInfoIdSeq_++;
        this.baseJisu_ = baseJisu;
        this.optionType_ = optionType;
        this.goodsCode_ = goodsCode;
        this.price_ = price;
        this.quantity_ = quantity;
        this.orderedCnt_ = 0;
        this.signedCnt_ = 0;
        this.signedPriceTotal_ = 0.0;
        this.cbFunc_ = cbFunc;
    }

    getId() { return this.id_;}
    setId(id) { this.id_ = id;}
    getBaseJisu() { return this.baseJisu_;}
    getOptionType() { return this.optionType_;}
    getGoodsCode() { return this.goodsCode_;}
    getPrice() { return this.price_;}
    getQuantity() { return this.quantity_;}
    setQuantity(value) { this.quantity_ = value;}
    getSignedCnt() { this.signedCnt_;}
    canOrderCnt() { return this.quantity_ - this.signedCnt_;}
    incSigned(signedPrice, signedCnt) { this.signedCnt_ += signedCnt; this.signedPriceTotal_ += signedPrice * signedCnt;}
    getSignedPrice() { 
        if (this.signedCnt_ > 0) 
            return this.signedPriceTotal_ / this.signedCnt_; 
        return 0.0;
    } 
    setOrderedCnt(orderCnt) { this.orderedCnt_ = orderCnt;}
    getOrderedCnt() { return this.orderedCnt_;}
    resetOrderedCnt() { this.orderedCnt_= 0;}
    isAbleToOrder() { 
        if (!this.getGoodsCode()) {
            return true;
        }

        if (this.getOrderedCnt() > 0) 
            return false;
        return this.canOrderCnt() > 0;
    }
    isCompleted() { 
        if (this.getOrderedCnt() > 0) 
            return false;
        return this.canOrderCnt() === 0;
    }
    on(eventType, orderInfo, signInfo) { 
        if (this.cbFunc_ != null) {
            this.cbFunc_(eventType, orderInfo, signInfo);
        }
    }
    toString() { return util.format("id:%d, bj:%s, ot:%s, gc:%s, p:%s, q:%d, oc:%d, sc:%d",
                this.id_, parseFloat(this.baseJisu_).toFixed(2), this.optionType_, this.goodsCode_,
                parseFloat(this.price_).toFixed(2), this.quantity_, this.orderedCnt_, this.signedCnt_);
    }
}
OrderRequestInfo.orderRequestInfoIdSeq_ = 0;

class CompositeOrderRequest{
    constructor(baseJisu, goodsType0, goodsCode0, lors0, price0, quantity0, goodsType1, goodsCode1, lors1, price1, quantity1, cbFunc, dir = "U", isLongPeriod = true) {
        this.id_ = CompositeOrderRequest.orderRequestInfoIdSeq_++;
        this.baseJisu_ = baseJisu;
        this.dir_ = dir;
        this.cbFunc_ = cbFunc;
        this.positionInfoPairArray_ = new Array();
        this.positionInfoPairId_ = 0;
        this.isLongPeriod_ = isLongPeriod;
        
        this.orderRequest0_ = new OrderRequestInfo(baseJisu, goodsType0, lors0, goodsCode0, price0, quantity0, null);
        this.orderRequest1_ = new OrderRequestInfo(baseJisu, goodsType1, lors1, goodsCode1, price1, quantity1, null);
    }

    addPositionInfoPair(positionInfo0, positionInfo1) {
        if (!positionInfo0 && !positionInfo1)
            return -1;
        var tmp = PairId++; 
        if (positionInfo0) {
            positionInfo0.setPairId(tmp);
        }
        if (positionInfo1) {
            positionInfo1.setPairId(tmp);
        }
        this.positionInfoPairArray_.push({"id":tmp, "0":positionInfo0, "1":positionInfo1, "ot":this.optionType_, "orid":this.id_});
        return tmp;
    }
    getPositionInfoPairs() { return this.positionInfoPairArray_;}
    getId() { return this.id_;}
    setId(id) { this.id_ = id;}
    getBaseJisu() { return this.baseJisu_;}
    getGoodsType(idx) { if (idx===0) return this.orderRequest0_.getOptionType();return this.orderRequest1_.getGoodsCode();}
    getGoodsCode(idx) { if (idx===0) return this.orderRequest0_.getGoodsCode();return this.orderRequest1_.getGoodsCode();}
    getPrice(idx) { if (idx===0) return this.orderRequest0_.getPrice();return this.orderRequest1_.getPrice();}
    getQuantity(idx) { if (idx===0) return this.orderRequest0_.getQuantity();return this.orderRequest1_.getQuantity();}
    setQuantity(idx, value) { if (idx===0) this.orderRequest0_.setQuantity(value);else this.orderRequest1_.setQuantity(value);}
    getSignedCnt(idx) { if (idx===0) return this.orderRequest0_.getSignedCnt();return this.orderRequest1_.getSignedCnt();}
    canOrderCnt(idx) { if (idx===0) return this.orderRequest0_.canOrderCnt();return this.orderRequest1_.canOrderCnt();}
    incSigned(idx, signedPrice, signedCnt) { 
        if (idx===0) 
            this.orderRequest0_.incSigned(signedPrice, signedCnt);
        else 
            this.orderRequest1_.incSigned(signedPrice, signedCnt);
    }
    getSignedPrice(idx) { 
        if (idx===0) 
            return this.orderRequest0_.getSignedPrice();
        else 
            return this.orderRequest1_.getSignedPrice();
    } 
    setOrderedCnt(idx, orderCnt) { if (idx===0) this.orderRequest0_.setOrderedCnt(orderCnt); else this.orderRequest1_.setOrderedCnt(orderCnt);}
    getOrderedCnt(idx) { if (idx===0) return this.orderRequest0_.getOrderedCnt();return this.orderRequest1_.getOrderedCnt();}
    resetOrderedCnt(idx) { if (idx===0) this.orderRequest0_.resetOrderedCnt();else this.orderRequest1_.resetOrderedCnt();}
    isAbleToOrder(idx) { 
        if (!this.getGoodsCode(idx)) 
            return true;

        if (this.getOrderedCnt(idx) > 0) 
            return false;
        return this.canOrderCnt(idx) > 0;
    }

    isAbleToOrderAll() { 
        if (this.isAbleToOrder(0) && this.isAbleToOrder(1))
            return true;
        else
            return false;
    }
    isCompleted(idx) { 
        if (this.getOrderedCnt(idx) > 0) 
            return false;
        return this.canOrderCnt(idx) === 0;
    }
    isCompletedAll() { 
        if (this.getOrderedCnt(0) > 0) 
            return false;
        if (this.getOrderedCnt(1) > 0) 
            return false;
        if (this.canOrderCnt(0) === 0 && this.canOrderCnt(1) === 0) 
            return true;

        return false;
    }
    on(eventType, orderInfo, signInfo) { 
        if (this.cbFunc_)
            this.cbFunc_(eventType, orderInfo, signInfo);
    }
    getDir() {return this.dir_;}
    setDir(value) {this.dir_ = value;}

    isLongPeriod() {return this.isLongPeriod_;}
    setLongPeriod(value) {this.isLongPeriod_ = value;}
    toString() { return this.orderRequest0_.toString() + " | " + this.orderRequest1_.toString();} 
}
CompositeOrderRequest.orderRequestInfoIdSeq_ = 0;


class NewOrderRequestLongShort extends CompositeOrderRequest {
    constructor(optionType, baseJisu, goodsCodeL, priceL, quantityL, goodsCodeS, priceS, quantityS, cbFunc, dir = "U", isLongPeriod = true) {
        super(baseJisu, optionType, goodsCodeL, "L", priceL, quantityL, optionType, goodsCodeS, "S", priceS, quantityS, cbFunc, dir, isLongPeriod);
        console.log(this.toString());
    }

    addPositionInfoPair(positionInfoL, positionInfoS) {
        if (!positionInfoL && !positionInfoS)
            return -1;
        var tmp = PairId++; 
        if (positionInfoL) {
            positionInfoL.setPairId(tmp);
        }
        if (positionInfoS) {
            positionInfoS.setPairId(tmp);
        }
        this.positionInfoPairArray_.push({"id":tmp, "L":positionInfoL, "S":positionInfoS, "ot":this.optionType_, "orid":this.id_});
        return tmp;
    }
    getOptionType() { return super.getGoodsType(0);}
    getGoodsCode(lors) { return super.getGoodsCode(lors==="L"?0:1);}
    getPrice(lors) { return super.getPrice(lors==="L"?0:1);}
    getQuantity(lors) { return super.getQuantity(lors==="L"?0:1);}
    setQuantity(lors, value) { super.setQuantity(lors==="L"?0:1, value);}
    getSignedCnt(lors) { return super.getSignedCnt(lors==="L"?0:1);}
    canOrderCnt(lors) { return super.canOrderCnt(lors==="L"?0:1);}
    incSigned(lors, signedPrice, signedCnt) { super.incSigned(lors==="L"?0:1, signedPrice, signedCnt);}
    getSignedPrice(lors) { return super.getSignedPrice(lors==="L"?0:1);} 
    setOrderedCnt(lors, orderCnt) { super.setOrderedCnt(lors==="L"?0:1, orderCnt);}
    getOrderedCnt(lors) { return super.getOrderedCnt(lors==="L"?0:1);}
    resetOrderedCnt(lors) { super.resetOrderedCnt(lors==="L"?0:1);}
    isAbleToOrder(lors) { return super.isAbleToOrder(lors==="L"?0:1);}
    isCompleted(lors) { return super.isCompleted(lors==="L"?0:1);}
}

class PayoffOrderRequestLongShort extends NewOrderRequestLongShort {
    constructor(dir, optionType, baseJisu, initJisu, payoffTargetJisu, losscutTargetJisu, srcPairId,
        goodsCodeL, priceL, quantityL, newL, goodsCodeS, priceS, quantityS, newS, 
        cbFunc, orgPosLorS, isLongPeriod = true) {
        super(optionType, baseJisu, goodsCodeL, priceL, quantityL, goodsCodeS, priceS, quantityS, cbFunc, dir, isLongPeriod);
        this.initJisu_ = initJisu;
        this.payoffTargetPrice_ = payoffTargetJisu;
        this.losscutTargetprice_ = losscutTargetJisu;
        this.newL_ = newL;
        this.newS_ = newS;
        this.srcPairId_ = srcPairId;
        this.payoffPairId_ = -1;
        this.orgPosLorS_ = orgPosLorS;
    }

    getInitJisu() { return this.initJisu_;}
    getPayoffTargetJisu() { return this.payoffTargetPrice_;}
    getLosscutTargetJisu() { return this.losscutTargetprice_;}
    setPayoffTargetJisu(value) { this.payoffTargetPrice_ = value;}
    setLosscutTargetJisu(value) { this.losscutTargetprice_ = value;}
    isNewPosition(lors) { return (lors==="L")?this.newL_:this.newS_;} 
    getSrcPairId() { return this.srcPairId_;}
    setSrcPairId(value) { this.srcPairId_ = value;}
    getPayoffPairId() { return this.payoffPairId_;}
    setPayoffPairId(id) { this.payoffPairId_ = id;}
    getOrgPosLorS() { return this.orgPosLorS_;}
}

module.exports.CompositeOrderRequest = CompositeOrderRequest;
module.exports.OrderRequestInfoLongShort = NewOrderRequestLongShort;
module.exports.PositionInfo = PositionInfo;
module.exports.OrderRequestInfoPayoff = PayoffOrderRequestLongShort;
module.exports.PairId = PairId;
module.exports.OrderRequestInfo = OrderRequestInfo;
