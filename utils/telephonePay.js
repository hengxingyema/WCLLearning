/**
 * Created by cailong on 2016/11/14.
 */

var request = require('request');

var crypto = require('crypto');

// .检测手机号码是否能充值 根据手机号和面值查询商品
exports.verifyWhetherCanTopUp = function(topUpAmount, phoneNumber, callback){
    var phoneIn = encodeURI('http://op.juhe.cn/ofpay/mobile/telquery?cardnum=' + topUpAmount + '&phoneno=' + phoneNumber + '&key=48201b5a11150828e0a84e67271ccbfb');

    var isCanTopUp;
    //创建请求
    request(phoneIn,function(error, response, body){
        var bodyT =  JSON.parse(body);
        if (!error && response.statusCode == 200) {
            if (bodyT.error_code == 0){
                isCanTopUp = true;
                callback(bodyT, isCanTopUp);
            }
            else {
                isCanTopUp = false;
                callback(bodyT, isCanTopUp);
            }
        }else {
            callback(999, -100, '网络异常');
        }
    });
};

// 手机直充接口
exports.phoneChargeStraight = function(topUpAmount, phoneNumber, callback){
    // 生成订单号
    var originalOrderId = Date.parse(new Date()) + phoneNumber + topUpAmount;

    var signNumber = 'JH5b65e1b9a4869974f8c8e5930ab5b22a' + '48201b5a11150828e0a84e67271ccbfb' + phoneNumber + topUpAmount + originalOrderId
    var md5 = crypto.createHash('md5');
    var calibrationValue = md5.update(signNumber, 'utf-8').digest('hex');

    var phoneIn = encodeURI('http://op.juhe.cn/ofpay/mobile/onlineorder?key=48201b5a11150828e0a84e67271ccbfb&phoneno='
        + phoneNumber + '&cardnum=' + topUpAmount + '&orderid=' + originalOrderId + '&sign=' + calibrationValue);

    console.log('商户订单:' + originalOrderId);
    console.log('校验码:' + calibrationValue);
    var topUpResults;
    //创建请求
    request(phoneIn,function(error, response, body){
        var bodyT =  JSON.parse(body);
        if (!error && response.statusCode == 200) {
            if (bodyT.error_code == 0){
                topUpResults = true;
                callback(bodyT, bodyT.result, topUpResults);
            }
            else {
                topUpResults = false;
                callback(bodyT, bodyT.result, topUpResults);
            }
        }else {
            callback(bodyT, bodyT.result, topUpResults);
        }
    });
};

// 订单状态查询
exports.orderStatusQuery = function(orderid, callback){

    var phoneIn = encodeURI('http://op.juhe.cn/ofpay/mobile/ordersta?key=48201b5a11150828e0a84e67271ccbfb&orderid=' + orderid);
    //创建请求
    request(phoneIn,function(error, response, body){
        var bodyT =  JSON.parse(body);
        if (!error && response.statusCode == 200) {
            if (bodyT.error_code == 0){
                console.log('状态:' + bodyT.result.game_state);
                console.log('聚合订单号:' + bodyT.result.sporder_id);
                callback(bodyT);
            }
            else {
                console.log('2' + bodyT.reason);
                callback(bodyT);
            }
        }else {
            console.log('3' + bodyT.reason);
            callback(bodyT);
        }
    });
};
