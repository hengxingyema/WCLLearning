/**
 * Created by cailong on 2017/1/11.
 */

var express = require('express');
var router = express.Router();
var util = require('./util');
var AV = require('leanengine');

var Base64 = require('../public/javascripts/vendor/base64').Base64;
var File = AV.Object.extend('_File');

var tryPriceUtil = require('../utils/tryPriceUtil');
var leanObjectRedis = require('../utils/leanObjectRedis');

//默认Y币转人名币汇率
var YCoinToRMBRate = parseFloat(process.env.smallHorseYCoinToRMB) || 0.04;

//小马领取任务超时时间
var tempTaskMaxTime = parseInt(process.env.smallHorseMaxTaskTime) || (1000*60*60*1);

var tempUserSQL = AV.Object.extend('tempUser');  // 小马用户的库
var mackTaskSQL = AV.Object.extend('mackTaskInfo'); // 上传截图的库
var receiveTaskSQL = AV.Object.extend('receiveTaskObject'); // 领取任务的库
var releaseTaskSQL = AV.Object.extend('releaseTaskObject'); // 发布任务的库
var integralWallTaskObjectSql = AV.Object.extend('integralWallTaskObject'); // 积分墙任务库
var ASOPlanObjectSQL = AV.Object.extend('ASOPlanObject');

// 获取快速任务大厅任务
router.get('/:userCId/:page', function(req, res){
    if(req.params.userCId == undefined || req.params.userCId.length < 15){
        var err = new Error('not register user');
        err.status = 404;
        res.render('error', {
            message: err.message || err,
            error: {}
        });
        return;
    }
    var userCId = Base64.decode(req.params.userCId);
    var page = req.params.page;

    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function(tempUserObject){
        var pageCount = 20;
        var doTaskQuery = new AV.Query(receiveTaskSQL);
        doTaskQuery.equalTo('tempUserObject', tempUserObject);
        //最新1000个即可(模糊精准)
        doTaskQuery.descending('createdAt');
        doTaskQuery.limit(1000);

        var releaseTaskQuery = new AV.Query(integralWallTaskObjectSql);
        releaseTaskQuery.doesNotMatchKeyInQuery('appObject', 'appObject', doTaskQuery);

        releaseTaskQuery.greaterThan('remainCount', 0);
        //add by wujiangwei
        var installedAppIds = tempUserObject.get('installedAppBundleIds');
        if(installedAppIds != undefined){
            releaseTaskQuery.notContainedIn('bundleId', installedAppIds);
        }
        //end
        releaseTaskQuery.include('appObject');
        releaseTaskQuery.skip(page * pageCount);
        releaseTaskQuery.limit(pageCount);
        releaseTaskQuery.descending('createdAt');
        releaseTaskQuery.descending('remainCount');

        releaseTaskQuery.find().then(function(taskInfo){
            var quickTaskArray = Array();
            for (var i = 0; i < taskInfo.length; i++){
                var taskDicObject = Object();
                // 任务详情
                taskDicObject.taskObjectId = taskInfo[i].id;
                taskDicObject.taskTotalCount = taskInfo[i].get('taskTotalCount');
                taskDicObject.remainCount = taskInfo[i].get('remainCount');
                taskDicObject.ranking = taskInfo[i].get('ranking');
                taskDicObject.searchKeyword = taskInfo[i].get('searchKeyword');
                taskDicObject.temUserUnitPrice = taskInfo[i].get('tempUserUnitPrice');

                // app信息
                var appInfoObject = taskInfo[i].get('appObject');
                taskDicObject.appIcon = appInfoObject.get('artworkUrl100');
                taskDicObject.trackName = appInfoObject.get('trackName');
                if(appInfoObject.get('formattedPrice') != '免费'){
                    taskDicObject.formattedPrice = appInfoObject.get('formattedPrice');
                }

                quickTaskArray.push(taskDicObject);
            }

            res.json({'errorId':0, 'errorMsg':'', 'quickTaskArray':quickTaskArray})
        },function(error){
            res.json({'errorId': error.code, 'message': error.message});
        })
    },function(error){
        res.json({'errorId': error.code, 'message': error.message});
    })

});

// 快速任务详情
router.get('/quick/:userCId/:taskId', function(req, res){
    if(req.params.userCId == undefined || req.params.userCId.length < 15){
        var err = new Error('not register user');
        err.status = 404;
        res.render('error', {
            message: err.message || err,
            error: {}
        });
        return;
    }

    var userCId = Base64.decode(req.params.userCId);
    var taskId = req.params.taskId;

    leanObjectRedis.fetchLeanObjectFromCache(taskId, 'integralWallTaskObject').then(function(integralWallTaskObject){
        var taskDetailDic = Object();

        //任务信息
        var inAppObject = integralWallTaskObject.get('appObject');
        leanObjectRedis.fetchLeanObjectFromCache(inAppObject.id, 'IOSAppInfo').then(function(appObject){
            // app信息
            taskDetailDic.appIcon = appObject.get('artworkUrl100');
            taskDetailDic.appleId = appObject.get('appleId');
            taskDetailDic.appName = appObject.get('trackName');
            var priceStr = appObject.get('formattedPrice');
            if(priceStr != '免费'){
                taskDetailDic.appPrice = priceStr;
            }

            // 任务信息
            taskDetailDic.searchKeyword = integralWallTaskObject.get('searchKeyword');
            taskDetailDic.temUserUnitPrice = integralWallTaskObject.get('tempUserUnitPrice');
            taskDetailDic.ranking = integralWallTaskObject.get('ranKing');
            taskDetailDic.bundleId = integralWallTaskObject.get('bundleId');

            taskDetailDic.tempTaskMaxTime = tempTaskMaxTime;

            //用户有没有接受过任务
            var tempUser = new tempUserSQL();
            tempUser.id = userCId;

            var receTaskQuery = new AV.Query(receiveTaskSQL);
            receTaskQuery.equalTo('tempUserObject', tempUser);
            receTaskQuery.equalTo('integralWallTaskObject', integralWallTaskObject);
            receTaskQuery.include('tempMackTask');
            receTaskQuery.descending('createdAt');

            receTaskQuery.find().then(function(receObjects){
                if(receObjects.length > 0){
                    //have lock task,need count down
                    taskDetailDic.lockTaskId = receObjects[0].id;
                    var doTaskCreatedAt = receObjects[0].createdAt.toLocaleDateString() + ' ' + receObjects[0].createdAt.toLocaleTimeString();
                    taskDetailDic.doTaskCreatedAt = doTaskCreatedAt;
                }

                res.json({'errorId': 0, 'message': '', 'taskDetail': taskDetailDic});

            }, function(error){
                res.json({'errorId': 0, 'message': 'get rece info error'});
            });
        }, function (error) {
            res.json({'errorId': error.code, 'message': error.message});
        });

    }, function(error){
        console.error('temp user get task info error:' + error.message);
        res.json({'errorId': error.code, 'message': error.message});
    });



});

//超时后核实锁定任务
function unlockTaskIfNeeded(){
    // console.log('********** execute time out for small horse task');
    var lockTaskId = arguments[0];
    return unlockTaskWithRes(lockTaskId, undefined);
}

function unlockTaskWithRes(lockTaskId, res){
    var receTaskQuery = new AV.Query(receiveTaskSQL);
    receTaskQuery.include('integralWallTaskObject');
    receTaskQuery.include('tempMackTask');
    // console.log('********** execute unlockTaskWithRes for task : ', lockTaskId);
    leanObjectRedis.fetchLeanObjectFromCache(lockTaskId, 'receiveTaskObject').then(function(receTaskObject){
        var taskObject = receTaskObject.get('integralWallTaskObject');
        var doTaskObject = receTaskObject.get('tempMackTask');
        if(doTaskObject == undefined){
            //任务超时未做
            taskObject.increment('remainCount', 1);

            //主动取消了任务(还可以做)
            //回退任务条数
            taskObject.save().then(function(){
                leanObjectRedis.releaseRedisTask(taskObject.id, receTaskObject.get('tempUserObject').id, 1);

                receTaskObject.destroy().then(function (success) {
                    console.log('********** unlockTaskWithRes destroy succeed', lockTaskId);
                    // 删除任务记录成功(下次还可以做)
                    if(res != undefined) {
                        res.json({'errorId': 0, 'message': 'unlock succeed'});
                    }
                }, function (error) {
                    // 删除失败
                    console.error('---------- manual unlock !!!!!!!!!! receive task destory error ' + receTaskObject.get('tempUserObject').id + ' unlock task ' + lockTaskId + ' failed');
                    if(res != undefined) {
                        res.json({'errorId': error.code, 'message': error.message});
                    }
                });
            }, function (error) {
                console.error('---------- manual unlock !!!!!!!!!! task save error ' + receTaskObject.get('tempUserObject').id + ' unlock task ' + lockTaskId + ' failed');
                if(res != undefined) {
                    res.json({'errorId': error.code, 'message': error.message});
                }
            });
        }else {
            //TODO: 思考被拒绝?
            if(res != undefined) {
                res.json({'errorId': -1, 'message': '任务不存在'});
            }

        }
    }, function (error) {
        if(res != undefined) {
            res.json({'errorId': error.code, 'message': error.message});
        }
    });
}

//放弃锁定任务
router.post('/unlockTask', function(req, res) {
    var lockTaskId = req.body.lockTaskId;
    unlockTaskWithRes(lockTaskId, res);
});

// 领取任务
router.post('/lockTask', function(req, res) {

    if(req.body.userCId == undefined || req.body.userCId.length < 15 || req.body.taskId.length < 15){
        var err = new Error('not register user');
        err.status = 404;
        res.render('error', {
            message: err.message || err,
            error: {}
        });
        return;
    }

    var userCId = Base64.decode(req.body.userCId);
    var taskObjectId = req.body.taskId;
    lockTask(userCId, taskObjectId, res);
});

function lockTask(userCId, taskObjectId, res) {
    var myDate = new Date();
    var myDateStr = myDate.getFullYear() + '-' + (parseInt(myDate.getMonth())+1) + '-' + myDate.getDate();

    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (tempUserObject) {

        if(tempUserObject.get('isBadUser') == true){
            res.json({'errorId': -101, 'message': '啊啊啊，任务没抢到呢'});
            return;
        }

        leanObjectRedis.fetchLeanObjectFromCache(taskObjectId, 'integralWallTaskObject').then(function (releTaskObject) {

            leanObjectRedis.fetchLeanObjectFromCache(releTaskObject.get('appObject').id, 'IOSAppInfo').then(function (appObject) {

                //后端效验
                var flag = true;
                var errorMsg = '';

                var tempUser = new tempUserSQL();
                tempUser.id = userCId;

                //1.不得重复领取同一任务
                //2.不得领取已经做过的App的任务
                var query = new AV.Query(receiveTaskSQL);
                query.equalTo('tempUserObject', tempUser);
                query.equalTo('appObject', appObject);

                query.include('integralWallTaskObject');
                query.descending('createdAt');
                query.find().then(function(results){

                    if (res != undefined && results.length > 0){
                        var doTaskCreatedAt = results[0].createdAt.toLocaleDateString() + ' ' + results[0].createdAt.toLocaleTimeString();
                        flag = false;
                        res.json({'errorId': 0, 'message': errorMsg, 'doTaskCreatedAt':doTaskCreatedAt});
                    }else {
                        //最多领取2条任务
                        var query = new AV.Query(receiveTaskSQL);
                        query.equalTo('tempUserObject', tempUser);
                        query.equalTo('expiredCount', 0);
                        query.doesNotExist('tempMackTask');
                        query.count().then(function(count){
                            //if(res != undefined && count >= 1){
                            //    errorMsg = "最多同时领取1条任务";
                            //    res.json({'errorId': -1, 'message': errorMsg});
                            //    return;
                            //}

                            var tempUserPrice = releTaskObject.get('temUserUnitPrice');
                            var appObject = releTaskObject.get('appObject');

                            //可以领取任务
                            //刷新缓存的remainCount
                            var remainCount = releTaskObject.get('remainCount');
                            remainCount = remainCount - 1;
                            if(remainCount < 0){
                                // console.log('temp user task get failed because of task done(new is)', remainCount);
                                if (res != undefined){
                                    errorMsg = "抱歉, 任务被别的用户抢走了";
                                    res.json({'errorId': -1, 'message': errorMsg});
                                }
                                return;
                            }

                            leanObjectRedis.seckillTask(taskObjectId, 'integralWallTaskObject', userCId, 1).then(function (redisDatas) {
                                //后端效验通过
                                var savedReleTaskObject = new integralWallTaskObjectSql();
                                savedReleTaskObject.id = taskObjectId;
                                savedReleTaskObject.increment('remainCount', -1);

                                var tempUser = new tempUserSQL();
                                tempUser.id = userCId;
                                var ReceiveTaskObject = new receiveTaskSQL();
                                ReceiveTaskObject.set('tempUserObject', tempUser);
                                ReceiveTaskObject.set('integralWallTaskObject', savedReleTaskObject);
                                ReceiveTaskObject.set('appObject', appObject);
                                ReceiveTaskObject.set('tempUserPrice', tempUserPrice);
                                ReceiveTaskObject.set('receiveDate', myDateStr);
                                ReceiveTaskObject.set('bundleId', releTaskObject.get('bundleId'));

                                ReceiveTaskObject.set('receiveCount', 1);
                                ReceiveTaskObject.set('receiveRemainCount', 1);

                                var needSavedTasks = [savedReleTaskObject, ReceiveTaskObject];

                                AV.Object.saveAll(needSavedTasks).then(function(avobjs){
                                    var receTaskObject;
                                    for (var i = 0; i < avobjs.length; i++){
                                        if(avobjs[i].get('tempUserObject') != undefined){
                                            receTaskObject = avobjs[i];
                                            break;
                                        }
                                    }

                                    setTimeout(unlockTaskIfNeeded, tempTaskMaxTime, receTaskObject.id);

                                    var doTaskCreatedAt = receTaskObject.createdAt.toLocaleDateString() + ' ' + receTaskObject.createdAt.toLocaleTimeString();

                                    if(res != undefined){
                                        res.json({'errorId': 0, 'message': 'lock task succeed', 'lockTaskId': receTaskObject.id,
                                             'doTaskCreatedAt': doTaskCreatedAt});
                                    }

                                }, function(error){
                                    if(res != undefined) {
                                        res.json({'errorId': error.code, 'message': error.message});
                                    }
                                });
                            },
                                function (error) {
                                    if(error.message.indexOf('抢完') >= 0){
                                        var savedReleTaskObject = new integralWallTaskObjectSql();
                                        savedReleTaskObject.id = taskObjectId;
                                        savedReleTaskObject.set('remainCount', 0);
                                        savedReleTaskObject.save();
                                        console.error('task small horse' + savedReleTaskObject.id + ' remain count > 0,but task is no remain, so set remain count 0');
                                    }

                                    // console.log(userCId + ' get task ' + taskObjectId + ' failed ', error.message);
                                    if(res != undefined) {
                                        res.json({'errorId': 1, 'message': error.message});
                                    }
                                });
                        }, function(error){
                            if(res != undefined) {
                                res.json({'errorId': error.code, 'message': error.message});
                            }
                        });
                    }
                });

            });

        });
    }, function (error) {
        if(res != undefined) {
            res.json({'errorId': error.code, 'message': error.message});
        }
    });
}

// 获取今日任务已经完成的
router.get('/:userCId', function(req, res){
    if(req.params.userCId == undefined || req.params.userCId.length < 15){
        var err = new Error('not register user');
        err.status = 404;
        res.render('error', {
            message: err.message || err,
            error: {}
        });
        return;
    }
    var userCId = Base64.decode(req.params.userCId);

    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (tempUserObject) {
        var myDate = new Date();
        var todayDate = myDate.getFullYear() + '-' + (myDate.getMonth() + 1) + '-' + myDate.getDate();

        var doTaskQuery = new AV.Query(integralWallTaskObjectSql);
        //最新1000个即可(模糊精准)
        doTaskQuery.descending('createdAt');
        doTaskQuery.limit(1000);

        var releaseTaskNeedGetQuery = new AV.Query(receiveTaskSQL);
        releaseTaskNeedGetQuery.matchesKeyInQuery('appObject', 'appObject', doTaskQuery);

        releaseTaskNeedGetQuery.equalTo('tempUserObject', tempUserObject);
        releaseTaskNeedGetQuery.include('appObject');
        releaseTaskNeedGetQuery.include('integralWallTaskObject');
        releaseTaskNeedGetQuery.include('taskObject');

        releaseTaskNeedGetQuery.find().then(function(datas){

            var retArray = Array();
            var ongoingTaskArray = Array();
            for(var i = 0; i < datas.length; i++){
                var taskDic = Object();
                var appObject = datas[i].get('appObject');
                var integralTaskObject = datas[i].get('integralWallTaskObject');

                // app信息
                taskDic.appIcon = appObject.get('artworkUrl100');
                if(appObject.get('formattedPrice') != '免费'){
                    taskDic.formattedPrice = appObject.get('formattedPrice');
                }

                var taskObject = datas[i].get('taskObject');

                var installedAppIds = tempUserObject.get('installedAppBundleIds');
                if(installedAppIds != undefined){
                    if (integralTaskObject.get('bundleId') in installedAppIds){
                        // 任务信息
                        if (integralTaskObject != undefined){
                            taskDic.taskId = integralTaskObject.id;
                            taskDic.searchKeyword = integralTaskObject.get('searchKeyword');

                            taskDic.taskType = integralTaskObject.get('taskType');

                            taskDic.remainCount = integralTaskObject.get('remainCount');
                            taskDic.bundleId = integralTaskObject.get('bundleId');

                            if (datas[i].get('receiveRemainCount') == 0){
                                retArray.push(taskDic);
                            }
                            else {
                                ongoingTaskArray.push(taskDic);
                            }
                        }
                        else {

                            if (taskObject != undefined){
                                taskDic.taskId = taskObject.id;
                                taskDic.searchKeyword = taskObject.get('searchKeyword');

                                taskDic.taskType = taskObject.get('taskType');

                                taskDic.remainCount = taskObject.get('remainCount');
                                taskDic.bundleId = taskObject.get('bundleId');
                                retArray.push(taskDic);
                            }

                        }
                    }
                }
                else {
                    // 任务信息
                    if (integralTaskObject != undefined){
                        taskDic.taskId = integralTaskObject.id;
                        taskDic.searchKeyword = integralTaskObject.get('searchKeyword');

                        taskDic.taskType = integralTaskObject.get('taskType');

                        taskDic.remainCount = integralTaskObject.get('remainCount');
                        taskDic.bundleId = integralTaskObject.get('bundleId');

                        if (datas[i].get('receiveRemainCount') == 0){
                            retArray.push(taskDic);
                        }
                        else {
                            ongoingTaskArray.push(taskDic);
                        }
                    }
                    else {
                        //var taskObject = datas[i].get('taskObject');
                        if (taskObject != undefined){
                            taskDic.taskId = taskObject.id;
                            taskDic.searchKeyword = taskObject.get('searchKeyword');

                            taskDic.taskType = taskObject.get('taskType');

                            taskDic.remainCount = taskObject.get('remainCount');
                            taskDic.bundleId = taskObject.get('bundleId');
                            retArray.push(taskDic);
                        }

                    }
                }

            }

            res.json({'errorId': 0, 'message': '', 'completeTasks': retArray, 'ongoingTaskArray':ongoingTaskArray});

        }, function(error){
            res.json({'errorId': error.code, 'message': error.message});
        });

        //task check

    }, function (error) {
        res.json({'errorId': error.code, 'message': error.message});
    });
});

// 即将开始的任务
router.post('/aboutToStart',function(req, res){
    //if(req.params.userCId == undefined || req.params.userCId.length < 15){
    //    var err = new Error('not register user');
    //    err.status = 404;
    //    res.render('error', {
    //        message: err.message || err,
    //        error: {}
    //    });
    //    return;
    //}

    var myDate = new Date();
    var todayDate = myDate.getFullYear() + '-' + (myDate.getMonth() + 1) + '-' + myDate.getDate();

    var query = new AV.Query(ASOPlanObjectSQL);
    query.equalTo('sendType', 'timer');
    query.notEqualTo('yeMa', 'yeMa');

    query.notEqualTo('planDeliverStatus', 'planEnd');
    //query.equalTo('dateOfDelivery', todayDate);
    query.include('appObject');
    query.ascending('createdAt');
    query.find().then(function(aboutToStartTaskObject){
        var aboutToStartTaskObjectArray = Array();
        var predictGetMoney = Array();
        var dayMiniMi = 24*60*60*1000;
        for (var i = 0; i < aboutToStartTaskObject.length; i++){
            var aboutToStartTaskObj = Object();

            //计算投放 开始时间 和 结束时间
            var createdAtTime = aboutToStartTaskObject[i].createdAt.getTime();
            var delayTaskDay = aboutToStartTaskObject[i].get('delayTaskDay');

            var firstPlanActiveTime = createdAtTime + delayTaskDay * dayMiniMi;
            var firstPlanActiveDate = new Date(firstPlanActiveTime);
            var endPlanActiveTime = firstPlanActiveTime + (aboutToStartTaskObject[i].get('taskLastDay') - 1)* dayMiniMi;
            var endPlanActiveDate = new Date(endPlanActiveTime);

            var firstDeliverDateString = util.dateToString(firstPlanActiveDate, true);
            var endDeliverDateString =  util.dateToString(endPlanActiveDate, true);

            if (todayDate >= firstDeliverDateString && todayDate <= endDeliverDateString ) {
                if (myDate.getHours() < aboutToStartTaskObject[i].get('taskHour')){
                    aboutToStartTaskObj.asoKey = aboutToStartTaskObject[i].get('asoKey');
                    aboutToStartTaskObj.startHour = aboutToStartTaskObject[i].get('taskHour');
                    aboutToStartTaskObj.remainCount = aboutToStartTaskObject[i].get('taskCountPerDay');
                    aboutToStartTaskObj.coltUserReceiveMoney = aboutToStartTaskObject[i].get('coltUserReceiveMoney');

                    aboutToStartTaskObjectArray.push(aboutToStartTaskObj);
                    predictGetMoney.push(aboutToStartTaskObject[i].get('coltUserReceiveMoney'));

                    console.log('当前时间' + todayDate + '在' + firstDeliverDateString + '至' + endDeliverDateString);
                }

            }

            else {
                console.error('当前时间' + todayDate + '不在' + firstDeliverDateString + '至' + endDeliverDateString);
            }
        }

        var value = eval(predictGetMoney.join("+"));

        res.json({'errorId':0, 'aboutToStartTaskObjectArray':aboutToStartTaskObjectArray, 'predictGetMoney':value})
    },function(error){
        res.json({'errorId': error.code, 'message': error.message});
    })
});

module.exports = router;