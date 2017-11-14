/**
 * Created by wujiangwei on 16/5/4.
 */

var AV = require('leanengine');

var util = require('./routes/util');
var IOSAppInfoSQL = AV.Object.extend('IOSAppInfo');
var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var receiveTaskObject = AV.Object.extend('receiveTaskObject'); // 领取任务的库
var releaseTaskObject = AV.Object.extend('releaseTaskObject'); // 发布任务库
var mackTaskInfoObject = AV.Object.extend('mackTaskInfo'); // 做单条任务的库
var lotteryRecordSQL = AV.Object.extend('lotteryRecord');
var lotteryPoolSQL = AV.Object.extend('lotteryPool');

var messager = require('./utils/messager');
var tryPriceUtil = require('./utils/tryPriceUtil');

var leanObjectRedis = require('./utils/leanObjectRedis');

//小马
var YCoinToRMBRate = parseFloat(process.env.smallHorseYCoinToRMB) || 0.04;

//前多少次徒弟任务获得指定的钱
var masterRMBPreCount = parseInt(process.env.smallHorseMasterRMBPreCount) || 20;
//前多少次徒弟任务获得指定的钱(多少钱)
var masterRMBPreRMB = parseFloat(process.env.smallHorseMasterRMBPreRMB) || 0.5;
//师徒获取Y币比率
var masterRMBRate = parseFloat(process.env.smallHorseMasterRMBRate) || 0.1;

//手动跑服务器代码
var manualYemaTask = 0;
var manualYemaReceiveTask = 0;
var manualXiaomaTask = 0;

/**
 * 根据环境变量动态控制何时跑定时器
 */
var yemaTimerDay = process.env.yemaTimerDay || '1,2,3,4,5,6,0';

function isNeedRunTimer() {
    var currentDate = new Date();
    var yemaTimerDays = yemaTimerDay.split(',');
    var currentDay = currentDate.getDay();
    for (var i = 0; i < yemaTimerDays.length; i++){
        if(currentDay === parseInt(yemaTimerDays[i])){
            return true;
        }
    }

    return false;
}

//保证接口的幂等性是极度重要的

/**
 * 获取制定时间的date
 * negative offDay means future
 * !!!
 * if(offDay == 0)
 *      pointerHour is off pointerHour
 */
function getPointerTimer(offDay, pointerHour) {
    if(debugYemaTask == 1 || debugXiaomaTask == 1 || debugYemaReceiveTask == 1){
        return new Date();
    }

    var nowTimestamp = new Date().getTime();

    var pointerDayTimestamp;
    var pointerDayDate;
    if(offDay == 0){
        pointerDayTimestamp = nowTimestamp - (1000*60*60*pointerHour);
        pointerDayDate = new Date(pointerDayTimestamp);
    }else {
        pointerDayTimestamp = nowTimestamp - (1000*60*60*24*offDay);
        pointerDayDate = new Date(pointerDayTimestamp);
        pointerDayDate.setHours(pointerHour);
    }

    return pointerDayDate;
}

/**
 * 定时器更新日志
 * （2016-10-22 by JiangWei Wu）
 * 定时器重构：野马定时器分成2个 —— 处理领取任务未完成 && 处理提交任务超时未处理
 * 定时器重构：野马 小马定时器分开来处理 —— 解锁2个模块独立的任务逻辑
 * 定时器重构：从完成任务的SQL中进行相关的逻辑处理
 * 定时器重构：移除锁机制，单线程批量处理任务
 * 定时器重构：完成接口的幂等性！（任务状态 —— 金钱结算 —— 流水系统）
 *
 * 任务状态更新：
 * refused 任务状态更新为：被拒绝了，但是仍然可以重新完成的任务！
 * doneRefused TODO:新任务状态：被拒绝了，但是无法重新完成的任务
 *             此时立马释放任务条数（小马）
 *             此时立马释放任务条数（野马）
 *
 * 任务SQL优化 —— 小马师徒系统
 * 任务SQL里将记录小马用户的师傅，以及师徒之前的关系数据，可以直接查询进行相关的修改
 */

/**
 * 小马彩票下注锁定定时器
 * 在每天下午5:30, 用户无法再进行新的投注
 * 1. 系统自动生成新的奖池和中奖号码
 * 2. 旧的奖池被锁定
 * 3. 用户无法下注
 */
AV.Cloud.define('xiaomaLotteryFreezeTimmer', function(request, response){
    freezeTimer(response);
});

function freezeTimer(response) {
    var oldLotteryPool = new AV.Query(lotteryPoolSQL);
    oldLotteryPool.equalTo('expired', false);
    oldLotteryPool.equalTo('revealed', false);
    oldLotteryPool.equalTo('open', true);
    oldLotteryPool.find().then(function(results) {
        if (results.length > 1 || results.length == 0) {
            console.log('error');
        }
        else {
            oldLotteryPool.set('expired', true);
            oldLotteryPool.set('open', false);
            oldLotteryPool.save();
        }

        var newLotteryPool = new lotteryPoolSQL();
        var newResult = Math.ceil(Math.random()*9);
        newLotteryPool.set('result', newResult);
        newLotteryPool.save().then(function() {
            response.success('小马彩票锁定成功');
        });
    })
}

//var response;
//freezeTimer(response);

/**
 * 小马彩票开奖定时器
 * 在每天下午6:00
 * 1. 正式公布今天的开奖号码
 * 2. 对中奖用户进行奖励
 * 3. 对中奖用户名单进行公示
 * 4. 用户可以下注
 */
AV.Cloud.define('xiaomaLotteryRevealTimer', function(request, response){
    revealTimer(response);
});

function revealTimer(response) {
    var oldLotteryPool = new AV.Query(lotteryPoolSQL);
    oldLotteryPool.equalTo('expired', true);
    oldLotteryPool.equalTo('revealed', false);
    oldLotteryPool.equalTo('open', false);
    oldLotteryPool.include('pool');
    oldLotteryPool.include('result');
    oldLotteryPool.find().then(function(results){
        if (results.length > 1 || results.length == 0) {
            console.log(error);
            return;
        }
        var oldPool = results[0];
        var pool = oldPool.get('pool');
        var result = oldPool.get('result');
        oldPool.set('revealed', true);
        oldPool.save().then(function() {
            var lotteryRecordQuery = new AV.Query(lotteryRecordSQL);
            lotteryRecordQuery.equalTo('expired', false);
            lotteryRecordQuery.greaterThanOrEqualTo(String(result), 1);
            lotteryRecordQuery.include(String(result));
            lotteryRecordQuery.include('tempUserObject');
            lotteryRecordQuery.find().then(function(results){
                var winners = results.length;
                oldPool.set('totalWinners', winners);
                oldPool.save();//异步存储.不需要有lock
                if (winners == 0) {
                    console.log('no winner');
                    var newLotteryPool = new AV.Query(lotteryPoolSQL);
                    newLotteryPool.equalTo('open', false);
                    newLotteryPool.equalTo('revealed', false);
                    newLotteryPool.equalTo('expired', false);
                    newLotteryPool.find().then(function(results){
                        if (results > 1) {
                            return;
                        }
                        var newPool = results[0];
                        newPool.set('open', true);
                        newPool.set('yesterdayResult', result);
                        newPool.save().then(function(){
                            response.success('小马彩票开奖解锁成功');
                        })
                    })
                }
                var winnersRewarded = 0;
                var moneyWon = pool / winners;
                for (var i = 0; i < winners; i++) {
                    var bid = results[i];

                    function reward(bid) {
                        var bidsBought = bid.get(result);
                        var totalMoneyWon = moneyWon * bidsBought;
                        bid.set('expired', true);
                        bid.save().then(function() {
                            var winnerUserObject = bid.get('tempUserObject');
                            winnerUserObject.increment('totalMoney', totalMoneyWon);
                            winnerUserObject.increment('currentMoney', totalMoneyWon);
                            winnerUserObject.save().then(function() {
                                winnersRewarded++;
                                if (winnersRewarded == winners) {
                                    //锁结束
                                    console.log('end of the lock');
                                    var newLotteryPool = new AV.Query(lotteryPoolSQL);
                                    newLotteryPool.equalTo('open', false);
                                    newLotteryPool.equalTo('revealed', false);
                                    newLotteryPool.equalTo('expired', false);
                                    newLotteryPool.find().then(function(results){
                                        if (results > 1) {
                                            return;
                                        }
                                        var newPool = results[0];
                                        newPool.set('open', true);
                                        newPool.set('yesterdayResult', result);
                                        newPool.save().then(function(){
                                            response.success('小马彩票开奖解锁成功');
                                        })
                                    })
                                }
                            })
                        })
                    }
                    reward(bid)
                }
            })
        })
    }).catch(function(){
    })
}

//var response;
//revealTimer(response);

/**
 * 野马定时器(暂不包含领取任务未做的情况)
 * 1.自动接受1天前下午6点前创建的任务（uploaded/ReUploaded）-----> (systemAccepted)
 *   自动结算领取任务时任务的Y币给双方
 *   TODO 微信通知（发布任务者）—— 及时审核新提交/重做（拒绝）的任务
 * 2.自动超时1天前下午6点前创建的任务（refused）-----> (expired),同时增加领取任务超时个数
 *   退还给发布者发布任务的Y币，领取任务的人不能再重新完成该任务了
 *   TODO 微信通知（完成任务者）—— 及时重新做被拒绝的任务
 */
AV.Cloud.define('yemaTaskTimer', function(request, response){

    if(isNeedRunTimer() == false){
        console.log('-------------------------------');
        console.log('not need run timer(yema) today');
        console.log('-------------------------------');
        response.success('yema task timer success');
        return;
    }

    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('---------------- yema (uploaded/reUploaded/refused) timer start ----------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');

    yemaAutoAcceptExpiredTask(0, response);
});

function yemaAutoAcceptExpiredTask(dealIndex, response) {
    var batchDealTaskCount = 100;

    var yemaDoTaskQuery = new AV.Query(mackTaskInfoObject);
    //前一日下午6点前提交的任务
    yemaDoTaskQuery.lessThanOrEqualTo('createdAt', getPointerTimer(1, 18));
    yemaDoTaskQuery.exists('doTaskUser');
    yemaDoTaskQuery.containedIn('taskStatus', ['uploaded', 'reUploaded']);

    var yemaDoTaskRefusedQuery = new AV.Query(mackTaskInfoObject);
    //前一日下午6点前拒绝的任务
    yemaDoTaskRefusedQuery.lessThanOrEqualTo('updatedAt', getPointerTimer(1, 16));
    yemaDoTaskRefusedQuery.exists('doTaskUser');
    yemaDoTaskRefusedQuery.equalTo('taskStatus', 'refused');
    yemaDoTaskRefusedQuery.notEqualTo('canRedo', 0);
    yemaDoTaskRefusedQuery.doesNotExist('revokeObject');

    yemaDoTaskQuery = AV.Query.or(yemaDoTaskQuery, yemaDoTaskRefusedQuery);

    yemaDoTaskQuery.limit(batchDealTaskCount);
    yemaDoTaskQuery.include('doTaskUser');
    yemaDoTaskQuery.include('appObject');
    yemaDoTaskQuery.include('releaseTaskUser');
    yemaDoTaskQuery.include('releaseTaskObject');
    yemaDoTaskQuery.include('receiveTaskObject');
    yemaDoTaskQuery.include('receiveTaskObject.appObject');
    yemaDoTaskQuery.descending('createdAt');

    var needSaveLeanObject = Array();

    function yemaDoTaskResponseSucceed() {
        console.log('******************************************************************************************');
        console.log('******************************************************************************************');
        console.log('-------------------- yema (uploaded/reUploaded/refused) timer --------------------');
        console.log(dealIndex + ' yemaAutoAcceptExpiredTask succeed with deal task count ' + (dealIndex * batchDealTaskCount));
        console.log('-------------------- uploaded/reUploaded/refused task --------------------');
        console.log('******************************************************************************************');
        console.log('******************************************************************************************');

        response.success('yema do task timer success');
    }

    yemaDoTaskQuery.find().then(function(results){

        if(results.length == 0){
            yemaDoTaskResponseSucceed();
            return;
        }

        for(var i = 0; i < results.length; i++){
            //结算钱
            var doTaskObject = results[i];

            var releaseTaskUser = util.addLeanObject(doTaskObject.get('releaseTaskUser'), needSaveLeanObject);
            var taskObject = doTaskObject.get('releaseTaskObject');
            var doTaskUser = util.addLeanObject(doTaskObject.get('doTaskUser'), needSaveLeanObject);
            var receTaskObject = doTaskObject.get('receiveTaskObject');

            //野马领取任务时的价格
            //兼容老版本，若无领取任务时的价格，以发布任务的单价为准
            var rateUnitPrice = receTaskObject.get('rateUnitPrice');
            if(rateUnitPrice == undefined){
                rateUnitPrice = taskObject.get('rateUnitPrice');
            }
            //野马发布任务的价格
            var excUnitPrice = taskObject.get('excUnitPrice');
            //app信息
            var appObject = doTaskObject.get('appObject');
            if(appObject == undefined){
                //兼容老版本
                appObject = receTaskObject.get('appObject');
            }
            var trackName = appObject.get('trackName') + '(' + appObject.get('version') + ')';

            var tempDoTaskObject = util.addLeanObject(doTaskObject, needSaveLeanObject);
            if(tempDoTaskObject.get('taskStatus') == 'refused'){
                //更改任务状态 expired
                tempDoTaskObject.set('taskStatus', 'expired');

                //任务超时个数增加
                receTaskObject.increment('expiredCount', 1);
                if(taskObject.get('yeMa') == 'yeMa'){
                    //解锁发布任务的人的YB
                    releaseTaskUser.increment('freezingMoney', -excUnitPrice);
                    releaseTaskUser.increment('totalMoney', excUnitPrice);
                    var refusedExpiresMessages = '您的任务（' + trackName + '）对方(' + doTaskUser.get('username') + ')被拒绝后未重新提交';
                    var refusedExpiredMessageObject = messager.unfreezeMsg(refusedExpiresMessages, excUnitPrice, releaseTaskUser.id, releaseTaskUser);
                    util.addLeanObject(refusedExpiredMessageObject, needSaveLeanObject);
                    console.log('****** refused task be expired by timer ****** release task user : ' + releaseTaskUser.id + '(minus freeze YB,add total YB) +' + excUnitPrice);
                }else {
                    //广告主不解冻Y币，解冻现金账户
                    var costMoney = taskObject.get('adsRMBPerTask');
                    releaseTaskUser.increment('cashMoney', costMoney);
                    var refusedExpiresMessages = '您的任务（' + trackName + '）对方(' + doTaskUser.get('username') + ')被拒绝后未重新提交';
                    var refusedExpiredMessageObject = messager.refundMoneyMessage(costMoney, taskObject.get('planObject'), releaseTaskUser, refusedExpiresMessages);
                    util.addLeanObject(refusedExpiredMessageObject, needSaveLeanObject);
                    console.log('****** refused task be expired by timer ****** release task user : ' + releaseTaskUser.id + '(退款) +' + costMoney);
                }

            }else {
                //更改任务状态 auto accept
                tempDoTaskObject.set('taskStatus', 'systemAccepted');

                //增加做任务人的钱
                doTaskUser.increment('totalMoney', rateUnitPrice);
                var doTaskMessages = '(' + releaseTaskUser.get('username') + ')超时未审核,系统自动接受了您提交的任务(' + trackName + ')结果';
                var doTaskMessageObject = messager.earnMsg(doTaskMessages, rateUnitPrice, doTaskUser.id, doTaskUser);
                util.addLeanObject(doTaskMessageObject, needSaveLeanObject);
                console.log('****** task be accept by timer ****** do task user ' + doTaskUser.id + '(add total YB) +' + rateUnitPrice);

                //扣除发布任务人的冻结钱
                //new: 广告主的不扣除
                if(taskObject.get('yeMa') == 'yeMa'){
                    releaseTaskUser.increment('freezingMoney', -excUnitPrice);
                    var releaseTaskMessages = '您超时未审核,系统自动接受了（' + doTaskUser.get('username') + '）提交的任务(' + trackName + ')结果';
                    var releaseTaskMessageObject = messager.payMsg(releaseTaskMessages, excUnitPrice, releaseTaskUser.id, releaseTaskUser);
                    util.addLeanObject(releaseTaskMessageObject, needSaveLeanObject);
                    console.log('****** task be accept by timer ****** release task user : ' + releaseTaskUser.id + '(minus freeze YB) -' + rateUnitPrice);
                }else {
                    //广告主已经付过钱，不在支付相关的Y币
                }

            }
        }

        if(needSaveLeanObject.length > 0){
            AV.Object.saveAll(needSaveLeanObject).then(function () {

                if(results.length == batchDealTaskCount){
                    yemaAutoAcceptExpiredTask(dealIndex++, response);
                }else {
                    yemaDoTaskResponseSucceed();
                }

                // if timer out(leancloud limit time)
                // response.success('yema task timer success');
            }, function (error) {
                console.error('--------------------------------------------------------------------------------');
                console.error('--------------------------------------------------------------------------------');
                console.error('-------------------- yema (uploaded/reUploaded/refused) timer --------------------');
                console.error(dealIndex + ' yemaAutoAcceptExpiredTask save error ' + error.message);
                console.error('-------------------- uploaded/reUploaded/refused task --------------------');
                console.error('--------------------------------------------------------------------------------');
                console.error('--------------------------------------------------------------------------------');
            });
        }

    }, function (error) {
        console.error('--------------------------------------------------------------------------------');
        console.error('--------------------------------------------------------------------------------');
        console.error('-------------------- yema (uploaded/reUploaded/refused) timer --------------------');
        console.error(dealIndex + ' yemaAutoAcceptExpiredTask query error ' + error.message);
        response.error('yema task timer failed');
        console.error('-------------------- uploaded/reUploaded/refused task --------------------');
        console.error('--------------------------------------------------------------------------------');
        console.error('--------------------------------------------------------------------------------');
    });
}

/**
 * 野马定时器(领取任务超时未做的情况)
 * 1.每隔1个小时检查一次领取任务完成的情况
 *   检查时间前6小时的任务如果未做，会被自动释放掉
 *   TODO 微信通知（领取任务者）—— 及时完成领取的任务
 * 2.移除扣罚Y币系统
 * 3.新增任务信誉系统
 *   User中增加任务信誉（100）
 *   用户一次性最多领取5条任务，每降低8个信誉，降低领取任务上限1条，60个信誉以下，无法领取任务
 *   每成功完成一个任务信誉+1，审核一个任务信誉+1（手动审核）
 *   领取任务未做 信誉-2
 *   任务被拒绝 信誉-1
 */
AV.Cloud.define('yemaReceiveTaskTimer', function(request, response){

    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('-------------------- yema receive timer for undo task start --------------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');

    yemaDealReceiveTask(0, response);
});

function yemaDealReceiveTask(batchIndex, response) {
    var batchDealTaskCount = 100;

    // receiveRemainCount
    var yemaReceiveQuery = new AV.Query(receiveTaskObject);
    //前一日下午6点前提交的任务
    yemaReceiveQuery.greaterThan('receiveRemainCount', 0);
    yemaReceiveQuery.exists('userObject');
    yemaReceiveQuery.notEqualTo('close', true);
    yemaReceiveQuery.lessThanOrEqualTo('createdAt', getPointerTimer(0, 6));
    yemaReceiveQuery.ascending('createdAt');
    yemaReceiveQuery.include('userObject');
    yemaReceiveQuery.limit(batchDealTaskCount);

    var needSaveLeanObject = Array();

    function yemaReceiveResponseSucceed() {
        console.log('******************************************************************************************');
        console.log('******************************************************************************************');
        console.log('-------------------- yema (receive task) timer --------------------');
        console.log(batchIndex + ' yemaDealReceiveTask succeed with deal task count ' + (batchIndex * batchDealTaskCount));
        console.log('-------------------- yema (receive task) timer end --------------------');
        console.log('******************************************************************************************');
        console.log('******************************************************************************************');
    }

    yemaReceiveQuery.find().then(function(results){

        if(results.length == 0){
            yemaReceiveResponseSucceed();
            response.success('yema receive task timer success with no count deal');
            return;
        }

        for(var i = 0; i < results.length; i++) {
            var receiveRemainCount = results[i].get('receiveRemainCount');
            if(receiveRemainCount > 0){
                var receiveTaskObject = util.addLeanObject(results[i], needSaveLeanObject);
                var receiveUserObject = util.addLeanObject(receiveTaskObject.get('userObject'), needSaveLeanObject);
                var releaseTask = util.addLeanObject(receiveTaskObject.get('taskObject'), needSaveLeanObject);

                //修改领取任务的数据
                var receiveRemainCount = receiveTaskObject.get('receiveRemainCount');
                receiveTaskObject.increment('receiveCount', -receiveRemainCount);
                receiveTaskObject.set('receiveRemainCount', 0);

                //修改发布任务的剩余条数(释放)
                releaseTask.increment('remainCount', receiveRemainCount);

                //更新redis信息
                leanObjectRedis.releaseRedisTask(releaseTask.id, receiveTaskObject.get('userObject').id, receiveRemainCount);

                //扣除领取任务的人的信誉积分
                receiveUserObject.set('reputation', 100);
                receiveUserObject.increment('reputation', -(5 * receiveRemainCount));
            }
        }

        if(needSaveLeanObject.length > 0){
            AV.Object.saveAll(needSaveLeanObject).then(function () {
                if(results.length == batchDealTaskCount){
                    yemaDealReceiveTask(batchIndex++, response);
                }else {
                    yemaReceiveResponseSucceed();
                }

                // if timer out(leancloud limit time)
                // response.success('yema task timer success');
            }, function (error) {
                console.error('--------------------------------------------------------------------------------');
                console.error('--------------------------------------------------------------------------------');
                console.error('-------------------- yema (uploaded/reUploaded/refused) timer --------------------');
                console.error(batchIndex + ' yemaAutoAcceptExpiredTask save error ' + error.message);
                response.error('yema receive task timer error' + error.message);
                console.error('-------------------- uploaded/reUploaded/refused task --------------------');
                console.error('--------------------------------------------------------------------------------');
                console.error('--------------------------------------------------------------------------------');
            });
        }

    }, function (error) {
        console.error('--------------------------------------------------------------------------------');
        console.error('--------------------------------------------------------------------------------');
        console.error('-------------------- yema (uploaded/reUploaded/refused) timer --------------------');
        console.error(batchIndex + ' yemaAutoAcceptExpiredTask save error ' + error.message);
        response.error('yema receive task timer error' + error.message);
        console.error('-------------------- uploaded/reUploaded/refused task --------------------');
        console.error('--------------------------------------------------------------------------------');
        console.error('--------------------------------------------------------------------------------');
    })
}

/**
 * 小马定时器（野马试玩平台）
 * 1.自动接受2天前下午6点前创建的任务（uploaded/ReUploaded）-----> (systemAccepted)
 *   自动结算
 *   TODO 微信通知（发布任务者）—— 及时审核新提交/重做（拒绝）的任务
 * 2.自动超时1天前下午6点前创建的任务（refused）-----> (expired),同时增加领取任务超时个数
 *   退还给发布者发布任务的Y币，领取任务的人不能再重新完成该任务了
 *   TODO 微信通知（完成任务者）—— 及时重新做被拒绝的任务
 */
AV.Cloud.define('xiaomaTaskTimer', function(request, response){

    if(isNeedRunTimer() == false){
        console.log('-------------------------------');
        console.log('not need run timer(xiaoma) today');
        console.log('-------------------------------');
        response.success('xiaoma task timer success');
        return;
    }

    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------- xiaoma (uploaded/reUploaded/refused) timer start ---------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');

    xiaomaAutoAcceptExpiredTask(0, response);
});

function xiaomaAutoAcceptExpiredTask(dealIndex, response) {
    var batchDealTaskCount = 100;
    var xiaomaDoTaskQuery = new AV.Query(mackTaskInfoObject);
    //前一天早上10点前创建的任务
    xiaomaDoTaskQuery.lessThanOrEqualTo('createdAt', getPointerTimer(2, 18));
    xiaomaDoTaskQuery.exists('tempUserObject');
    xiaomaDoTaskQuery.containedIn('taskStatus', ['uploaded', 'reUploaded']);

    var xiaomaDoTaskRefusedQuery = new AV.Query(mackTaskInfoObject);
    //前一日下午6点前拒绝的任务
    xiaomaDoTaskRefusedQuery.lessThanOrEqualTo('updatedAt', getPointerTimer(1, 18));
    xiaomaDoTaskRefusedQuery.exists('tempUserObject');
    xiaomaDoTaskRefusedQuery.equalTo('taskStatus', 'refused');
    xiaomaDoTaskRefusedQuery.notEqualTo('canRedo', 0);

    xiaomaDoTaskQuery = AV.Query.or(xiaomaDoTaskQuery, xiaomaDoTaskRefusedQuery);
    xiaomaDoTaskQuery.limit(batchDealTaskCount);
    xiaomaDoTaskQuery.include('tempUserObject');
    xiaomaDoTaskQuery.include('tempMasterUserObject');
    xiaomaDoTaskQuery.include('mentorObject');

    xiaomaDoTaskQuery.include('releaseTaskUser');
    xiaomaDoTaskQuery.include('releaseTaskObject');
    xiaomaDoTaskQuery.include('appObject');
    xiaomaDoTaskQuery.include('receiveTaskObject');
    xiaomaDoTaskQuery.include('receiveTaskObject.appObject');
    xiaomaDoTaskQuery.descending('createdAt');

    var needSaveLeanObjectXiaoma = Array();

    //xiaoma RMB Logic
    var myDate = new Date();
    var month = (myDate.getMonth() + 1).toString();
    var day = myDate.getDate().toString();
    var yearStr = myDate.getFullYear().toString();
    var todayStr = yearStr + '-' + month + '-' + day;

    function xiaomaResponseSucceed() {
        console.log('********************************************************************************');
        console.log('********************************************************************************');
        console.log('-------------------- xiaoma (uploaded/reUploaded/refused) timer --------------------');
        console.log(dealIndex + ' xiaomaAutoAcceptExpiredTask succeed with deal task count ' + (dealIndex * batchDealTaskCount));
        console.log('-------------------- uploaded/reUploaded/refused task --------------------');
        console.log('********************************************************************************');
        console.log('********************************************************************************');

        response.success('xiaoma task timer success');
    }

    xiaomaDoTaskQuery.find().then(function(results){

        if(results.length == 0){
            xiaomaResponseSucceed();
            return;
        }

        for(var i = 0; i < results.length; i++){
            //结算钱
            var doTaskObject = results[i];

            var releaseTaskUser = util.addLeanObject(doTaskObject.get('releaseTaskUser'), needSaveLeanObjectXiaoma);
            var taskObject = doTaskObject.get('releaseTaskObject');
            var doTaskUser = util.addLeanObject(doTaskObject.get('tempUserObject'), needSaveLeanObjectXiaoma);
            var receTaskObject = doTaskObject.get('receiveTaskObject');
            if(receTaskObject == undefined || doTaskUser == undefined){
                console.error('receTaskObject is undefine,do task is ' + doTaskObject.id);
                continue;
            }

            //小马用户领取任务时的价格
            //兼容老版本，若无领取任务时的价格，以发布任务的单价为准
            var tempUserPrice = receTaskObject.get('tempUserPrice');
            if(tempUserPrice == undefined){
                tempUserPrice = taskObject.get('tempUserPrice');
            }
            //野马发布任务的价格
            var excUnitPrice = taskObject.get('excUnitPrice');
            if(excUnitPrice == undefined){
                excUnitPrice = taskObject.get('rateUnitPrice');
                if(excUnitPrice == undefined){
                    console.error(taskObject.id + ' rateUnitPrice is undefined');
                    excUnitPrice = 0;
                }
            }
            //app信息
            var appObject = doTaskObject.get('appObject');
            if(appObject == undefined){
                //兼容老版本
                appObject = receTaskObject.get('appObject');
            }
            var trackName = appObject.get('trackName') + '(' + appObject.get('version') + ')';

            var tempDoTaskObject = util.addLeanObject(doTaskObject, needSaveLeanObjectXiaoma);
            if(tempDoTaskObject.get('taskStatus') == 'refused'){
                //更改任务状态 expired
                tempDoTaskObject.set('taskStatus', 'expired');

                //任务超时个数增加
                receTaskObject.increment('expiredCount', 1);
                //解锁发布任务的人的YB
                if(taskObject.get('yeMa') == 'yeMa') {
                    releaseTaskUser.increment('freezingMoney', -excUnitPrice);
                    releaseTaskUser.increment('totalMoney', excUnitPrice);
                    var refusedExpiresMessages = '您的任务（' + trackName + '）对方(' + doTaskUser.get('userCodeId') + ')被拒绝后未重新提交';
                    var refusedExpiredMessageObject = messager.unfreezeMsg(refusedExpiresMessages, excUnitPrice, releaseTaskUser.id, releaseTaskUser);
                    util.addLeanObject(refusedExpiredMessageObject, needSaveLeanObjectXiaoma);
                    console.log('****** refused task be expired by timer ****** release task user : ' + releaseTaskUser.id + '(minus freeze YB,add total YB) +' + excUnitPrice);
                }else {
                    //广告主不解冻Y币，解冻现金账户
                    var costMoney = taskObject.get('adsRMBPerTask');
                    releaseTaskUser.increment('cashMoney', costMoney);
                    var refusedExpiresMessages = '您的任务（' + trackName + '）对方(' + doTaskUser.get('userCodeId') + ')被拒绝后未重新提交';
                    var refusedExpiredMessageObject = messager.refundMoneyMessage(costMoney, taskObject.get('planObject'), releaseTaskUser, refusedExpiresMessages);
                    util.addLeanObject(refusedExpiredMessageObject, needSaveLeanObjectXiaoma);
                    console.log('****** refused task be expired by timer ****** release task user : ' + releaseTaskUser.id + '(退款) +' + costMoney);
                }
            }else {
                //更改任务状态 auto accept
                tempDoTaskObject.set('taskStatus', 'systemAccepted');

                //增加做小马用户的钱
                //是不是今天
                var isToday = true;
                var todayMoneyDate = doTaskUser.get('todayMoneyDate');
                if (todayMoneyDate != todayStr) {
                    //非当天赚到的钱
                    isToday = false;
                }

                var tempUserGetRMB = 0;
                if (tempUserPrice > 0) {
                    tempUserGetRMB = tempUserPrice;
                } else {
                    tempUserGetRMB = excUnitPrice * YCoinToRMBRate;
                    tempUserGetRMB = parseInt(tempUserGetRMB * 100)/100;
                }

                //增加用户的钱(总额,可用,今日)
                doTaskUser.increment('taskCount', 1);
                doTaskUser.increment('totalMoney', tempUserGetRMB);
                doTaskUser.increment('currentMoney', tempUserGetRMB);
                if (isToday == true) {
                    doTaskUser.increment('todayMoney', tempUserGetRMB);
                } else {
                    //更新日期到最新
                    doTaskUser.set('todayMoneyDate', todayStr);
                    doTaskUser.increment('todayMoney', tempUserGetRMB);
                }
                console.log('****** task be accept by timer ------ temp do task user ' + doTaskUser.get('userCodeId') + '(add total RMB) +' + tempUserGetRMB);


                //增加小马用户师傅的钱
                var masterUserObject = util.addLeanObject(doTaskObject.get('tempMasterUserObject'), needSaveLeanObjectXiaoma);
                if(masterUserObject != undefined){
                    var masterRewards;

                    //计算师傅奖励
                    var mentorObject = util.addLeanObject(doTaskObject.get('mentorObject'), needSaveLeanObjectXiaoma);
                    mentorObject.increment('taskCount', 1);
                    if(mentorObject.get('taskCount') <= masterRMBPreCount){
                        masterRewards = masterRMBPreRMB;
                    }else {
                        masterRewards = tempUserGetRMB * masterRMBRate;
                        masterRewards = parseInt(masterRewards * 100)/100;
                    }

                    var isToday = true;
                    var todayMoneyDate = masterUserObject.get('todayMoneyDate');
                    if (todayMoneyDate != todayStr) {
                        //非当天赚到的钱
                        isToday = false;
                    }

                    //增加师父的钱(总额,可用,今日)
                    masterUserObject.increment('apprenticeTaskCount', 1);
                    masterUserObject.increment('totalMoney', masterRewards);
                    masterUserObject.increment('currentMoney', masterRewards);
                    masterUserObject.increment('apprenticeMoney', masterRewards);
                    if (isToday == true) {
                        masterUserObject.increment('todayMoney', masterRewards);
                        console.log('****** small horse ------ master add RMB(today) ' + masterUserObject.get('userCodeId') + '(add total RMB) +' + masterRewards);
                    } else {
                        //更新日期到最新
                        masterUserObject.set('todayMoneyDate', todayStr);
                        masterUserObject.set('todayMoney', masterRewards);
                        console.log('****** small horse ------ master add RMB(first today) ' + masterUserObject.get('userCodeId') + '(add total RMB) +' + masterRewards);
                    }

                    // 徒弟为师傅赚多少钱
                    tempDoTaskObject.set('tempMasterUserMoney', masterRewards);
                }

                //扣除发布任务人的冻结钱
                if(taskObject.get('yeMa') == 'yeMa'){
                    releaseTaskUser.increment('freezingMoney', -excUnitPrice);
                    var releaseTaskMessages = '您超时未审核,系统自动接受了（' + doTaskUser.get('userCodeId') + '）提交的任务(' + trackName + ')结果';
                    var releaseTaskMessageObject = messager.payMsg(releaseTaskMessages, excUnitPrice, releaseTaskUser.id, releaseTaskUser);
                    util.addLeanObject(releaseTaskMessageObject, needSaveLeanObjectXiaoma);
                    console.log('****** task be accept by timer ****** release task user : ' + releaseTaskUser.id + '(minus freeze YB) -' + excUnitPrice);
                }else {
                    //野马广告主，已经支付了相关的钱，不再去进行账户扣费
                }

            }
        }

        if(needSaveLeanObjectXiaoma.length > 0){
            AV.Object.saveAll(needSaveLeanObjectXiaoma).then(function () {
                if(results.length == batchDealTaskCount){
                    xiaomaAutoAcceptExpiredTask(dealIndex++, response);
                }else {
                    xiaomaResponseSucceed();
                }
                // if timer out(leancloud limit time)
                // response.success('xiaoma task timer success');
            }, function (error) {
                console.error('--------------------------------------------------------------------------------');
                console.error('--------------------------------------------------------------------------------');
                console.error('-------------------- xiaoma (uploaded/reUploaded/refused) timer --------------------');
                console.error(dealIndex + ' xiaomaAutoAcceptExpiredTask save error ' + error.message);
                console.error('-------------------- uploaded/reUploaded/refused task --------------------');
                console.error('--------------------------------------------------------------------------------');
                console.error('--------------------------------------------------------------------------------');
            });
        }

    }, function (error) {
        console.error('--------------------------------------------------------------------------------');
        console.error('--------------------------------------------------------------------------------');
        console.error('-------------------- xiaoma (uploaded/reUploaded/refused) timer --------------------');
        console.error(dealIndex + ' xiaomaAutoAcceptExpiredTask query error ' + error.message);
        response.error('xiaoma task timer failed');
        console.error('-------------------- uploaded/reUploaded/refused task --------------------');
        console.error('--------------------------------------------------------------------------------');
        console.error('--------------------------------------------------------------------------------');
    });
}


//自助ASO优化平台 付费用户相关timer函数

//积分墙自动发布任务Timer
AV.Cloud.define('autoSendTaskTimer', function(request, response){
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------- yema ads module (auto send task) autoSendTaskTimer ---------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');

    var ASOPlanObjectSql = AV.Object.extend('ASOPlanObject');
    var ASOKeyRankSQL = AV.Object.extend('ASOKeyRankObject');

    var nowDate = new Date();

    //move to '' if not test
    var testPlanObjectIds = [];
    // var testPlanObjectIds = ['5829302e5bbb50004f1db121'];

    var planQuery = new AV.Query(ASOPlanObjectSql);
    //10天内创建的ASO优化方案
    //备注:hidden show 都是针对已经被完成的任务的操作
    if(testPlanObjectIds.length > 0){
        planQuery.containedIn('objectId', testPlanObjectIds);
    }
    planQuery.notContainedIn('planStatus', ['stop', 'hidden', 'show']);
    planQuery.notEqualTo('planDeliverStatus', 'planEnd');
    planQuery.notEqualTo('yeMa', 'yeMa');
    planQuery.include('lastIntegralWallTaskObject');
    planQuery.include('appObject');
    planQuery.include('userObject');
    planQuery.limit(1000);
    planQuery.descending('createdAt');
    planQuery.find().then(function(planObjects) {
        var needToBatchSaveObject = [];

        if(planObjects.length == 0){
            response.success('none plan need to execute');
            return;
        }

        var fuckingAutoTaskLockObject = {};
        fuckingAutoTaskLockObject.totalLock = planObjects.length;
        fuckingAutoTaskLockObject.locking = 0;
        for (var i = 0; i < planObjects.length; i++) {
            var planObject = planObjects[i];

            //计算该计划在不在执行时间内
            //calculate if task need send
            //1.在不在计划时间内
            var isNeedSendTask = false;
            planObject.taskHour = planObject.get('taskHour');
            planObject.delayTaskDay = planObject.get('delayTaskDay');
            planObject.taskLastDay = planObject.get('taskLastDay');
            //计算投放 开始时间 和 结束时间
            // 对于创建计划时间大于投放时间的，今天投放和明天投放是一个概念
            if(planObject.delayTaskDay == 0 && planObject.createdAt.getHours() > planObject.taskHour){
                // 次日才会开始投放
                planObject.delayTaskDay = 1;
            }
            planObject.createdAt.setHours(planObject.taskHour);
            planObject.createdAt.setMinutes(0);
            planObject.createdAt.setSeconds(0);
            planObject.createdAt.setMilliseconds(0);
            var dayMiniMi = 24*60*60*1000;
            var firstPlanActiveTime = planObject.createdAt.getTime() + planObject.delayTaskDay * dayMiniMi;
            var endPlanActiveTime = firstPlanActiveTime + (planObject.taskLastDay - 1)* dayMiniMi;

            //计算天数
            var nowTime = nowDate.getTime();
            var errorTime = 5*60*1000;//误差范围5分钟，因为定时器不是准时执行的
            if(nowTime >= (firstPlanActiveTime - errorTime) && nowTime <= (endPlanActiveTime + errorTime)){
                //在任务投放的时间内
                //看在那个小时么
                var nowMinutes = nowDate.getMinutes();
                if(nowMinutes > 50){
                    //next hour
                    if(planObject.taskHour == nowDate.getHours() + 1){
                        isNeedSendTask = true;
                    }
                }else if(nowMinutes < 10){
                    //now hour
                    if(planObject.taskHour == nowDate.getHours()){
                        isNeedSendTask = true;
                    }
                }
            }else if(nowTime > endPlanActiveTime + errorTime){
                //plan end
                planObject = util.addLeanObject(planObject, needToBatchSaveObject);
                planObject.set('planDeliverStatus', 'planEnd');
            }
            
            if(isNeedSendTask == true || testPlanObjectIds.length > 0){
                console.log('---------- plan ' + planObject.get('planName') + ' start to auto send');
                //获取排名(ASO100查询)
                (function (tempPlanObject) {
                    //处理前一日的计划
                    var lastReleaseTaskObject = tempPlanObject.get('lastIntegralWallTaskObject');
                    if(lastReleaseTaskObject != undefined && lastReleaseTaskObject.get('remainCount') > 0){
                        //前一日任务未完成，撤销任务，并且返回钱
                        lastReleaseTaskObject = util.addLeanObject(lastReleaseTaskObject, needToBatchSaveObject);
                        var toRemainCount = lastReleaseTaskObject.get('remainCount');
                        var taskPerRMB = lastReleaseTaskObject.get('taskPerRMB');
                        lastReleaseTaskObject.set('remainCount', 0);
                        lastReleaseTaskObject.increment('excCount', -toRemainCount);

                        //昨天
                        var yestodayTime = nowTime - dayMiniMi;
                        var yestodayDate = new Date(yestodayTime);

                        //方案投放消息和退款和记录退款消息
                        var refundMoney = toRemainCount * lastReleaseTaskObject.get('adsRMBPerTask');
                        tempPlanObject = util.addLeanObject(tempPlanObject, needToBatchSaveObject);
                        tempPlanObject.set('deliverErrorReason', util.dateToString(yestodayDate, false) + '有' + toRemainCount + '条任务未完成, 退还' + refundMoney.toFixed(2) + '元至您的现金账户(我们是不作弊试玩平台，我们会努力扩大下游用户，敬请谅解)');
                        var sendTaskUserObject = util.addLeanObject(tempPlanObject.get('userObject'), needToBatchSaveObject);
                        sendTaskUserObject.increment('cashMoney', refundMoney);

                        var refundMessage = messager.refundMoneyMessage(refundMoney, tempPlanObject, sendTaskUserObject, tempPlanObject.get('deliverErrorReason'));
                        util.addLeanObject(refundMessage, needToBatchSaveObject);
                    }

                    //投放新的计划
                    tryPriceUtil.aso100RankUrl(tempPlanObject.get('appleId'), tempPlanObject.get('asoKey'),
                        function (asoKeyRank, errorId, errorMsg) {
                            if(errorId != 0){
                                //实时排名获取失败，补救措施
                                if(lastReleaseTaskObject != undefined){
                                    asoKeyRank = lastReleaseTaskObject.get('ranKing');
                                }

                                if(asoKeyRank == undefined || asoKeyRank > 500){
                                    //手动更新的 排名
                                    asoKeyRank = tempPlanObject.get('manualRank');
                                }

                                if(asoKeyRank == undefined || asoKeyRank > 500){
                                    //初始排名
                                    asoKeyRank = tempPlanObject.get('startRanking');
                                }
                                tempPlanObject.set('deliverErrorReason', '获取排名错误: ' + errorMsg);
                            }

                            tryPriceUtil.planToReleaseTaskObject(tempPlanObject, asoKeyRank, needToBatchSaveObject);

                            fuckingAutoTaskLockObject.locking++;
                            console.log('auto send task lock log total ' + fuckingAutoTaskLockObject.totalLock + ' now locking ' + fuckingAutoTaskLockObject.locking);
                            if(fuckingAutoTaskLockObject.locking == fuckingAutoTaskLockObject.totalLock){
                                console.log('send task save data');
                                AV.Object.saveAll(needToBatchSaveObject).then(function () {
                                    console.log('auto send task succeed ,saved object length :', needToBatchSaveObject.length);
                                }, function (error) {
                                    console.error('auto send task(save release task) error : ', error.message);
                                    fuckingAutoTaskLockObject.locking++;
                                })
                            }
                        });

                })(planObject);
            }else {
                fuckingAutoTaskLockObject.locking++;
                // console.log('auto send task lock log total ' + fuckingAutoTaskLockObject.totalLock + ' now locking ' + fuckingAutoTaskLockObject.locking);
                if(fuckingAutoTaskLockObject.locking == fuckingAutoTaskLockObject.totalLock){
                    // response.success('plan execute succeed (else)');
                    console.log('send task save data');
                    AV.Object.saveAll(needToBatchSaveObject).then(function () {
                        console.log('auto send task succeed ,saved object length :', needToBatchSaveObject.length);
                    }, function (error) {
                        console.error('auto send task(save release task) error : ', error.message);
                        fuckingAutoTaskLockObject.locking++;
                    })
                }
            }
        }

        response.success('plan execute succeed (for)');
    }, function (error) {
        console.error('auto send task(query) error : ', error.message);
    })
});

//野马自动发布任务Timer
AV.Cloud.define('yemaAutoSendTaskTimer', function(request, response){
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------- yema ads module (auto send task) autoSendTaskTimer ---------------');
    console.log('--------------------------------------------------------------------------------');
    console.log('--------------------------------------------------------------------------------');

    var ASOPlanObjectSql = AV.Object.extend('ASOPlanObject');
    var ASOKeyRankSQL = AV.Object.extend('ASOKeyRankObject');

    var nowDate = new Date();

    //move to '' if not test
    var testPlanObjectIds = [];
    // var testPlanObjectIds = ['5829302e5bbb50004f1db121'];

    var planQuery = new AV.Query(ASOPlanObjectSql);
    //10天内创建的ASO优化方案
    //备注:hidden show 都是针对已经被完成的任务的操作
    if(testPlanObjectIds.length > 0){
        planQuery.containedIn('objectId', testPlanObjectIds);
    }
    planQuery.notContainedIn('planStatus', ['stop', 'hidden', 'show']);
    planQuery.notEqualTo('planDeliverStatus', 'planEnd');
    planQuery.equalTo('yeMa', 'yeMa');
    planQuery.include('lastReleaseTask');
    planQuery.include('appObject');
    planQuery.include('userObject');
    planQuery.limit(1000);
    planQuery.descending('createdAt');
    planQuery.find().then(function(planObjects) {
        var needToBatchSaveObject = [];

        if(planObjects.length == 0){
            response.success('none plan need to execute');
            return;
        }

        var fuckingAutoTaskLockObject = {};
        fuckingAutoTaskLockObject.totalLock = planObjects.length;
        fuckingAutoTaskLockObject.locking = 0;
        for (var i = 0; i < planObjects.length; i++) {
            var planObject = planObjects[i];

            //计算该计划在不在执行时间内
            //calculate if task need send
            //1.在不在计划时间内
            var isNeedSendTask = false;
            planObject.taskHour = planObject.get('taskHour');
            planObject.delayTaskDay = planObject.get('delayTaskDay');
            planObject.taskLastDay = planObject.get('taskLastDay');
            //计算投放 开始时间 和 结束时间
            // 对于创建计划时间大于投放时间的，今天投放和明天投放是一个概念
            if(planObject.delayTaskDay == 0 && planObject.createdAt.getHours() > planObject.taskHour){
                // 次日才会开始投放
                planObject.delayTaskDay = 1;
            }
            planObject.createdAt.setHours(planObject.taskHour);
            planObject.createdAt.setMinutes(0);
            planObject.createdAt.setSeconds(0);
            planObject.createdAt.setMilliseconds(0);
            var dayMiniMi = 24*60*60*1000;
            var firstPlanActiveTime = planObject.createdAt.getTime() + planObject.delayTaskDay * dayMiniMi;
            if (planObject.taskLastDay != undefined){
                var endPlanActiveTime = firstPlanActiveTime + (planObject.taskLastDay - 1)* dayMiniMi;
            }

            //计算天数
            var nowTime = nowDate.getTime();
            var errorTime = 5*60*1000;//误差范围5分钟，因为定时器不是准时执行的
            if(nowTime >= (firstPlanActiveTime - errorTime) && nowTime <= (endPlanActiveTime + errorTime)){
                //在任务投放的时间内
                //看在那个小时么
                var nowMinutes = nowDate.getMinutes();
                if(nowMinutes > 50){
                    //next hour
                    if(planObject.taskHour == nowDate.getHours() + 1){
                        isNeedSendTask = true;
                    }
                }else if(nowMinutes < 10){
                    //now hour
                    if(planObject.taskHour == nowDate.getHours()){
                        isNeedSendTask = true;
                    }
                }
            }else if(nowTime > endPlanActiveTime + errorTime){
                //plan end
                planObject = util.addLeanObject(planObject, needToBatchSaveObject);
                planObject.set('planDeliverStatus', 'planEnd');
            }

            if(isNeedSendTask == true || testPlanObjectIds.length > 0){
                console.log('---------- plan ' + planObject.get('planName') + ' start to auto send');
                //获取排名(ASO100查询)
                (function (tempPlanObject) {
                    //处理前一日的计划
                    var lastReleaseTaskObject = tempPlanObject.get('lastReleaseTask');
                    if(lastReleaseTaskObject != undefined && lastReleaseTaskObject.get('remainCount') > 0){
                        //前一日任务未完成，撤销任务，并且返回钱
                        lastReleaseTaskObject = util.addLeanObject(lastReleaseTaskObject, needToBatchSaveObject);
                        var toRemainCount = lastReleaseTaskObject.get('remainCount');
                        var taskPerRMB = lastReleaseTaskObject.get('taskPerRMB');
                        lastReleaseTaskObject.set('remainCount', 0);
                        lastReleaseTaskObject.increment('excCount', -toRemainCount);

                        //昨天
                        var yestodayTime = nowTime - dayMiniMi;
                        var yestodayDate = new Date(yestodayTime);

                        //方案投放消息和退款和记录退款消息
                        var refundMoney = toRemainCount * lastReleaseTaskObject.get('adsRMBPerTask');
                        tempPlanObject = util.addLeanObject(tempPlanObject, needToBatchSaveObject);
                        tempPlanObject.set('deliverErrorReason', util.dateToString(yestodayDate, false) + '有' + toRemainCount + '条任务未完成, 退还' + refundMoney.toFixed(2) + '元至您的现金账户(我们是不作弊试玩平台，我们会努力扩大下游用户，敬请谅解)');
                        var sendTaskUserObject = util.addLeanObject(tempPlanObject.get('userObject'), needToBatchSaveObject);
                        sendTaskUserObject.increment('totalMoney', refundMoney);

                        var refundMessage = messager.refundMoneyMessage(refundMoney, tempPlanObject, sendTaskUserObject, tempPlanObject.get('deliverErrorReason'));
                        util.addLeanObject(refundMessage, needToBatchSaveObject);
                    }

                    //投放新的计划
                    tryPriceUtil.aso100RankUrl(tempPlanObject.get('appleId'), tempPlanObject.get('asoKey'),
                        function (asoKeyRank, errorId, errorMsg) {
                            if(errorId != 0){
                                //实时排名获取失败，补救措施
                                if(lastReleaseTaskObject != undefined){
                                    asoKeyRank = lastReleaseTaskObject.get('ranKing');
                                }

                                if(asoKeyRank == undefined || asoKeyRank > 500){
                                    //手动更新的 排名
                                    asoKeyRank = tempPlanObject.get('manualRank');
                                }

                                if(asoKeyRank == undefined || asoKeyRank > 500){
                                    //初始排名
                                    asoKeyRank = tempPlanObject.get('startRanking');
                                }
                                tempPlanObject.set('deliverErrorReason', '获取排名错误: ' + errorMsg);
                            }

                            tryPriceUtil.planToRelTaskObject(tempPlanObject, asoKeyRank, needToBatchSaveObject);

                            fuckingAutoTaskLockObject.locking++;
                            console.log('auto send task lock log total ' + fuckingAutoTaskLockObject.totalLock + ' now locking ' + fuckingAutoTaskLockObject.locking);
                            if(fuckingAutoTaskLockObject.locking == fuckingAutoTaskLockObject.totalLock){
                                console.log('send task save data');
                                AV.Object.saveAll(needToBatchSaveObject).then(function () {
                                    console.log('auto send task succeed ,saved object length :', needToBatchSaveObject.length);
                                }, function (error) {
                                    console.error('auto send task(save release task) error : ', error.message);
                                    fuckingAutoTaskLockObject.locking++;
                                })
                            }
                        });

                })(planObject);
            }else {
                fuckingAutoTaskLockObject.locking++;
                // console.log('auto send task lock log total ' + fuckingAutoTaskLockObject.totalLock + ' now locking ' + fuckingAutoTaskLockObject.locking);
                if(fuckingAutoTaskLockObject.locking == fuckingAutoTaskLockObject.totalLock){
                    // response.success('plan execute succeed (else)');
                    console.log('send task save data');
                    AV.Object.saveAll(needToBatchSaveObject).then(function () {
                        console.log('auto send task succeed ,saved object length :', needToBatchSaveObject.length);
                    }, function (error) {
                        console.error('auto send task(save release task) error : ', error.message);
                        fuckingAutoTaskLockObject.locking++;
                    })
                }
            }
        }

        response.success('plan execute succeed (for)');
    }, function (error) {
        console.error('auto send task(query) error : ', error.message);
    })
});

//每个小时记录下，用户付费的ASO Key的排名变化情况
AV.Cloud.define('recordUserASOKeyRankTimer', function(request, response){

    var ASOKeyRankSQL = AV.Object.extend('ASOKeyRankObject');

    var query = new AV.Query(ASOKeyRankSQL);
    query.equalTo('isRoot', true);
    query.descending('updatedAt');

    query.find().then(function(ASOKeyRanks){
        for (var i = 0; i < ASOKeyRanks.length; i++){
            var ASOKeyRankObject = ASOKeyRanks[i];

            (function (asoKey, appleId, asoObject) {
                tryPriceUtil.aso100RankUrl(appleId, asoKey,
                    function (asoKeyRank, errorId, errorMsg) {
                        if(errorId == 0){
                            var ASORecordObject = new ASOKeyRankSQL();
                            ASORecordObject.set('rank', asoKeyRank);
                            ASORecordObject.set('asoKey', asoKey);
                            ASORecordObject.set('appleId', appleId);
                            ASORecordObject.set('asoObject', asoObject);
                            ASORecordObject.save();
                        }else {
                            console.error('time record app aso key(query) error : ', errorMsg);
                        }
                    });

            })(ASOKeyRankObject.get('asoKey'), ASOKeyRankObject.get('appleId'), ASOKeyRankObject)
        }

        response.success('aso key record rank success');
    },function(error){
        console.error('time record app aso key(query) error : ', error.message);
    });
});

//测试代码
var debugYemaTask = 0;
var debugYemaReceiveTask = 0;
var debugXiaomaTask = 0;
var debugAutXiaoma = 0;

var paramsJson = {
    movie: "夏洛特烦恼"
};

if(debugYemaTask == 1 || manualYemaTask == 1){
    AV.Cloud.run('yemaTaskTimer', paramsJson, {
        success: function(data) {
            // 调用成功，得到成功的应答data
            console.log('---- debug / manual yemaTaskTimer  timer: succeed');
        },
        error: function(err) {
            // 处理调用失败
            console.error('---- debug / manual yemaTaskTimer  timer: error ', err.message);
        }
    });
}

if(debugYemaReceiveTask == 1 || manualYemaReceiveTask == 1){
    AV.Cloud.run('yemaReceiveTaskTimer', paramsJson, {
        success: function(data) {
            // 调用成功，得到成功的应答data
            console.log('---- debug / manual yemaTaskTimer  timer: succeed');
        },
        error: function(err) {
            // 处理调用失败
            console.error('---- debug / manual yemaTaskTimer  timer: error ', err.message);
        }
    });
}

if(debugXiaomaTask == 1 || manualXiaomaTask == 1){
    AV.Cloud.run('xiaomaTaskTimer', paramsJson, {
        success: function(data) {
            // 调用成功，得到成功的应答data
            console.log('---- debug / manual xiaomaTaskTimer timer: succeed');
        },
        error: function(err) {
            // 处理调用失败
            console.error('---- debug / manual xiaomaTaskTimer timer: error ', err.message);
        }
    });
}

if (debugAutXiaoma == 1){
    AV.Cloud.run('yemaAutoSendTaskTimer', paramsJson, {
        success: function(data) {
            // 调用成功，得到成功的应答data
            console.log('---- autoSendTaskTimer: succeed');
        },
        error: function(err) {
            // 处理调用失败
            console.error('---- autoSendTaskTimer: error ', err.message);
        }
    });
}

////Promise test code
//var successful = new AV.Promise();
//successful.resolve('The good result.');
//
//var failed = new AV.Promise();
//failed.reject('An error message.');
//
//var successful = AV.Promise.as('The good result.');
//
//var failed = AV.Promise.error('An error message.');

//临时代码,修复string to int问题
//var query = new AV.Query('mackTaskInfo');
//query.descending('createdAt');
//query.include('appObject');
//query.limit(1000);
//query.skip(1000);
//query.find().then(function(results) {
//    for (var i = 0; i < results.length; i++) {
//        release_task_object = results[i];
//        var status = release_task_object.get('status');
//        if (status == 1){
//            release_task_object.set('taskStatus', 'uploaded');
//        }else if(status == 2){
//            release_task_object.set('taskStatus', 'refused');
//        }else {
//            release_task_object.set('taskStatus', 'accepted');
//        }
//
//        //release_task_object.set('receiveCountI', parseInt(release_task_object.get('receiveCount')));
//        //release_task_object.set('excCountI', parseInt(release_task_object.get('excCount')));
//        //release_task_object.set('ranKingI', parseInt(release_task_object.get('ranKing')));
//        //release_task_object.set('excUnitPriceI', parseInt(release_task_object.get('excUnitPrice')));
//
//        //release_task_object.set('receiveCount', release_task_object.get('receiveCountI'));
//        //release_task_object.set('excCount', release_task_object.get('excCountI'));
//        //release_task_object.set('ranKing', release_task_object.get('ranKingI'));
//        //release_task_object.set('excUnitPrice', release_task_object.get('excUnitPriceI'));
//    }
//
//    AV.Object.saveAll(results).then(function () {
//        console.log('---- fix bug: succeed')
//    }, function (error) {
//        console.log('---- fix bug: failed')
//    });
//});


/*********************************************************************************************************************************
 * **********************************************************************************************************************************
 * **********************************************************************************************************************************
 * **********************************************************************************************************************************
 * **********************************************************************************************************************************
 * **********************************************************************************************************************************
 * **********************************************************************************************************************************
 ***********************************************************************************************************************************/

/***********************************************************************************************************************************
 * Fix bug 脚本*
 * **********************************************************************************************************************************/

function fixFreezingYCoin(userObjects) {
    if(userObjects.length == 0){
        console.log('user freezing money fixed done');
        return;
    }
    var userObject = userObjects[0];
    userObject.set('freezingMoney', 0);

    //发布的任务数剩余条数的冻结Y币
    var releaseTaskQuery = new AV.Query(releaseTaskObject);
    releaseTaskQuery.equalTo('userObject', userObject);
    releaseTaskQuery.notEqualTo('close', true);
    releaseTaskQuery.greaterThan('remainCount', 0);
    releaseTaskQuery.limit(1000);
    releaseTaskQuery.find().then(function (releaseTasks) {
        console.log(userObject.get('username') + ' releaseTaskObject query count ' + releaseTasks.length);

        var remainTasksYCoin = 0;
        for (var i = 0; i < releaseTasks.length; i++){
            var releaseTaskObject = releaseTasks[i];
            console.log(releaseTaskObject.id + ' remain count ' + releaseTaskObject.get('remainCount') + ' price is ' + releaseTaskObject.get('excUnitPrice'));
            remainTasksYCoin += releaseTaskObject.get('excUnitPrice') * releaseTaskObject.get('remainCount');
        }

        //已经被领取的提交的任务，未审核的任务的Y币
        var doTaskQuery = new AV.Query(mackTaskInfoObject);
        doTaskQuery.equalTo('releaseTaskUser', userObject);
        doTaskQuery.containedIn('taskStatus', ['uploaded', 'reUploaded']);

        var doTaskQueryEx = new AV.Query(mackTaskInfoObject);
        doTaskQueryEx.equalTo('releaseTaskUser', userObject);
        doTaskQueryEx.equalTo('taskStatus', 'refused');
        doTaskQueryEx.notEqualTo('canRedo', 0);

        doTaskQuery = AV.Query.or(doTaskQuery, doTaskQueryEx);
        doTaskQuery.limit(1000);
        doTaskQuery.include('releaseTaskObject');

        doTaskQuery.find().then(function (doTasks) {
            console.log('undeal task number is ' + doTasks.length);

            for (var i = 0; i < doTasks.length; i++){
                var doTaskObject = doTasks[i];
                var inReleaseTaskObject = doTaskObject.get('releaseTaskObject');
                console.log(doTaskObject.id + ' undeal task (status is ' + doTaskObject.get('taskStatus') + ' ) Price is ' + inReleaseTaskObject.get('excUnitPrice'));
                remainTasksYCoin += inReleaseTaskObject.get('excUnitPrice');
            }

            userObject.increment('freezingMoney', remainTasksYCoin);
            var messageObject = messager.normalMessage('程序员哥哥连夜修复冻结Y币bug', '系统', userObject);

            AV.Object.saveAll([messageObject, userObject]).then(function () {
                console.log(userObject.get('username') + ' freezing YCoin fixed to ', userObject.get('freezingMoney'));

                userObjects.shift();
                fixFreezingYCoin(userObjects);
            }, function (error) {
                console.error('save user info and message error ', error.message);
            })

        }, function (error) {
            console.error('do task query error ', error.message);
        })

    }, function (error) {
        console.error('releaseTaskObject query error ', error.message);
    });
}

function getAllUser() {
    var userQuery = new AV.Query('_User');
    userQuery.descending('updatedAt');
    userQuery.limit(1000);
    userQuery.find().then(function (users) {
        fixFreezingYCoin(users);
    }, function (error) {
        console.error('find user list error ', error.message);
    })
}

// getAllUser();
