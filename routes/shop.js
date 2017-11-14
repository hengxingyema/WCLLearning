/**
 * Created by wujiangwei on 2016/10/27.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');
var messager = require('../utils/messager');
var tryPriceUtil = require('../utils/tryPriceUtil');
var asoRankUtil = require('../utils/asoRank');

var leanObjectRedis = require('../utils/leanObjectRedis');

var User = AV.Object.extend('_User');
var IOSAppSQL = AV.Object.extend('IOSAppInfo');
var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var releaseTaskObject = AV.Object.extend('releaseTaskObject');
var receiveTaskObject = AV.Object.extend('receiveTaskObject');
var mackTaskInfo = AV.Object.extend('mackTaskInfo');

var rechargeHistorySQL = AV.Object.extend('rechargeHistory');

var ASOPlanObjectSql = AV.Object.extend('ASOPlanObject'); // 创建方案库
var integralWallTaskObjectSQL = AV.Object.extend('integralWallTaskObject'); //快速任务库

router.get('/', function(req, res) {
    res.render('shop');
});

/*
*
* 野马商店系统（10.29号更新）
* Y币商店
*
* specialGoods
*   野马会员
*   任务达人
*   双11的疯狂（2个商品）（11.11商品）
*
* ASO持续优化商品
*
* 抵用券系统（100积分抵扣10元）
* 特殊商品无法使用抵用券
* 1、首冲
* 2、懒人月卡
*
* 邀请好友8.8元现金红包/人
*       成功邀请好友定义
        1.绑定新的App（未在野马使用过）
        2.有3天成功完成任务
        3.有3天发布绑定App任务
        4.有3天审核发布的任务
*
 */

router.get('/yCoinGoods', function(req, res) {
    var userId = util.useridInReq(req);

    var userObject = new AV.User();
    userObject.id = userId;

    var goodsQuery = new AV.Query(rechargeHistorySQL);
    goodsQuery.equalTo('userObject', userObject);
    goodsQuery.include('userObject');
    goodsQuery.descending('createdAt');
    goodsQuery.find().then(function (goods) {
        var userYCoinGoods = userCanBuyedYCoinGoods(goods);

        for (var i = 0; i < goods.length; i++){
            var goodObject = goods[i];
            var userObject = goodObject.get('userObject');
        }

        res.json({'errorId' : 0, 'message' : '', 'userYCoinGoods' : userYCoinGoods});
    }, function (error) {
        res.json({'errorId' : error.code, 'message' : error.message})
    });
});

router.get('/asoHistory', function(req, res) {
    var userId = util.useridInReq(req);

    var user = new AV.User();
    user.id = userId;

    findAppsAndAsoKeys(user, res);
});

router.get('/userPointer', function(req, res) {
    // 用户积分系统（成功完成1个任务 + 1积分，被拒绝未重新完成一个任务 -1积分）
    var userId = util.useridInReq(req);

    util.getUserPointer(userId, function (goodPointer, totalPointer, userObject, errorMsg) {
        var cashMoney = userObject.get('cashMoney');
        if(cashMoney == undefined){
            cashMoney = 0;
        }
        if(errorMsg == undefined){
            res.json({'goodPointer' : goodPointer, 'userPointer' : totalPointer,
                      'cashMoney': cashMoney,
                      'errorId' : 0, 'message' : ''})
        }else {
            res.json({'goodPointer' : goodPointer, 'userPointer' : totalPointer,
                      'cashMoney': cashMoney,
                      'errorId' : -1, 'message' : errorMsg})
        }
    });
});

router.post('/pointerBuyer', function(req, res) {
    // 用户积分系统（成功完成1个任务 + 1积分，被拒绝未重新完成一个任务 -1积分）
    var userId = util.useridInReq(req);
    var consumePointer =  parseInt(req.body.consumePointer);

    util.getUserPointer(userId, function (goodPointer, totalPointer, userObject, errorMsg) {
        if(errorMsg == undefined){

            if(consumePointer > totalPointer){
                res.json({'errorId' : 1, 'message' : '兑换失败，积分不足'})
            }
            //积分兑换现金账户的钱

            //记录购买商品
            //100积分10元
            var cashMoney = parseInt(consumePointer / 10);
            userObject.increment('cashMoney', cashMoney);
            userObject.increment('usedPointer', consumePointer);
            var cashRecordObject = messager.cashMoneyExchange(consumePointer, cashMoney, userObject);

            AV.Object.saveAll([userObject, cashRecordObject]).then(function(datas){
                res.json({'errorId' : 0, 'addCash' : cashMoney, 'message' : '兑换成功，现金账户增加' + cashMoney + '元'});
            },function(error){
                res.json({'errorId' : -2, 'message' : error.message});
            });

        }else {
            res.json({'errorId' : -1, 'message' : '兑换失败，网络异常请重试'})
        }
    });
});

function findAppsAndAsoKeys(userObject, res) {
    //发布的任务数剩余条数的冻结Y币
    var releaseTaskQuery = new AV.Query(integralWallTaskObjectSQL);
    releaseTaskQuery.equalTo('userObject', userObject);
    releaseTaskQuery.exists('searchKeyword');
    releaseTaskQuery.include('appObject');
    releaseTaskQuery.limit(1000);
    releaseTaskQuery.descending('createdAt');
    releaseTaskQuery.find().then(function (releaseTasks) {
        var shopASOGoods = [];

        //获取用户发布过的app
        for (var i = 0; i < releaseTasks.length; i++){
            var releaseTaskObject = releaseTasks[i];
            var appObject = releaseTaskObject.get('appObject');
            if(appObject == undefined){
                console.error(releaseTaskObject.id + ' app not exist');
            }else {
                var appleId = appObject.get('appleId');
                var isExist = false;

                for(var j = 0; j < shopASOGoods.length; j++){
                    var shopASOItem = shopASOGoods[j];
                    if(shopASOItem.appleId == appleId){
                        isExist = true;
                        shopASOItem.taskCount++;
                    }
                }

                if(isExist == false){
                    //暂时不支持付费应用
                    if(appObject.get('formattedPrice') == '免费')
                    {
                        var artworkUrl100 = appObject.get('artworkUrl100');
                        var shopASOItem = {};
                        shopASOItem.appObjectId = appObject.id;
                        shopASOItem.trackName = appObject.get('trackName');
                        shopASOItem.appleId = appleId;
                        shopASOItem.artworkUrl100 = artworkUrl100;
                        shopASOItem.artworkUrl512 = appObject.get('artworkUrl512');
                        shopASOItem.taskCount = 1;
                        shopASOItem.asoKeys = [];
                        shopASOGoods.push(shopASOItem);
                    }
                }
            }
        }

        for(var j = 0; j < releaseTasks.length; j++){
            var releaseTaskObject = releaseTasks[j];
            var searchKeyword = releaseTaskObject.get('searchKeyword');

            var appObject = releaseTaskObject.get('appObject');
            var appleId = appObject.get('appleId');

            for (var i = 0; i < shopASOGoods.length; i++){
                var shopASOGood = shopASOGoods[i];

                if(shopASOGood.appleId == appleId){
                    var isExist = false;
                    for (var k = 0; k < shopASOGood.asoKeys.length; k++){
                        var tempKey = shopASOGood.asoKeys[k];
                        if(tempKey == searchKeyword){
                            isExist = true;
                            break;
                        }
                    }

                    if(isExist == false){
                        shopASOGood.asoKeys.push(searchKeyword);
                    }
                }
            }
        }


        if(res != undefined){
            res.json({'errorId' : 0, 'message' : '', 'shopASOGoods' : shopASOGoods})
        }
    }, function (error) {
        console.error('releaseTaskObject query error ', error.message);
        if(res != undefined){
            res.json({'message':error.message, 'errorId': error.code});
        }
    });
}

function userCanBuyedYCoinGoods(goods) {
    var YCoinGoodsIds = ['yCoin_month_limit_38', 'yCoin_total_limit_99',
                         'yCoin_120_500', 'yCoin_125_1000', 'yCoin_130_2000',
                         'yCoin_135_5000', 'yCoin_140_10000'];
    var YCoinGoodsCanBuyed = [];
    for (var c = 0; c < YCoinGoodsIds.length; c++){
        var tempGoodId = YCoinGoodsIds[c];

        if(util.canProductBuy(tempGoodId, goods) == true){
            var goodItem = util.getYCoinGoodItemById(tempGoodId);
            if(goodItem != undefined){
                YCoinGoodsCanBuyed.push(goodItem);
            }
        }
    }
    return YCoinGoodsCanBuyed;
}

// 创建计划
router.post('/createPlan', function(req, res){
    var userId = util.useridInReq(req);
    var createAsoPlanInfo = req.body.createAsoPlanInfo;

    var userObject = new User();
    userObject.id = userId;

    var appObject = new IOSAppSQL();
    appObject.id = createAsoPlanInfo.appObjectId;
    var asoKey = createAsoPlanInfo.asoKey;

    //限制排名
    if(createAsoPlanInfo.limitRanking < parseInt(createAsoPlanInfo.ranKing)){
        res.json({'message':'选择关键词排名超出限制', 'errorId': -1});
        return;
    }

    if(createAsoPlanInfo.ranKing > 500){
        res.json({'message':'排名获取失败', 'errorId': -1});
        return;
    }

    var createPlanObject, responseMessage, canHaveDiscount;

    function modifyPlanObject(createPlanObject, responseMessage) {
        if(createAsoPlanInfo.actionId != undefined){
            if(createAsoPlanInfo.actionId == 'stop'){
                createPlanObject.set('planStatus', 'stop');
                responseMessage = '暂停投放方案';
            }else if(createAsoPlanInfo.actionId == 'restart'){
                createPlanObject.set('planStatus', 'restart');
                responseMessage = '恢复投放方案';
            }else if(createAsoPlanInfo.actionId == 'hidden'){
                createPlanObject.set('planStatus', 'hidden');
                responseMessage = '隐藏投放方案';
            }else if(createAsoPlanInfo.actionId == 'show'){
                createPlanObject.set('planStatus', 'show');
                responseMessage = '恢复显示投放方案';
            }

        }else{
            //创建计划/修改
            //App 和 ASO词
            createPlanObject.set('planName', createAsoPlanInfo.planName);
            createPlanObject.set('sendType', createAsoPlanInfo.sendType);
            createPlanObject.set('userObject', userObject);
            createPlanObject.set('appObject', appObject);
            createPlanObject.set('appleId', createAsoPlanInfo.appleId);
            createPlanObject.set('asoKey', createAsoPlanInfo.asoKey);
            createPlanObject.set('startRanking', parseInt(createAsoPlanInfo.ranKing));

            //任务类型和额外要求 和 数量
            createPlanObject.set('taskType' , createAsoPlanInfo.taskType);
            createPlanObject.set('taskCountPerDay', parseInt(createAsoPlanInfo.taskCountPerDay));
            var RMBPerTask = tryPriceUtil.planTempCalculateRMB(createAsoPlanInfo, parseInt(createAsoPlanInfo.ranKing));
            createPlanObject.set('coltUserReceiveMoney' , RMBPerTask);

            if(createAsoPlanInfo.needGet == undefined){
                createPlanObject.set('needGet', '');
            }else {
                createPlanObject.set('needGet', createAsoPlanInfo.needGet);
            }

            if(createAsoPlanInfo.needThird == undefined){
                createPlanObject.set('needThird', '');
            }else {
                createPlanObject.set('needThird', createAsoPlanInfo.needThird);
            }

            //投放细节(每天几条，何时，几天，几天后投放)
            createPlanObject.set('taskLastDay', parseInt(createAsoPlanInfo.taskLastDay));
            createPlanObject.set('taskHour', parseInt(createAsoPlanInfo.taskHour));
            createPlanObject.set('delayTaskDay', parseInt(createAsoPlanInfo.delayTaskDay));
        }

        createPlanObject.save().then(function(date){
            var localAppObject = {};
            localAppObject.appObjectId = createAsoPlanInfo.appObjectId;
            localAppObject.appleId = createAsoPlanInfo.appleId;
            localAppObject.trackName = createAsoPlanInfo.trackName;
            localAppObject.artworkUrl100 = createAsoPlanInfo.artworkUrl100;
            localAppObject.artworkUrl512 = createAsoPlanInfo.artworkUrl512;

            var createdAsoPlan = planObjectToDic(date, localAppObject);

            responseMessage = responseMessage + '成功';
            res.json({'errorId':0, 'message':responseMessage, 'createdAsoPlan':createdAsoPlan})
        },function(error){
            responseMessage = responseMessage + '失败: ' + error.message;
            res.json({'message': responseMessage, 'errorId': error.code});
        })
    }

    function createPlanWithQuery(createPlanInfo) {
        if (createPlanInfo.length >= 1){
            createPlanObject = createPlanInfo[0];
            responseMessage = '修改投放方案';
        }else {
            createPlanObject = new ASOPlanObjectSql();
            responseMessage = '创建投放方案';

            //为付费用户记录
            asoRankUtil.recordAppASOKey(createAsoPlanInfo.appleId, createAsoPlanInfo.asoKey, parseInt(createAsoPlanInfo.ranKing), createAsoPlanInfo.appObjectId);
        }

        if(createAsoPlanInfo.sendType == 'now'){
            responseMessage = 'ASO优化(' +  createAsoPlanInfo.asoKey + ')任务发布';
        }

        modifyPlanObject(createPlanObject, responseMessage);
    }

    if(createAsoPlanInfo.planId != undefined){
        var query = new AV.Query(ASOPlanObjectSql);
        //修改计划
        query.equalTo('objectId', createAsoPlanInfo.planId);
        query.find().then(function(createPlanInfo){

            //查询2016双11特惠
            var query = new AV.Query(ASOPlanObjectSql);
            //修改计划
            query.equalTo('discount', 5);
            query.equalTo('discountDate', '20161111');
            query.count().then(function(favPlanCount){
                if(favPlanCount == 0){
                    //未参加过优惠
                    canHaveDiscount = true;
                }
                createPlanWithQuery(createPlanInfo);
            },function (error) {
                createPlanWithQuery(createPlanInfo);
            });

        },function(error){
            res.json({'message':error.message, 'errorId': error.code});
        })
    }else {
        //新建计划
        createPlanObject = new ASOPlanObjectSql();
        responseMessage = '创建投放方案';

        responseMessage = 'ASO优化(' +  createAsoPlanInfo.asoKey + ')任务发布';
        if(createAsoPlanInfo.destoryPlanId != undefined){
            //自动destory 上次投放的计划
            var prepareDestroyPlanObject = new ASOPlanObjectSql();
            prepareDestroyPlanObject.id = createAsoPlanInfo.destoryPlanId;
            prepareDestroyPlanObject.destroy();
        }

        //为付费用户记录
        asoRankUtil.recordAppASOKey(createAsoPlanInfo.appleId, createAsoPlanInfo.asoKey, parseInt(createAsoPlanInfo.ranKing), createAsoPlanInfo.appObjectId);

        modifyPlanObject(createPlanObject, responseMessage);
    }

});

//appObject can be null
function planObjectToDic(planObject, localAppObject) {
    var nowDate = new Date();
    var asoPlanObject = Object();

    asoPlanObject.planId = planObject.id;
    if(localAppObject != undefined){
        asoPlanObject.appObjectId = localAppObject.appObjectId;
        asoPlanObject.appleId = localAppObject.appleId;
        asoPlanObject.trackName = localAppObject.trackName;
        asoPlanObject.artworkUrl100 = localAppObject.artworkUrl100;
        asoPlanObject.artworkUrl512 = localAppObject.artworkUrl512;
    }else {
        var appObject = planObject.get('appObject');
        if(appObject == undefined){
            //app object be deleted
            return undefined;
        }
        asoPlanObject.appObjectId = appObject.id;
        asoPlanObject.appleId = appObject.get('appleId');
        asoPlanObject.trackName = appObject.get('trackName');
        asoPlanObject.artworkUrl100 = appObject.get('artworkUrl100');
        asoPlanObject.artworkUrl512 = appObject.get('artworkUrl512');
    }

    asoPlanObject.planName = planObject.get('planName');  // 方案名字
    asoPlanObject.asoKey = planObject.get('asoKey');   // 搜索关键词
    asoPlanObject.planStatus = planObject.get('planStatus'); // 投放状态
    asoPlanObject.sendType = planObject.get('sendType'); // 投放状态

    asoPlanObject.deliverSucceedReason = planObject.get('deliverSucceedReason');  // 投放失败原因
    asoPlanObject.deliverErrorReason = planObject.get('deliverErrorReason');  // 投放失败原因

    //时间
    asoPlanObject.taskCountPerDay = planObject.get('taskCountPerDay');
    asoPlanObject.taskLastDay = planObject.get('taskLastDay');
    asoPlanObject.delayTaskDay = planObject.get('delayTaskDay');
    asoPlanObject.taskHour = planObject.get('taskHour');
    asoPlanObject.planDisCount = planObject.get('planDisCount');
    asoPlanObject.ranKing = planObject.get('startRanking');

    // 投放状态
    if(planObject.get('sendType') == 'now' && planObject.get('planDeliverStatus') == 'planEnd'){
        asoPlanObject.deliverDateString = '方案投放成功';
    }else {
        asoPlanObject.createdAtDate = planObject.createdAt;  // 创建时间
        // 对于创建计划时间大于投放时间的，今天投放和明天投放是一个概念
        if(asoPlanObject.delayTaskDay == 0 && asoPlanObject.createdAtDate.getHours() > asoPlanObject.taskHour){
            // 次日才会开始投放
            asoPlanObject.delayTaskDay = 1;
        }
        // 计算投放开始时间 (1天后投放，就是明天投放，以此类推)
        planObject.createdAt.setHours(asoPlanObject.taskHour);
        planObject.createdAt.setMinutes(0);
        planObject.createdAt.setSeconds(0);
        planObject.createdAt.setMilliseconds(0);

        //计算投放 开始时间 和 结束时间
        var dayMiniMi = 24*60*60*1000;
        var firstPlanActiveTime = planObject.createdAt.getTime() + asoPlanObject.delayTaskDay * dayMiniMi;
        var firstPlanActiveDate = new Date(firstPlanActiveTime);
        var endPlanActiveTime = firstPlanActiveTime + (asoPlanObject.taskLastDay - 1)* dayMiniMi;
        var endPlanActiveDate = new Date(endPlanActiveTime);

        asoPlanObject.deliverDateString = util.dateToString(firstPlanActiveDate, true) + ' 至 ' + util.dateToString(endPlanActiveDate, true);
    }

    if(asoPlanObject.sendType == 'timer'){
        //计算天数
        var nowTime = nowDate.getTime();
        if(firstPlanActiveTime > nowTime){
            //未开始
            asoPlanObject.planDes = '准备投放';
            asoPlanObject.planDeliverStatus = 'planWaiting';
        }else if(endPlanActiveTime < nowTime){
            //已经结束
            asoPlanObject.planDes = '投放结束,请在审核任务中查看任务结果';
            asoPlanObject.planDeliverStatus = 'planEnd';
        }else{
            //正在进行
            asoPlanObject.planDes = '投放中,请在审核任务中查看任务结果';
            asoPlanObject.planDeliverStatus = 'planDoing';
        }
    }else {
        asoPlanObject.planDes = '已经投放';
        asoPlanObject.planDeliverStatus = planObject.get('planDeliverStatus');
    }


    //什么任务，每天投放X条，共投放X天
    asoPlanObject.taskType = planObject.get('taskType');  // 评论还是下载
    asoPlanObject.taskCountPerDay = planObject.get('taskCountPerDay');  // 投放量

    //开始投放关键词排名，现在排名

    asoPlanObject.needThird = planObject.get('needThird');  // 是否需要第三方
    asoPlanObject.commentKeys = planObject.get('commentKeys');
    asoPlanObject.commentContentKeys = planObject.get('commentContentKeys');
    asoPlanObject.formalCheck = planObject.get('formalCheck'); // 是否需要官方审核
    asoPlanObject.comment4G = planObject.get('comment4G'); // 是否需要4G
    asoPlanObject.needGet = planObject.get('needGet'); // 是否需要获取

    //报表使用
    // asoPlanObject.startRanking = ASOPlanObjects[i].get('startRanking'); // 排名

    return asoPlanObject;
}

// 获取我的创建计划
router.get('/getUserPlans', function(req, res){
    var userId = util.useridInReq(req);

    var userObject = new User();
    userObject.id = userId;

    var query = new AV.Query(ASOPlanObjectSql);
    query.equalTo('userObject', userObject);
    query.notEqualTo('planStatus', 'hidden');
    query.notEqualTo('yeMa', 'yeMa');
    query.include('appObject');
    query.descending('createdAt');
    query.find().then(function(ASOPlanObjects){
        var ASOPlanArray = Array();

        var existDiscount = false;

        for (var i = 0; i < ASOPlanObjects.length; i++){
            if(ASOPlanObjects[i].get('discountDate') == '20161111'){
                existDiscount = true;
            }

            var planSubDic = planObjectToDic(ASOPlanObjects[i], undefined);
            if(planSubDic != undefined){
                ASOPlanArray.push(planSubDic);
            }
        }
        res.json({'errorId':0, 'message':'', 'ASOPlanArray':ASOPlanArray, 'existDiscount':existDiscount})

    },function(error){
        res.json({'message':error.message, 'errorId': error.code});
    })
});

function getDay(day){
    var today = new Date();

    var targetday_milliseconds=today.getTime() + 1000*60*60*24*day;

    today.setTime(targetday_milliseconds); //注意，这行是关键代码

    var tYear = today.getFullYear();
    var tMonth = today.getMonth();
    var tDate = today.getDate();
    tMonth = doHandleMonth(tMonth + 1);
    tDate = doHandleMonth(tDate);

    return tYear+"-"+tMonth+"-"+tDate;
}
function doHandleMonth(month){
    //var m = month;

    return month;
}

module.exports = router;