'use strict';
var router = require('express').Router();

var alipay = require('../utils/alipay');
var messager = require('../utils/messager');

var leanObjectRedis = require('../utils/leanObjectRedis');

var AV = require('leanengine');
var util = require('./util');

var User = AV.Object.extend('_User');
var ASOPlanObjectSql = AV.Object.extend('ASOPlanObject'); // 创建方案库
var cashRecordObjectSQL= AV.Object.extend('cashRecordObject');

var aliSeparateStr = '________';

router.post('/buy/:chargeMoney/:productId', function(req, res) {
    var userId = util.useridInReq(req);
    var chargeMoney = req.params.chargeMoney;
    var productId = req.params.productId;
    var username = req.cookies.username;
    var total_fee = chargeMoney;

    var userObject = new AV.User();
    userObject.id = userId;

    function requestAliPayRequest(subject, body) {
        //生成订单号
        var originalOrderId = Date.parse(new Date()) + req.cookies.userIdCookie;
        var out_trade_no = util.encodeStr(originalOrderId);

        var extraCommonParam = req.cookies.userIdCookie + aliSeparateStr + productId;

        var params = {
            //加密的user_id
            extra_common_param: extraCommonParam,
            //商户网站订单系统中唯一订单号，必填
            out_trade_no: out_trade_no,
            //订单名称，必填
            subject: subject,
            // 付款金额，必填
            total_fee: total_fee,

            // 订单描述
            body: body
            // 商品展示地址
            //需以http://开头的完整路径，例如：http://www.商户网址.com/myorder.html
            //show_url: req.body.show_url
        };
        var html = alipay.getDirectPayReqHtml(params, 'get');
        res.send(html);
    }

    var body, subject;
    if(productId.indexOf('cash') >= 0){
        //现金账户充值
        body = '现金账户充值' + chargeMoney + '元';
        subject = '充值现金账户';

        if(chargeMoney < 100){
            res.json({'errorId': 1, 'message': '充值金额100元起'});
            return;
        }

        requestAliPayRequest(subject, body);
    }else if(productId.indexOf('yCoin') >= 0){
        //Y币充值
        var rechargeHistorySQL = AV.Object.extend('rechargeHistory');
        var goodsQuery = new AV.Query(rechargeHistorySQL);
        goodsQuery.equalTo('chargeUserId', userObject.id);
        goodsQuery.include('userObject');
        goodsQuery.descending('createdAt');
        goodsQuery.find().then(function (goods) {

            var canBuy = util.canProductBuy(productId, goods);

            if (canBuy == false) {
                res.json({'errorId': 1, 'message': '抱歉，您不满足该商品的购买条件(您已经购过此类商品)'});
                return;
            }

            if(productId.indexOf('yCoin') >= 0){
                body = username + '充值YB(' + '付款金额RMB:' + chargeMoney + ')';
                var YCoinRechargeObject = util.getYCoinGoodItemById(productId);
                subject  = '购买' + YCoinRechargeObject.yCoin + 'Y币';
            }

            requestAliPayRequest(subject, body);
        }, function (error) {
            console.error('charge error : ', error.message);
            res.json({'errorId': error.code, 'message': error.message});
        });
    }else {
        //其他商品充值
        if(productId.indexOf('first_recharge_3000_total_limit') >= 0){
            //获取用户的充值记录
            var cashRecordSQL = AV.Object.extend('cashRecordObject');
            var cashRecordQuery = new AV.Query(cashRecordSQL);
            cashRecordQuery.equalTo('userId', userObject.id);
            cashRecordQuery.find().then(function (goods) {

                //看看商品能不能被再次购买
                var canBuy = util.canProductBuy(productId, goods);

                if (canBuy == false) {
                    res.json({'errorId': 1, 'message': '抱歉，您不满足该商品的购买条件(您已经购过此类商品)'});
                    return;
                }

                if(productId == 'first_recharge_3000_total_limit'){
                    //1.商城首冲
                    body = '首冲优惠3000得3520';
                    subject  = '首冲优惠3000得3520';
                }else {
                    //其他
                }

                requestAliPayRequest(subject, body);
            }, function (error) {
                console.error('charge error : ', error.message);
                res.json({'errorId': error.code, 'message': error.message});
            });
        }else if(productId == 'task_expert'){
            //2.双11任务达人（已经下线）
            body = '完成任务条件可以拿到1111个Y币';
            subject = '购买野马的任务达人';
            requestAliPayRequest(subject, body);
        }
    }
});

router.get('/alipay/return', function(req, res) {
    console.log('return query: ', req.query);
    alipay.verify(req.query, function(err, result) {
        console.log('result: ', err, result);
        if (err) {
            return res.send('err: ' + err);
        }

        //TODO Res HTML File
        //此处为同步结果，不一定为准确
        res.json({'errorMsg':'', 'errorId':0, 'message':'成功充值,若有问题,请联系官方客服QQ 768826903,为你解决充值问题'});
    });
});

router.post('/alipay/notify', function(req, res) {
    console.log('notify params:', req.body);
    var params = req.body;
    alipay.verify(params, function(err, result) {
        if (err) {
            console.error('pay error: ', err, result);
            return res.send('err: ' + err);
        }
        //充值成功
        var chargeMoney = parseFloat(params.total_fee);//获取充值的金额

        console.log('AliPay info: params.extra_common_param : ', params.extra_common_param);
        var customParams = params.extra_common_param.split(aliSeparateStr);
        console.log('AliPay info: customParams : ', customParams[0], customParams[1]);

        var chargeUserId, productId;
        if(customParams.length == 2){
            chargeUserId = util.decodeUserId(customParams[0]);//充值的用户
            productId = customParams[1];//商品ID
        }else {
            console.error('AliPay info error: params.extra_common_param : ', params.extra_common_param);
            console.log('AliPay info: customParams : ', customParams[0], customParams[1]);
        }

        var aliOrderId = params.trade_no;//订单号

        console.log('AliPay info: chargeUserId : ' + chargeUserId + ', productId : ' + productId + ' chargeMoney : ' + chargeMoney);

        //Y币购买
        if(productId.indexOf('yCoin') >= 0){
            YCoinRecharge(chargeUserId, chargeMoney, productId, aliOrderId, res);
        }
        //现金账户充值
        else if(productId.indexOf('cash') >= 0){
            cashRecharge(chargeUserId, chargeMoney, aliOrderId, res);
        }
        //商城首次奖励
        else if(productId.indexOf('first_recharge_3000_total_limit') >= 0){
            if(chargeMoney != 3000){
                console.error('现金账户充值失败:' + '支付金额不对，需要支付 3000 支付了 ' + chargeMoney);
                res.end("success");
                return;
            }
            ASOShopRechargeGood(chargeUserId, chargeMoney, productId, aliOrderId, res);
        }
        //双11任务达人专属购买（已经下线）
        else if(productId == 'task_expert'){

            if(chargeMoney != 11.1){
                console.error('现金账户充值失败:' + '支付金额不对，需要支付 11.1 支付了 ' + chargeMoney);
                res.end("success");
                return;
            }

            var userObject = new User();
            userObject.id = chargeUserId;
            userObject.set('isTaskExpert', true);
            userObject.save().then(function(){
                res.end("success");
            },function(error){
                console.error('购买任务达人失败 : ' + error.message);
                res.end("success");
                //res.json({'errorMsg':'', 'errorId':0, 'message':'充值成功,获得' + addYB + 'YB,请刷新个人中心查看最新YB金额'});
            });
        }

    });
});

//ASO商城首冲
function ASOShopRechargeGood(chargeUserId, chargeMoney, productId, aliOrderId, res) {
    var userObject = new User();
    userObject.id = chargeUserId;

    var cashRecordSQL = AV.Object.extend('cashRecordObject');
    var cashRecordQuery = new AV.Query(cashRecordSQL);
    cashRecordQuery.equalTo('userId', chargeUserId);
    cashRecordQuery.equalTo('productId', productId);
    cashRecordQuery.find().then(function (goods) {

        //看看商品能不能被再次购买
        var canBuy = util.canProductBuy(productId, goods);

        if (canBuy == false) {
            console.error('您已经购买过该商品（该商品限购一次）');
            return;
        }

        //首冲优惠
        userObject.increment('cashMoney', 3520);
        var cashRecordObject = messager.cashMoneyRecharge(chargeMoney, aliOrderId, userObject, productId);

        AV.Object.saveAll([userObject, cashRecordObject]).then(function(){
            res.end("success");
        },function(error){
            console.error('首冲优惠3000得3520 失败: ' + error.message);
            res.end("success");
        })
    }, function (error) {
        console.error('首冲优惠3000得3520 失败: ' + error.message);
        res.end("success");
    });
}

//现金账户充值
function cashRecharge(chargeUserId, chargeMoney, aliOrderId, res) {
    var userObject = new User();
    userObject.id = chargeUserId;

    userObject.increment('cashMoney', chargeMoney);
    var cashRecordObject = messager.cashMoneyRecharge(chargeMoney, aliOrderId, userObject, undefined);

    AV.Object.saveAll([userObject, cashRecordObject]).then(function(datas){
        res.end("success");
    },function(error){
        console.error('现金账户充值失败 : ' + error.message);
        res.end("success");
        //res.json({'errorMsg':'', 'errorId':0, 'message':'充值成功,获得' + addYB + 'YB,请刷新个人中心查看最新YB金额'});
    });
}

//Y币充值
function YCoinRecharge(chargeUserId, chargeMoney, productId, aliOrderId, res) {
    var rechargeHistorySQL = AV.Object.extend('rechargeHistory');
    var userObject = new AV.User();
    userObject.id = chargeUserId;

    var goodsQuery = new AV.Query(rechargeHistorySQL);
    goodsQuery.equalTo('chargeUserId', userObject.id);
    goodsQuery.include('userObject');
    goodsQuery.descending('createdAt');
    goodsQuery.find().then(function (goods) {

        var canBuy = util.canProductBuy(productId, goods);

        if(canBuy == false){
            res.json({'errorId' : 1, 'message' : '抱歉，您不满足该商品的购买条件(您已经购过国此类商品)'});
            return;
        }

        var productInfo = util.getYCoinGoodItemById(productId);
        if(productInfo.price != chargeMoney){
            console.error('现金账户充值失败:' + '支付金额不对，需要支付 ' + productInfo.price + ' 支付了 ' + chargeMoney);
            res.end("success");
            return;
        }

        var rechargeObject = new rechargeHistorySQL();
        rechargeObject.set('userObject', userObject);
        rechargeObject.set('chargeUserId', userObject.id);
        rechargeObject.set('productId', productId);
        rechargeObject.set('chargeMoney', chargeMoney);
        rechargeObject.set('aliOrderId', aliOrderId);
        //奖励的Y币
        var rewardYCoin = productInfo.yCoin - productInfo.price * 10;
        rechargeObject.set('chargeReward', parseInt(rewardYCoin/10));

        userObject.increment('totalMoney', productInfo.yCoin);
        //记录奖励金额
        userObject.increment('feedingMoney', rewardYCoin);
        userObject.increment('rechargeRMB', chargeMoney);

        var messageObject = messager.topUpMsg(chargeMoney, productInfo.yCoin, chargeUserId);

        AV.Object.saveAll([userObject, rechargeObject, messageObject]).then(function(datas){
            res.end("success");
        },function(error){
            res.end("success");
            console.error('YB账户充值失败:' + error.message);
            //res.json({'errorMsg':'', 'errorId':0, 'message':'充值成功,获得' + addYB + 'YB,请刷新个人中心查看最新YB金额'});
        });
    }, function (error) {
        console.error('recharge YCoin failed ', error.message);
        res.end("success");
    });
}

module.exports = router;
