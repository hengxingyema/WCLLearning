/**
 * Created by wujiangwei on 16/9/13.
 */

var AV = require('leanengine');
var htmlparser = require("htmlparser2");
var messager = require('./messager');
var util = require('../routes/util');
var releaseTaskObject = AV.Object.extend('releaseTaskObject'); // 发布任务库
var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var taskDemandSQL = AV.Object.extend('taskDemandObject');
var integralWallTaskObjectSQL = AV.Object.extend('integralWallTaskObject');

var http=require('http');

exports.masterConfigInfo = function() {
    var masterConfig = {};
    //前多少次徒弟任务获得指定的钱
    masterConfig.masterRMBPreCount = parseInt(process.env.smallHorseMasterRMBPreCount) || 20;
    //前多少次徒弟任务获得指定的钱(多少钱)
    masterConfig.masterRMBPreRMB = parseFloat(process.env.smallHorseMasterRMBPreRMB) || 0.5;
    //师徒获取Y币比率
    var masterRMBRate = parseFloat(process.env.smallHorseMasterRMBRate) || 0.1;
    //
    masterConfig.masterRMBRateDisplay = parseInt(masterRMBRate * 100);

    return masterConfig;
};

//基础价格
exports.baseYCoinPrice = function(taskType){
    if(taskType == '下载'){
        return 20;
    }else if(taskType == '评论' || taskType == '定制评论'){
        return 30;
    }
};

exports.baseRMBPrice = function(taskType){
    if(taskType == '下载'){
        return 1;
    }else if(taskType == '评论' || taskType == '定制评论'){
        return 1.2;
    }
};

exports.baseAdsRMBPrice = function(taskType){
    if(taskType == '下载'){
        return 2.2;
    }else if(taskType == '评论' || taskType == '定制评论'){
        return 2.8;
    }
};

//付费游戏
exports.payAppRmb = function(price){
    return price * 1.1;
};

exports.payAppYCoin = function(price){
    return price * 15;
};

exports.getRankYCoin = function (asoRank) {
    var rankYCoin = 0;
    if (asoRank <= 40){
        rankYCoin = 0;
    }
    else if (asoRank >= 41 && asoRank <= 50){
        rankYCoin = 1;
    }
    else {
        rankYCoin += Math.floor(1 + (asoRank - 50) * 0.2);
    }

    return rankYCoin;
};

//AS0关键词排名带来的额外 金额
exports.getRankRmb = function(asoRank){
    if(asoRank < 50){
        return 0;
    }
    if(asoRank < 500 && asoRank > 400 ){
        //4.5 - 6(1 - 1.2)
        return (asoRank - 100) * 0.015;
    }
    else if(asoRank < 400 && asoRank > 300 ){
        //2.8 - 4.2(1 - 1.2)
        return (asoRank - 100) * 0.014;
    }
    else if(asoRank < 300 && asoRank > 200 ){
        //1.3 - 2.6(1 - 1.2)
        return (asoRank - 100) * 0.013;
    }
    else if(asoRank < 200 && asoRank > 100 ){
        //0.4 - 1.2(1 - 1.2)
        return (asoRank - 50) * 0.008;
    }
    return (asoRank - 50) * 0.006;
};

exports.needGetRmb = function(needGet){
    return needGet == true ? 0 : 0;
};

exports.needThirdLogin = function(registerStatus){
    return registerStatus == 'third' ? 0.0 : 0;
};

exports.needLongComment = function(needLongComment){
    return needLongComment == true ? 0.1 : 0;
};

exports.pointCommentTitle = function(needPoint){
    return needPoint == true ? 0.05 : 0;
};

exports.pointCommentContent = function(needPoint){
    return needPoint == true ? 0.05 : 0;
};

//野马Y币和小马RMB的折算
exports.planCalculateYCoin = function(planObject, asoKeyRank) {
    var taskType = planObject.get('taskType');
    var YCoinPrice = exports.baseYCoinPrice(taskType);

    YCoinPrice += exports.getRankYCoin(asoKeyRank);

    if(planObject.get('needThird') == 'needThird'){
        YCoinPrice += 2;
    }

    if(taskType == '评论' || taskType == '定制评论'){
        if(planObject.get('needGet') == 'needGet'){
            YCoinPrice += 5;
        }
        if(planObject.get('comment4G') == 'comment4G'){
            //TODO
        }
    }else {
        YCoinPrice += 5;
    }

    var appObject = planObject.get('appObject');

    if (appObject.get('formattedPrice') != '免费'){
        YCoinPrice += exports.payAppYCoin(parseFloat(appObject.get('formattedPrice').substring(1, appObject.get('formattedPrice').length)));
    }


    return YCoinPrice;
};

exports.planCalculateRMB = function(planObject, asoKeyRank) {
    var taskType = planObject.get('taskType');
    var RMBPrice = exports.baseRMBPrice(taskType);

    RMBPrice += exports.getRankRmb(asoKeyRank);

    if(taskType == '评论'){
        if(planObject.get('needGet') == 'needGet'){
            //TODO
        }
        if(planObject.get('comment4G') == 'comment4G'){
            //TODO
        }
    }
    var appObject = planObject.get('appObject');

    if (appObject.get('formattedPrice') != '免费'){
        RMBPrice += exports.payAppRmb(parseFloat(appObject.get('formattedPrice').substring(1, appObject.get('formattedPrice').length)));
    }


    return RMBPrice;
};

exports.planTempCalculateRMB = function(planObject, asoKeyRank) {
    var taskType = planObject.taskType;
    var RMBPrice = exports.baseRMBPrice(taskType);

    RMBPrice += exports.getRankRmb(asoKeyRank);

    return RMBPrice;
};

exports.planCalculateAdsUserRMB = function(planObject, asoKeyRank) {
    var taskType = planObject.get('taskType');
    var adsRMB = exports.baseAdsRMBPrice(taskType);

    if(asoKeyRank > 100){

        if(asoKeyRank <= 500 && asoKeyRank >= 400 ){
            //11.1 - 14.6
            adsRMB += 0.6 + (asoKeyRank - 100) * 0.035;
        }
        else if(asoKeyRank < 400 && asoKeyRank >= 300 ){
            //7 - 10.2
            adsRMB += 0.6 + (asoKeyRank - 100) * 0.032;
        }
        else if(asoKeyRank < 300 && asoKeyRank >= 200 ){
            //3.6 - 6.6
            adsRMB += 0.6 + (asoKeyRank - 100) * 0.03;
        }else if(asoKeyRank < 200){
            //0.6 - 2.6
            adsRMB += 0.6 + (asoKeyRank - 100) * 0.02;
        }else {
            adsRMB += 20;
        }
    }else if(asoKeyRank > 40){
        adsRMB += (asoKeyRank - 40) * 0.01;
    }

    //额外要求
    if(planObject.get('needThird') == 'needThird'){
        adsRMB += 0.2;
    }
    if(planObject.get('formalCheck') == 'formalCheck'){
        adsRMB += 0.1;
    }

    if(planObject.get('needGet') == 'needGet'){
        adsRMB += 0.1;
    }

    if(taskType == '评论' || taskType == '定制评论'){
        if(planObject.get('comment4G') == 'comment4G'){
            adsRMB += 0.1;
        }
    }

    //无折扣
    var planDisCount = 10;
    if(planObject.get('planDisCount') != undefined){
        planDisCount = planObject.get('planDisCount');
    }

    return (adsRMB * planDisCount) / 10;
};

exports.planCalculateAdsUserTotalMoney = function(planObject, asoKeyRank) {
    var taskType = planObject.get('taskType');
    var adsRMB = exports.baseYCoinPrice(taskType);

    if (asoKeyRank <= 20){
        adsRMB += 0;
    }
    else if (asoKeyRank >= 41 && asoKeyRank <= 50){
        adsRMB += 1;
    }
    else {
        adsRMB += Math.floor(1 + (asoKeyRank - 50) * 0.2);
    }

    //额外要求
    if(planObject.get('needThird') == 'needThird'){
        adsRMB += 2;
    }
    if(planObject.get('formalCheck') == 'formalCheck'){
        adsRMB += 5;
    }

    if(planObject.get('needGet') == 'needGet'){
        adsRMB += 5;
    }

    if(taskType == '评论' || taskType == '定制评论'){
        if(planObject.get('comment4G') == 'comment4G'){
            adsRMB += 0.1;
        }
    }

    return adsRMB;
};

//translate Plan Object to releaseTask Object

//exports.aso100RankUrl = function(key, page, appId, asoKeyRank, maxAsoRank, callback){
//
//     callback(999, 1, '请手动输入您的排名');
//     return;
//
//    //http://aso100.com/search/searchMore?page=1&device=iphone&search=+%E7%9B%B8%E4%BA%B2&country=cn&brand_id=1&date=2016-9-01
//    var aso100RequestUrl = encodeURI('http://aso100.com/search/searchMore?page=' + page + '&device=iphone&search=' + key + '&country=cn&brand_id=1');
//    // console.log(aso100RequestUrl);
//
//    var options = {
//        url: aso100RequestUrl,
//        headers: {
//            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:49.0) Gecko/20100101 Firefox/49.0',
//            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
//        }
//    };
//
//    function requestCallback(error, response, body) {
//        if (!error && response.statusCode == 200) {
//            var isCalledCallback = false;
//
//             //console.log('---------------------------------------------');
//             //console.log(body);
//             //console.log('---------------------------------------------');
//
//            var parser = new htmlparser.Parser({
//                onopentag: function(name, attribs){
//                    if (attribs.href != undefined && attribs.role == undefined){
//                        // console.log(asoKeyRank + ' ' + attribs.href);
//                        var aso100Params = attribs.href.split('/');
//                        var aso100AppId = aso100Params[4];
//                        if(aso100AppId == appId){
//                            // console.log('find aso ' + key + ' rank ' + asoKeyRank);
//                            if(callback != undefined){
//                                isCalledCallback = true;
//                                callback(asoKeyRank, 0, '');
//                            }
//                        }else {
//                            asoKeyRank++;
//                            // console.log('asoKeyRank ', asoKeyRank);
//                            if(asoKeyRank > 1 && (asoKeyRank % 20 == 1)){
//                                if(asoKeyRank > maxAsoRank){
//                                    console.error('aso bigger than ' + maxAsoRank);
//                                    if(callback != undefined){
//                                        isCalledCallback = true;
//                                        callback(asoKeyRank, -1, '该关键词排名不在' + maxAsoRank + '名内');
//                                    }
//                                }else {
//                                    // console.log('----- aso100RankUrl ' + (page + 1));
//                                    isCalledCallback = true;
//                                    exports.aso100RankUrl(key, page + 1, appId, asoKeyRank, maxAsoRank, callback);
//                                }
//                            }
//                        }
//                    }
//                },
//                ontext: function(text){
//                    //console.log("--> ", text);
//                },
//                onclosetag: function(tagname){
//                    //console.log("**** ", tagname);
//                    if(tagname == "h4"){
//                        //console.log("That's it?!");
//                    }
//                }
//            }, {decodeEntities: true});
//            parser.write(body);
//            parser.end();
//
//            if(isCalledCallback == false){
//                isCalledCallback = true;
//                callback(asoKeyRank, -2, '你的App无该关键词');
//            }
//        }else {
//            callback(999, -100, '网络异常');
//        }
//    }
//
//    var asoRequest = require('request');
//    asoRequest(options, requestCallback);
//
//    // request.on('error', function(err) {
//    //     // Handle error
//    //     requestCallback(err, undefined, undefined);
//    // });
//};

var request = require('request');
exports.aso100RankUrl = function(appId, keyword, callback){
    var aso100RequestUrl = encodeURI('https://aso100.com/api/keywordSearchRankInfo?appid=' + appId + '&keyword=' + keyword + '&appkey=76595f8ef9a6e4e02d18116f48bf4744');

    //创建请求
    request(aso100RequestUrl,function(error, response, body){
        if (!error && response.statusCode == 200) {
            var bodyT =  JSON.parse(body);
            callback(bodyT.searchrank, bodyT.error_no, bodyT.error_msg);
        }else {
            callback(999, -100, '网络异常');
        }
    });
};

exports.planToReleaseTaskObject = function (tempPlanObject, asoKeyRank, needToBatchSaveObject) {
    var sendTaskUserObject = util.addLeanObject(tempPlanObject.get('userObject'), needToBatchSaveObject);

    var YCoinPerTask = exports.planCalculateYCoin(tempPlanObject, asoKeyRank);
    var RMBPerTask = exports.planCalculateRMB(tempPlanObject, asoKeyRank);
    var adsRMBPerTask = exports.planCalculateAdsUserRMB(tempPlanObject, asoKeyRank);

    //看看钱是否够用
    var taskCountPerDay = tempPlanObject.get('taskCountPerDay');
    var costPlanMoney = (taskCountPerDay * adsRMBPerTask);
    //0.2元是小数点误差
    if(sendTaskUserObject.get('cashMoney') >= costPlanMoney - 0.2){
        //开始投放，计费扣钱
        //若任务未全部完成，取消剩余任务，返还钱
        //投放全部结束后，可以一次性计算被超时任务，返还钱

        //计算消耗的钱
        tempPlanObject = util.addLeanObject(tempPlanObject, needToBatchSaveObject);
        tempPlanObject.set('deliverSucceedReason',  util.dateToString(new Date(), false) + '投放' + taskCountPerDay + '条任务成功, 消耗' + costPlanMoney.toFixed(2) + '元(若任务未全部完成，次日退还剩余钱)');
        var sendTaskUserObject = util.addLeanObject(tempPlanObject.get('userObject'), needToBatchSaveObject);
        sendTaskUserObject.increment('cashMoney', -costPlanMoney);

        //移除失败
        tempPlanObject.unset('deliverErrorReason');

        var refundMessage = messager.cashMoneyUsedForPlan(costPlanMoney, tempPlanObject, sendTaskUserObject);
        util.addLeanObject(refundMessage, needToBatchSaveObject);

        //开始发布任务！
        var taskType = tempPlanObject.get('taskType');
        var releaseTask = new integralWallTaskObjectSQL();
        releaseTask.set('planObject', tempPlanObject);

        releaseTask.set('userObject', sendTaskUserObject);  //和用户表关联
        var appObject = tempPlanObject.get('appObject');
        releaseTask.set('appObject', appObject);  //和用户表关联

        releaseTask.set('taskType', taskType);  // 任务类型
        releaseTask.set('searchKeyword', tempPlanObject.get('asoKey'));  // 搜索关键词
        releaseTask.set('ranKing', asoKeyRank);  // 排名
        releaseTask.set('bundleId', appObject.get('bundleId'));  // 排名

        //releaseTask.set('needGet', tempPlanObject.get('needGet') == 'needGet'); // 获取

        //if(taskType == '评论' && tempPlanObject.get('comment4G') == 'comment4G'){
        //    releaseTask.set('detailRem', '需要4G评论(评论截图须有4G标记)');
        //}

        releaseTask.set('adsRMBPerTask', adsRMBPerTask);  //广告主支付单价
        releaseTask.set('excUnitPrice', YCoinPerTask);  //任务单价
        releaseTask.set('rateUnitPrice', YCoinPerTask); // 汇率后价格,实际显示价格
        releaseTask.set('myRate', 1); // 汇率
        releaseTask.set('tempUserUnitPrice', RMBPerTask); // 小马用户任务价格
        //new
        //if (tempPlanObject.get('formalCheck') == 'formalCheck'){
        //    releaseTask.set('formalCheck', 'formalCheck');
        //}

        if (tempPlanObject.get('needThird') == 'needThird'){
            releaseTask.set('registerStatus', 'third');
        }else {
            releaseTask.set('registerStatus', 'noNeed');
        }

        //use excUniqueCode now,latestReleaseDate just for display
        releaseTask.set('latestReleaseDate', appObject.get('latestReleaseDate'));
        releaseTask.set('excUniqueCode', appObject.get('excUniqueCode'));
        //releaseTask.set('sendPlatform', '小马'); // 任务发布的平台

        //额外字段
        releaseTask.set('taskTotalCount', taskCountPerDay);  // 任务条数
        releaseTask.set('remainCount', taskCountPerDay); // 剩余条数
        //releaseTask.set('completed', 0);  // 完成

        var myDate = new Date();
        var myDateStr = myDate.getFullYear() + '-' + (parseInt(myDate.getMonth())+1) + '-' + myDate.getDate();
        releaseTask.set('releaseDate', myDateStr); // 添加发布日期,冗余字段

        //发布任务数据准备结束
        tempPlanObject.set('lastIntegralWallTaskObject', releaseTask);
        //!!!
        //保存 tempPlanObject 的同时也保存了 releaseTask，所以无需额外保存
        // util.addLeanObject(releaseTask, needToBatchSaveObject);

        return true;
    }else {
        tempPlanObject = util.addLeanObject(tempPlanObject, needToBatchSaveObject);
        tempPlanObject.set('deliverErrorReason', '账户余额不足,请及时充值(投放' + taskCountPerDay + '条任务需要' + costPlanMoney.toFixed(2) + '元)');
        return false;
    }
};

exports.planToRelTaskObject = function (tempPlanObject, asoKeyRank, needToBatchSaveObject) {
    var sendTaskUserObject = util.addLeanObject(tempPlanObject.get('userObject'), needToBatchSaveObject);

    var YCoinPerTask = exports.planCalculateYCoin(tempPlanObject, asoKeyRank);
    var RMBPerTask = exports.planCalculateRMB(tempPlanObject, asoKeyRank);
    var adsRMBPerTask = exports.planCalculateAdsUserTotalMoney(tempPlanObject, asoKeyRank);

    //看看钱是否够用
    var taskCountPerDay = tempPlanObject.get('taskCountPerDay');
    var costPlanMoney = (taskCountPerDay * tempPlanObject.get('excUnitPrice'));
    //0.2元是小数点误差
    if(sendTaskUserObject.get('totalMoney') >= costPlanMoney){
        //开始投放，计费扣钱
        //若任务未全部完成，取消剩余任务，返还钱
        //投放全部结束后，可以一次性计算被超时任务，返还钱

        ////计算消耗的钱
        tempPlanObject = util.addLeanObject(tempPlanObject, needToBatchSaveObject);
        tempPlanObject.set('deliverSucceedReason',  util.dateToString(new Date(), false) + '投放' + taskCountPerDay + '条任务成功, 消耗' + costPlanMoney.toFixed(2) + '元(若任务未全部完成，次日退还剩余钱)');
        var sendTaskUserObject = util.addLeanObject(tempPlanObject.get('userObject'), needToBatchSaveObject);
        sendTaskUserObject.increment('totalMoney', -costPlanMoney);
        sendTaskUserObject.increment('freezingMoney', costPlanMoney);

        //移除失败
        tempPlanObject.unset('deliverErrorReason');

        var refundMessage = messager.cashMoneyUsedForPlan(costPlanMoney, tempPlanObject, sendTaskUserObject);
        util.addLeanObject(refundMessage, needToBatchSaveObject);

        //开始发布任务！
        var taskType = tempPlanObject.get('taskType');
        var releaseTask = new releaseTaskObject();
        releaseTask.set('planObject', tempPlanObject);

        releaseTask.set('userObject', sendTaskUserObject);  //和用户表关联
        var appObject = tempPlanObject.get('appObject');
        releaseTask.set('appObject', appObject);  //和用户表关联
        releaseTask.set('bundleId', appObject.get('bundleId'));

        releaseTask.set('taskType', taskType);  // 任务类型
        releaseTask.set('searchKeyword', tempPlanObject.get('asoKey'));  // 搜索关键词
        releaseTask.set('ranKing', asoKeyRank);  // 排名

        releaseTask.set('needGet', tempPlanObject.get('needGet') == 'needGet'); // 获取

        if(taskType == '评论' && tempPlanObject.get('comment4G') == 'comment4G'){
            releaseTask.set('detailRem', '需要4G评论(评论截图须有4G标记)');
        }

        releaseTask.set('adsRMBPerTask', adsRMBPerTask);  //广告主支付单价
        releaseTask.set('excUnitPrice', tempPlanObject.get('excUnitPrice'));  //任务单价
        releaseTask.set('rateUnitPrice', tempPlanObject.get('excUnitPrice')); // 汇率后价格,实际显示价格
        releaseTask.set('myRate', 1); // 汇率
        releaseTask.set('tempUserPrice', RMBPerTask); // 小马用户任务价格
        releaseTask.set('Score', parseInt(tempPlanObject.get('Score')));  // 评分
        releaseTask.set('needMoreReviewContent', tempPlanObject.get('needMoreReviewContent'));
        //new
        if (tempPlanObject.get('formalCheck') == 'formalCheck'){
            releaseTask.set('formalCheck', 'formalCheck');
        }

        if (tempPlanObject.get('needThird') == 'needThird'){
            releaseTask.set('registerStatus', 'third');
        }else {
            releaseTask.set('registerStatus', 'noNeed');
        }

        if(taskType == '评论'){
            //releaseTask.set('Score', 5);  // 评分
            releaseTask.set('sendPlatform', '野马'); // 任务发布的平台
            releaseTask.set('titleKeyword', tempPlanObject.get('commentKeys')); // 标题关键字
            releaseTask.set('commentKeyword', tempPlanObject.get('commentContentKeys')); // 评论关键字
        }

        if (taskType == '定制评论'){
            //releaseTask.set('Score', 5);  // 评分
            releaseTask.set('sendPlatform', '小马'); // 任务发布的平台
            releaseTask.set('reviewHeaderOptions', tempPlanObject.get('reviewHeaderOptions'));  // 备选标题
            releaseTask.set('reviewContentOptions', tempPlanObject.get('reviewContentOptions'));  // 备选内容
        }

        if (taskType == '下载'){
            releaseTask.set('sendPlatform', '野马'); // 任务发布的平台
        }

        if (tempPlanObject.get('sendType') == 'timer'){
            releaseTask.set('timer', true);
        }

        //use excUniqueCode now,latestReleaseDate just for display
        releaseTask.set('latestReleaseDate', appObject.get('latestReleaseDate'));
        releaseTask.set('excUniqueCode', appObject.get('excUniqueCode'));

        //额外字段
        releaseTask.set('excCount', taskCountPerDay);  // 任务条数
        releaseTask.set('remainCount', taskCountPerDay); // 剩余条数
        releaseTask.set('completed', 0);  // 完成
        releaseTask.set('yeMa', 'yeMa');

        var myDate = new Date();
        var myDateStr = myDate.getFullYear() + '-' + (parseInt(myDate.getMonth())+1) + '-' + myDate.getDate();
        releaseTask.set('releaseDate', myDateStr); // 添加发布日期,冗余字段

        //发布任务数据准备结束
        tempPlanObject.set('lastReleaseTask', releaseTask);

        //每日任务
        if( myDate.getHours() < 10)
        {
            util.dayTaskIncrement(tempPlanObject.get('userObject').id, 'releaseTaskY', taskCountPerDay > 5 ? 5 : taskCountPerDay);
        }

        return true;
    }else {
        tempPlanObject = util.addLeanObject(tempPlanObject, needToBatchSaveObject);
        tempPlanObject.set('deliverErrorReason', '账户余额不足,请及时充值(投放' + taskCountPerDay + '条任务需要' + costPlanMoney.toFixed(2) + '元)');
        return false;
    }
};