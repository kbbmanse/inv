const util = require("util");
var PairId = 0;

class PositionInfo {
    constructor(baseJisu, goodsCode, longOrShort, price, quantity, orderInfo, pairId, initJisu, isLongPeriod = true) {
        this.actPrice_ = null;
        this.actPriceUp_ = null;
        this.actPriceDown_ = null;
        this.goodsType_ = null;
        this.ymCode_ = null;
        this.id_ = PositionInfo.positionIdSeq_++;
        this.initPrice_ = initJisu;
        this.goodsCode_ = goodsCode;
        if (this.goodsCode_) {
            if (this.goodsCode_[0] === "1")
                this.goodsType_ = "F";
            else if (this.goodsCode_[0] === "2")
                this.goodsType_ = "C";
            else
                this.goodsType_ = "P";
        }

        this.calcActPrice(goodsCode);
        this.longOrShort_ = longOrShort;
        this.price_ = price;
        this.quantity_ = quantity;
        this.orderInfo_ = orderInfo;
        this.basePrice_ = baseJisu;
        this.linkedPositionId_ = null;
        this.payoffTargetPrice_ = null;
        this.losscutTargetPrice_ = null;
        this.pairId_ = pairId;
        this.orderRequestInfoId_ = null;
        this.dir_ = null;
        this.isLongPeriod_ = isLongPeriod;
        this.isProcessing_ = false;
        this.isNewEnter_ = false;
        this.insertedDate_ = null;
    }

    calcActPrice(goodsCode) {
        if (goodsCode !== null) {
            if (goodsCode[0] === "1")
                this.goodsType_ = "F";
            else if (goodsCode[0] === "2")
                this.goodsType_ = "C";
            else
                this.goodsType_ = "P";
            this.ymCode_ = goodsCode.substring(3, 5);
            const act_price = parseInt(goodsCode.substring(5, goodsCode.length));
            if (act_price % 5 !== 0) {
                this.actPriceUp_ = act_price + 3;
                this.actPriceDown_ = act_price - 2;
            }
            else {
                this.actPriceUp_ = act_price + 2;
                this.actPriceDown_ = act_price - 3;
            }
            this.actPrice_ = act_price; 
        }
    }
    getId() { return this.id_;}
    setId(id) { this.id_ = id;}
    getBasePrice() { return this.basePrice_;}
    getInitPrice() { return this.initPrice_;}
    getBaseJisu() { return this.basePrice_;}
    getInitJisu() { return this.initPrice_;}
    getGoodsCode() { return this.goodsCode_;}
    setGoodsCode(goodsCode) { this.goodsCode_ = goodsCode;
        this.calcActPrice(goodsCode);
    }
    getLongOrShort() { return this.longOrShort_;}
    setLongOrShort(longOrShort) { this.longOrShort_ = longOrShort;}
    getPrice() { return this.price_;}
    setPrice(price) { this.price_ = price;}
    getQuantity() { return this.quantity_;}
    setQuantity(quantity) { this.quantity_ = quantity;}
    getOrderInfo() { return this.orderInfo_;}
    setOrderInfo(orderInfo) { this.orderInfo_ = orderInfo;}
    isAbleToPayoff() { return this.orderInfo_ == null; }
    setLinkedPositionId(id) { this.linkedPositionId_ = id;}
    getLinkedPositionId() { return this.linkedPositionId_;}
    setPayoffTargetJisu(price) { this.payoffTargetPrice_ = price;}
    getPayoffTargetJisu() { return this.payoffTargetPrice_;}
    setLosscutTargetJisu(price) { this.losscutTargetPrice_ = price;}
    getLosscutTargetJisu() { return this.losscutTargetPrice_;}
    setPairId(id) { this.pairId_ = id;}
    getPairId() { return this.pairId_;}
    setOrderRequestInfoId(id) { this.orderRequestInfoId_ = id;}
    getOrderRequestInfoId() { return this.orderRequestInfoId_;}
    setDir(dir) { this.dir_ = dir;}
    getDir() { return this.dir_;}
    setActPrice(value) { this.actPrice_ = value;}
    getActPrice() { return this.actPrice_;}
    setActPriceUp(value) { this.actPriceUp_ = value;}
    getActPriceUp() { return this.actPriceUp_;}
    setActPriceDown(value) { this.actPriceDown_ = value;}
    getActPriceDown() { return this.actPriceDown_;}
    getGoodsType() { return this.goodsType_;}
    getYmCode() { return this.ymCode_;}
    isLongPeriod() { return this.isLongPeriod_;}
    setLongPeriod(value) { this.isLongPeriod_ = value;}
    isProcessing() { return this.isProcessing_;}
    setProcessing(value) { this.isProcessing_ = value;}
    isNewEnter() { return this.isNewEnter_;}
    setNewEnter(value) { this.isNewEnter_ = value;}
    getInsertedDate() { return this.insertedDate_;}
    setInsertedDate(value) { this.insertedDate_ = value;}
    getInsertedDateYMD() { if (!this.insertedDate_) return null; return (this.insertedDate_.split(" "))[0];}
    toString() { 
        return util.format("dir:%s,lp:%s,id:%d,gt:%s,ij:%d,bj:%d,gc:%s,L/S:%s,p:%d,q:%d,li:%d,pt:%d,lp:%d,pi:%d,orid:%d,ap:%d,au:%d,ad:%d,ym:%s,id:%s", 
                this.dir_, this.isLongPeriod_, this.id_, this.goodsType_, this.initPrice_, this.basePrice_, this.goodsCode_, this.longOrShort_, this.price_,
                    this.quantity_, this.linkedPositionId_, this.payoffTargetPrice_, this.losscutTargetPrice_, this.pairId_, this.orderRequestInfoId_, 
                    this.actPrice_, this.actPriceUp_, this.actPriceDown_, this.ymCode_, this.insertedDate_);
    } 
};
PositionInfo.positionIdSeq_ = 0;

class OrderRequestInfo{ 
    constructor(baseJisu, goodsType, lOrS, goodsCode, price, quantity, cbFunc) {
        this.id_ = OrderRequestInfo.orderRequestInfoIdSeq_++;
        this.baseJisu_ = baseJisu;
        this.goodsType_ = goodsType;
        this.goodsCode_ = goodsCode;
        this.price_ = price;
        this.quantity_ = quantity;
        this.orderedCnt_ = 0;
        this.signedCnt_ = 0;
        this.signedPriceTotal_ = 0.0;
        this.lOrS_ = lOrS;
        this.cbFunc_ = cbFunc;
    }

    getId() { return this.id_;}
    setId(id) { this.id_ = id;}
    getBaseJisu() { return this.baseJisu_;}
    getGoodsType() { return this.goodsType_;}
    getGoodsCode() { return this.goodsCode_;}
    getLongOrShort() { return this.lOrS_;}
    setLongOrShort(value) { this.lOrS_ = value;}
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
    toString() { return util.format("id:%d, bj:%s, gt:%s, gc:%s, p:%s, q:%d, oc:%d, sc:%d",
                this.id_, parseFloat(this.baseJisu_).toFixed(2), this.goodsType_, this.goodsCode_,
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
        this.positionInfoPairArray_.push({"id":tmp, "0":positionInfo0, "1":positionInfo1, "orid":this.id_});
        return tmp;
    }
    getPositionInfoPairs() { return this.positionInfoPairArray_;}
    getId() { return this.id_;}
    setId(id) { this.id_ = id;}
    getBaseJisu() { return this.baseJisu_;}
    getGoodsType(idx) { if (idx===0) return this.orderRequest0_.getGoodsType();return this.orderRequest1_.getGoodsType();}
    getGoodsCode(idx) { if (idx===0) return this.orderRequest0_.getGoodsCode();return this.orderRequest1_.getGoodsCode();}
    getLongOrShort(idx) { if (idx===0) return this.orderRequest0_.getLongOrShort();return this.orderRequest1_.getLongOrShort();}
    setLongOrShort(idx, value) { if (idx===0) this.orderRequest0_.setLongOrShort(value);else this.orderRequest1_.setLongOrShort(value);}
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


class LSEnterOrderRequest extends CompositeOrderRequest {
    constructor(optionType, baseJisu, goodsCodeL, priceL, quantityL, goodsCodeS, priceS, quantityS, cbFunc, dir = "U", isLongPeriod = true) {
        super(baseJisu, optionType, goodsCodeL, "L", priceL, quantityL, optionType, goodsCodeS, "S", priceS, quantityS, cbFunc, dir, isLongPeriod);
        console.log(this.toString());
    }

    addPositionInfoPair(positionInfoL, positionInfoS) {
        if (!positionInfoL && !positionInfoS)
            return -1;
        var tmp = PairId++; 
        var option_type;
        if (positionInfoL) {
            positionInfoL.setPairId(tmp);
            option_type = positionInfoL.getGoodsType();
        }
        if (positionInfoS) {
            positionInfoS.setPairId(tmp);
            option_type = positionInfoS.getGoodsType();
        }
        this.positionInfoPairArray_.push({"id":tmp, "L":positionInfoL, "S":positionInfoS, "ot":option_type, "orid":this.id_});
        return tmp;
    }
    getGoodsType() { return super.getGoodsType(0);}
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

class LSPayoffOrderRequest extends LSEnterOrderRequest {
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

class CompositeCoveredOrderRequest {
    constructor(baseJisu, futureLongOrShort, futureGoodsCodeC, futurePriceC, futureQuantityC, 
            futureGoodsCodeP, futurePriceP, futureQuantityP, 
            coveredLongOrShort, coveredGoodsType, coveredGoodsCode, coveredPrice, coveredQuantity, 
            cbFunc, dir = "U", isLongPeriod = true) {

        this.id_ = CompositeOrderRequest.orderRequestInfoIdSeq_++;
        this.baseJisu_ = baseJisu;
        this.dir_ = dir;
        this.cbFunc_ = cbFunc;
        this.positionInfoPairArray_ = new Array();
        this.positionInfoPairId_ = 0;
        this.isLongPeriod_ = isLongPeriod;
        this.futureLongOrShort_ = futureLongOrShort;
        this.compositeFutureOrder_ = new CompositeOrderRequest(baseJisu, "C", futureGoodsCodeC, futureLongOrShort==="L"?"L":"S", futurePriceC, futureQuantityC, 
                "P", futureCoodsCodeP, futureLongOrShort==="L"?"S":"L", futurePriceP, futureQuantityP, null, dir, isLongPeriod);
        this.coveredOrder_ = new OrderRequestInfo(baseJisu, coveredGoodsType, coveredLongOrShort, coveredGoodsCode, coveredPrice, coveredQuantity, null);
    }

   addPositionInfoPair(positionInfo0, positionInfo1, positionInfo2) {
        if (!positionInfo0 && !positionInfo1 && !positionInfo2)
            return -1;
        var tmp = PairId++; 
        if (positionInfo0) {
            positionInfo0.setPairId(tmp);
        }
        if (positionInfo1) {
            positionInfo1.setPairId(tmp);
        }
        if (positionInfo2) {
            positionInfo2.setPairId(tmp);
        }
        this.positionInfoPairArray_.push({"id":tmp, "F_C":positionInfo0, "F_P":positionInfo1, "CVD":positionInfo2, "orid":this.id_});
        return tmp;
    }
    getPositionInfoPairs() { return this.positionInfoPairArray_;}
    getId() { return this.id_;}
    setId(id) { this.id_ = id;}
    getBaseJisu() { return this.baseJisu_;}
    getGoodsType(idx, sidx=0) { if (idx===0) return this.compositeFutureOrder_.getGoodsType(sidx);return this.coveredOrder_.getGoodsType();}
    getGoodsCode(idx, sidx=0) { if (idx===0) return this.compositeFutureOrder_.getGoodsCode(sidx);return this.coveredOrder_.getGoodsCode();}
    getFutureLongOrShort() { return this.futureLongOrShort_;}
    getLongOrShort(idx, sidx=0) { if (idx===0) return this.compositeFutureOrder_.getLongOrShort(sidx);return this.coveredOrder_.getLongOrShort();}
    setLongOrShort(idx, value, sidx=0) { if (idx===0) this.compositeFutureOrder_.setLongOrShort(sidx, value);else this.coveredOrder_.setLongOrShort(value);}
    getPrice(idx, sidx=0) { if (idx===0) return this.compositeFutureOrder_.getPrice(sidx);return this.coveredOrder_.getPrice();}
    getQuantity(idx, sidx=0) { if (idx===0) return this.compositeFutureOrder_.getQuantity(sidx);return this.coveredOrder_.getQuantity();}
    setQuantity(idx, value, sidx=0) { if (idx===0) this.compositeFutureOrder_.setQuantity(sidx, value);else this.coveredOrder_.setQuantity(value);}
    getSignedCnt(idx, sidx=0) { if (idx===0) return this.compositeFutureOrder_.getSignedCnt(sidx);return this.coveredOrder_.getSignedCnt();}
    canOrderCnt(idx, sidx=0) { if (idx===0) return this.compositeFutureOrder_.canOrderCnt(sidx);return this.coveredOrder_.canOrderCnt();}
    incSigned(idx, signedPrice, signedCnt, sidx=0) { 
        if (idx===0) 
            this.compositeFutureOrder_.incSigned(sidx, signedPrice, signedCnt);
        else 
            this.coveredOrder_.incSigned(signedPrice, signedCnt);
    }
    getSignedPrice(idx, sidx=0) { 
        if (idx===0) 
            return this.compositeFutureOrder_.getSignedPrice(sidx);
        else 
            return this.coveredOrder_.getSignedPrice();
    } 
    setOrderedCnt(idx, orderCnt, sidx=0) { if (idx===0) this.compositeFutureOrder_.setOrderedCnt(sidx, orderCnt); else this.coveredOrder_.setOrderedCnt(orderCnt);}
    getOrderedCnt(idx, sidx=0) { if (idx===0) return this.compositeFutureOrder_.getOrderedCnt(sidx);return this.coveredOrder_.getOrderedCnt();}
    resetOrderedCnt(idx, sidx=0) { if (idx===0) this.compositeFutureOrder_.resetOrderedCnt(sidx);else this.coveredOrder_.resetOrderedCnt();}
    isAbleToOrder(idx, sidx=0) { 
        if (!this.getGoodsCode(idx, sidx)) 
            return true;
        if (this.getOrderedCnt(idx, sidx) > 0) 
            return false;
        return this.canOrderCnt(idx, sidx) > 0;
    }

    isAbleToOrderAll() { 
        if (this.isAbleToOrder(0, 0) && this.isAbleToOrder(0, 1) && this.isAbleToOrder(1))
            return true;
        else
            return false;
    }
    isCompleted(idx, sidx=0) { 
        if (this.getOrderedCnt(idx, sidx) > 0) 
            return false;
        return this.canOrderCnt(idx, sidx) === 0;
    }
    isCompletedAll() { 
        if (this.getOrderedCnt(0, 0) > 0) 
            return false;
        if (this.getOrderedCnt(0, 1) > 0) 
            return false;
        if (this.getOrderedCnt(1) > 0) 
            return false;
        if (this.canOrderCnt(0, 0) === 0 && this.canOrderCnt(0, 1) === 0 && this.canOrderCnt(1) === 0) 
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
    toString() { return "F: " + this.compositeFutureOrder_.toString() + " | " + this.coveredOrder_.toString();} 
}

module.exports.PositionInfo = PositionInfo;
module.exports.CompositeOrderRequest = CompositeOrderRequest;
module.exports.LSEnterOrderRequest = LSEnterOrderRequest;
module.exports.LSPayoffOrderRequest = LSPayoffOrderRequest;
module.exports.CompositeCoveredOrderRequest = CompositeCoveredOrderRequest;
module.exports.PairId = PairId;
module.exports.OrderRequestInfo = OrderRequestInfo;

