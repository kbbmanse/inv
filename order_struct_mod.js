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
}
OrderRequestInfo.orderRequestInfoIdSeq_ = 0;

class NewOrderRequestLongShort{
    constructor(optionType, baseJisu, goodsCodeL, priceL, quantityL, goodsCodeS, priceS, quantityS, cbFunc, dir = "U", isLongPeriod = true) {
        this.id_ = NewOrderRequestLongShort.orderRequestInfoIdSeq_++;
        this.baseJisu_ = baseJisu;
        this.dir_ = dir;
        this.cbFunc_ = cbFunc;
        this.optionType_ = optionType;
        this.positionInfoPairArray_ = new Array();
        this.positionInfoPairId_ = 0;
        this.isLongPeriod_ = isLongPeriod;
        
        this.long_ = new OrderRequestInfo(baseJisu, optionType, "L", goodsCodeL, priceL, quantityL, null);
        this.short_ = new OrderRequestInfo(baseJisu, optionType, "S", goodsCodeS, priceS, quantityS, null);
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
    getPositionInfoPairs() { return this.positionInfoPairArray_;}
    getId() { return this.id_;}
    setId(id) { this.id_ = id;}
    getBaseJisu() { return this.baseJisu_;}
    getOptionType() { return this.optionType_;}
    getGoodsCode(lors) { if (lors==="L") return this.long_.getGoodsCode();return this.short_.getGoodsCode();}
    getPrice(lors) { if (lors==="L") return this.long_.getPrice();return this.short_.getPrice();}
    getQuantity(lors) { if (lors==="L") return this.long_.getQuantity();return this.short_.getQuantity();}
    setQuantity(lors, value) { if (lors==="L") this.long_.setQuantity(value);else this.short_.setQuantity(value);}
    getSignedCnt(lors) { if (lors==="L") return this.long_.getSignedCnt();return this.short_.getSignedCnt();}
    canOrderCnt(lors) { if (lors==="L") return this.long_.canOrderCnt();return this.short_.canOrderCnt();}
    incSigned(lors, signedPrice, signedCnt) { 
        if (lors==="L") 
            this.long_.incSigned(signedPrice, signedCnt);
        else 
            this.short_.incSigned(signedPrice, signedCnt);
    }
    getSignedPrice(lors) { 
        if (lors==="L") 
            return this.long_.getSignedPrice();
        else 
            return this.short_.getSignedPrice();
    } 
    setOrderedCnt(lors, orderCnt) { if (lors==="L") this.long_.setOrderedCnt(orderCnt); else this.short_.setOrderedCnt(orderCnt);}
    getOrderedCnt(lors) { if (lors==="L") return this.long_.getOrderedCnt();return this.short_.getOrderedCnt();}
    resetOrderedCnt(lors) { if (lors==="L") this.long_.resetOrderedCnt();else this.short_.resetOrderedCnt();}
    isAbleToOrder(lors) { 
        if (!this.getGoodsCode(lors)) 
            return true;

        if (this.getOrderedCnt(lors) > 0) 
            return false;
        return this.canOrderCnt(lors) > 0;
    }

    isAbleToOrderAll() { 
        if (this.isAbleToOrder("L") && this.isAbleToOrder("S"))
            return true;
        else
            return false;
    }
    isCompleted(lors) { 
        if (this.getOrderedCnt(lors) > 0) 
            return false;
        return this.canOrderCnt(lors) === 0;
    }
    isCompletedAll() { 
        if (this.getOrderedCnt("L") > 0) 
            return false;
        if (this.getOrderedCnt("S") > 0) 
            return false;
        if (this.canOrderCnt("L") === 0 && this.canOrderCnt("S") === 0) 
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
}
NewOrderRequestLongShort.orderRequestInfoIdSeq_ = 0;

class PayoffOrderRequestLongShort extends NewOrderRequestLongShort {
    constructor(dir, optionType, baseJisu, initJisu, payoffTargetJisu, losscutTargetJisu, srcPairId,
        goodsCodeL, priceL, quantityL, newL, goodsCodeS, priceS, quantityS, newS, 
        cbFunc, orgPosLorS, isLongPeriod = true) {
        super(optionType, baseJisu, goodsCodeL, priceL, quantityL, goodsCodeS, priceS, quantityS, cbFunc, dir, isLongPeriod);
        this.id_ = NewOrderRequestLongShort.orderRequestInfoIdSeq_++;
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
    
    isNewPosition(lors) { 
        if (lors==="L") 
            return this.newL_;
        else 
            return this.newS_;
            
        return false;
    } 
    
    getSrcPairId() { return this.srcPairId_;}
    setSrcPairId(value) { this.srcPairId_ = value;}
    getPayoffPairId() { return this.payoffPairId_;}
    setPayoffPairId(id) { this.payoffPairId_ = id;}
    getOrgPosLorS() { return this.orgPosLorS_;}
}

module.exports.OrderRequestInfoLongShort = NewOrderRequestLongShort;
module.exports.PositionInfo = PositionInfo;
module.exports.OrderRequestInfoPayoff = PayoffOrderRequestLongShort;
module.exports.PairId = PairId;
module.exports.OrderRequestInfo = OrderRequestInfo;
