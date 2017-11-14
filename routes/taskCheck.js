/**
 * Created by tanghui on 16/7/14.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

var leanObjectRedis = require('../utils/leanObjectRedis');

var messager = require('../utils/messager');

var User = AV.Object.extend('_User');
var IOSAppSQL = AV.Object.extend('IOSAppInfo');
var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var releaseTaskObject = AV.Object.extend('releaseTaskObject');
var receiveTaskObject = AV.Object.extend('receiveTaskObject');
var mackTaskInfo = AV.Object.extend('mackTaskInfo');
var ASOPlanObjectSQL = AV.Object.extend('ASOPlanObject');

// var tempUserSQL = AV.Object.extend('tempUser');
var mentorRelationSQL = AV.Object.extend('mentorRelation');


var YCoinToRMBRate = parseFloat(process.env.smallHorseYCoinToRMB) || 0.04;

//前多少次徒弟任务获得指定的钱
var masterRMBPreCount = parseInt(process.env.smallHorseMasterRMBPreCount) || 20;
//前多少次徒弟任务获得指定的钱(多少钱)
var masterRMBPreRMB = parseFloat(process.env.smallHorseMasterRMBPreRMB) || 0.5;
//师徒获取Y币比率
var masterRMBRate = parseFloat(process.env.smallHorseMasterRMBRate) || 0.1;

router.get('/', function(req, res) {
    res.render('taskCheck');
});

// banner
// router.get('/banner', function(req, res){
//     var query = new AV.Query('bannerObject');
//     query.equalTo('close', true);
//     query.equalTo('bannerType', 'taskCheck');
//     query.find().then(function(bannerObject){
//         var bannerList = Array();
//         for (var i = 0; i < bannerObject.length; i++){
//             var bannerUrl = bannerObject[i].get('bannerURL');
//             bannerList.push(bannerUrl)
//         }
//         res.json({'bannerUrl': bannerList, 'errorId': 0, 'errorMsg':''})
//     },function(error){
//         res.json({'errorMsg':error.message, 'errorId': error.code});
//     })
// });


//*************页面左侧控制器条目*************************
router.get('/releaseTaskList/:appObjectId', function(req, res){
    var userId = util.useridInReq(req);
    var appObjectId = req.params.appObjectId;

    var user = new AV.User();
    user.id = userId;

    leanObjectRedis.fetchLeanObjectFromCache(userId, '_User').then(function(userObject){
        var query = new AV.Query(releaseTaskObject);
        query.equalTo('userObject', userObject);
        query.greaterThan('excCount', 0);

        if(appObjectId != 'all'){
            var appObject = new IOSAppSQL();
            appObject.id = appObjectId;
            query.equalTo('appObject', appObject);
        }

        var isSellerChan = userObject.get('isSellerChannel');
        if (isSellerChan == 'yangyang'){
            var queryA = new AV.Query(releaseTaskObject);
            queryA.equalTo('formalCheck', 'formalCheck');
            queryA.greaterThan('excCount', 0);

            query = AV.Query.or(query, queryA);
        }

        query.include('appObject');
        query.descending('createdAt');
        query.limit(1000);

        query.find().then(function(resultsObj){
            //release task list
            if (resultsObj == undefined || resultsObj.length == 0){
                res.json({'errorId': 0, 'errorMsg': '', 'taskAudit': []});
                return;
            }

            var retList = [];

            function getTaskDic(tempReleaseObject) {
                var tempDic = {};
                tempDic.taskId = tempReleaseObject.id;

                var appObject = tempReleaseObject.get('appObject');
                tempDic.trackName = appObject.get('trackName');
                tempDic.artworkUrl100 = appObject.get('artworkUrl100');

                tempDic.taskType = tempReleaseObject.get('taskType');
                tempDic.searchKeyword = tempReleaseObject.get('searchKeyword');
                tempDic.cancelled = tempReleaseObject.get('cancelled');

                tempDic.remainCount = tempReleaseObject.get('remainCount');
                tempDic.excCount = tempReleaseObject.get('excCount');
                //发布时间  任务状态
                tempDic.createdAt = tempReleaseObject.createdAt;
                tempDic.cancelled = tempReleaseObject.get('cancelled');

                return tempDic;
            }

            for(var i = 0; i < resultsObj.length; i++){
                var releaseObject = resultsObj[i];
                var retObject = {};
                retObject.taskIds = [];

                var releaseDate = releaseObject.get('releaseDate');

                var isExist = false;
                for (var j = 0; j < retList.length; j++){
                    var dealObject = retList[j];
                    if(dealObject.releaseDate == releaseDate){
                        isExist = true;
                        dealObject.tasks.push(getTaskDic(releaseObject));
                        dealObject.taskIds.push(releaseObject.id);
                    }
                }

                if(isExist == false){
                    retObject.releaseDate = releaseObject.get('releaseDate');
                    retObject.tasks = [getTaskDic(releaseObject)];
                    retObject.taskIds.push(releaseObject.id);

                    retObject.totalUploaded = 0;

                    retList.push(retObject);
                }
            }

            res.json({'errorMsg':'', 'errorId': 0, 'taskTimeList': retList});

        }, function (error) {
            res.json({'errorMsg':error.message, 'errorId': error.code});
        })
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });

});

// 定时任务左侧时间
router.get('/timer/:appObjectId', function(req, res){
    var userId = util.useridInReq(req);
    var appObjectId = req.params.appObjectId;

    var user = new AV.User();
    user.id = userId;

    leanObjectRedis.fetchLeanObjectFromCache(userId, '_User').then(function(userObject){
        var query = new AV.Query(ASOPlanObjectSQL);
        query.equalTo('userObject', userObject);
        query.equalTo('sendType', 'timer');
        query.equalTo('yeMa', 'yeMa');
        query.notEqualTo('planDeliverStatus', 'planEnd');

        if(appObjectId != 'all'){
            var appObject = new IOSAppSQL();
            appObject.id = appObjectId;
            query.equalTo('appObject', appObject);
        }

        //var isSellerChan = userObject.get('isSellerChannel');
        //if (isSellerChan == 'yangyang'){
        //    var queryA = new AV.Query(ASOPlanObjectSQL);
        //    queryA.equalTo('formalCheck', 'formalCheck');
        //
        //    query = AV.Query.or(query, queryA);
        //}

        query.include('appObject');
        query.descending('createdAt');
        query.limit(1000);

        query.find().then(function(resultsObj){
            //release task list
            if (resultsObj == undefined || resultsObj.length == 0){
                res.json({'errorId': 0, 'errorMsg': '', 'taskAudit': []});
                return;
            }

            var retList = [];

            function getTaskDic(tempReleaseObject) {
                var tempDic = {};
                tempDic.taskId = tempReleaseObject.id;

                var appObject = tempReleaseObject.get('appObject');
                tempDic.trackName = appObject.get('trackName');
                tempDic.artworkUrl100 = appObject.get('artworkUrl100');

                tempDic.taskType = tempReleaseObject.get('taskType');
                tempDic.searchKeyword = tempReleaseObject.get('asoKey');

                tempDic.excCount = tempReleaseObject.get('taskCountPerDay');
                //发布时间  任务状态
                tempDic.createdAt = tempReleaseObject.createdAt;
                tempDic.cancelled = tempReleaseObject.get('cancelled');

                return tempDic;
            }

            for(var i = 0; i < resultsObj.length; i++){
                var releaseObject = resultsObj[i];
                var retObject = {};
                retObject.taskIds = [];

                var releaseDateA = resultsObj[i].createdAt;

                var releaseDate = releaseDateA.getFullYear() + '-' + (releaseDateA.getMonth()+ 1) + '-' + releaseDateA.getDate();

                var isExist = false;
                for (var j = 0; j < retList.length; j++){
                    var dealObject = retList[j];
                    if(dealObject.releaseDate == releaseDate){
                        isExist = true;
                        dealObject.tasks.push(getTaskDic(releaseObject));
                        dealObject.taskIds.push(releaseObject.id);
                    }
                }

                if(isExist == false){
                    var dealDate = releaseObject.createdAt;
                    retObject.releaseDate = dealDate.getFullYear() + '-' + (dealDate.getMonth()+ 1) + '-' + dealDate.getDate();
                    retObject.tasks = [getTaskDic(releaseObject)];
                    retObject.taskIds.push(releaseObject.id);

                    retList.push(retObject);
                }
            }

            res.json({'errorMsg':'', 'errorId': 0, 'timerList': retList});

        }, function (error) {
            res.json({'errorMsg':error.message, 'errorId': error.code});
        })
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });

});

router.post('/releaseTaskOverview', function(req, res){
    // var userId = util.useridInReq(req);

    var taskIds = req.body.taskIds;
    var retApps = [];

    //第一个异步准备
    var promiseForReceive = taskIds.length;
    var counterForReceive = 0;

    function tryReturn(errorId, errorMsg){
        if (counterForReceive == promiseForReceive){
            retApps.sort(function(a, b){return (a.totalSubmited < b.totalSubmited)});
            res.json({'taskOverviewList':retApps,'errorId': errorId, 'errorMsg': errorMsg});
        }
    }

    var queryTask = new AV.Query(releaseTaskObject);
    queryTask.containedIn('objectId', taskIds);
    queryTask.include('appObject');
    queryTask.descending('createdAt');
    queryTask.limit(1000);
    queryTask.find().then(function(results){
        for (var i = 0; i < results.length; i++){

            //查询领取任务数据库
            (function(taskObject){

                var tempAppInfoObject = Object();
                tempAppInfoObject.taskId = taskObject.id;
                tempAppInfoObject.excCount = taskObject.get('excCount');

                var query = new AV.Query(receiveTaskObject);
                query.equalTo('taskObject', taskObject);
                query.greaterThan('receiveCount', 0);
                query.include('userObject');
                //小马
                query.include('tempUserObject');
                query.include('tempMackTask');

                query.descending('createdAt');
                query.limit(1000);
                query.find().then(function(results){

                    var promise = results.length;
                    var counter = 0;

                    tempAppInfoObject.totalAccepted = 0;
                    tempAppInfoObject.yemaAccepted = 0;
                    tempAppInfoObject.smallHorseAccepted = 0;

                    tempAppInfoObject.totalSubmited = 0;
                    tempAppInfoObject.yemaSubmited = 0;
                    tempAppInfoObject.smallHorseSubmited = 0;

                    tempAppInfoObject.totalUndo = 0;
                    tempAppInfoObject.yemaUndo = 0;
                    tempAppInfoObject.smallHorseUndo = 0;

                    tempAppInfoObject.totalRejected = 0;
                    tempAppInfoObject.yemaRejected = 0;
                    tempAppInfoObject.smallHorseRejected = 0;

                    tempAppInfoObject.totalTimeout = 0;//just yema

                    tempAppInfoObject.totalGetTask = 0;//all

                    tempAppInfoObject.totalSystemAccepted = 0;
                    tempAppInfoObject.yemaSystemAccepted = 0;
                    tempAppInfoObject.smallHorseSystemAccepted = 0;

                    tempAppInfoObject.smallHorseRefusedTimeout = 0;
                    tempAppInfoObject.yemaRefusedTimeout = 0;

                    if(results.length == 0){
                        retApps.push(tempAppInfoObject);
                        counterForReceive++;
                        tryReturn(0, '');
                        return;
                    }

                    for (var i = 0; i < results.length; i++) {
                        //receive task object

                        var user = results[i].get('userObject');
                        var tempUser = results[i].get('tempUserObject');

                        //小马用户领取的,并且超时,不计算为领取进度
                        if(user != undefined){
                            //野马换评系统
                            tempAppInfoObject.totalGetTask += results[i].get('receiveCount');
                            tempAppInfoObject.totalTimeout += results[i].get('expiredCount');
                            //具体做的任务信息
                            (function(receTaskObject){
                                var relation = receTaskObject.relation('mackTask');
                                var query = relation.query();
                                query.notEqualTo('canRedo', 0);
                                query.descending('createdAt');
                                query.include('revokeObject');
                                query.limit(1000);
                                query.find().then(function (datas) {

                                    for(var ii = 0; ii < datas.length; ii++){
                                        var mackObject = datas[ii];
                                        if(mackObject.get('taskStatus') == 'uploaded' || mackObject.get('taskStatus') == 'reUploaded'){
                                            tempAppInfoObject.totalSubmited++;
                                            tempAppInfoObject.yemaSubmited++;
                                        }else if(mackObject.get('taskStatus') == 'refused'){
                                            tempAppInfoObject.totalRejected++;
                                            tempAppInfoObject.yemaRejected++;
                                        }else if(mackObject.get('taskStatus') == 'accepted' || mackObject.get('taskStatus') == 'systemAccepted'){
                                            tempAppInfoObject.totalAccepted++;
                                            tempAppInfoObject.yemaAccepted++;
                                            if(mackObject.get('taskStatus') == 'systemAccepted'){
                                                tempAppInfoObject.totalSystemAccepted++;
                                                tempAppInfoObject.yemaSystemAccepted++;
                                            }
                                        }else if(mackObject.get('taskStatus') == 'expired'){
                                            tempAppInfoObject.yemaRefusedTimeout++;
                                        }
                                    }

                                    //野马里未做的任务
                                    //领取未做的任务
                                    if(receTaskObject.get('receiveRemainCount') != undefined){
                                        tempAppInfoObject.yemaUndo += receTaskObject.get('receiveRemainCount');
                                    }else {
                                        tempAppInfoObject.yemaUndo += receTaskObject.get('receiveCount') - (datas.length - tempAppInfoObject.yemaRefusedTimeout) - receTaskObject.get('expiredCount');
                                    }
                                    counter++;
                                    if (counter == promise){
                                        tempAppInfoObject.totalUndo = tempAppInfoObject.yemaUndo + tempAppInfoObject.smallHorseUndo;

                                        retApps.push(tempAppInfoObject);
                                        counterForReceive++;
                                        tryReturn(0, '');
                                    }
                                }, function(error){
                                    counter++;
                                    if (counter == promise){
                                        tempAppInfoObject.totalUndo = tempAppInfoObject.yemaUndo + tempAppInfoObject.smallHorseUndo;

                                        tempAppInfoObject.errorMsg = error.message;

                                        retApps.push(tempAppInfoObject);
                                        counterForReceive++;
                                        tryReturn(0, '');
                                    }
                                });
                            })(results[i]);
                        }
                        else if
                        (tempUser != undefined)
                        {
                            //小马系统领取的任务
                            if(results[i].get('expiredCount') > 0){
                                //小马超时任务(被拒绝后，未重新做)
                                //不存在领取未做超时的情况
                                tempAppInfoObject.totalTimeout += results[i].get('expiredCount');
                                tempAppInfoObject.smallHorseRefusedTimeout += results[i].get('expiredCount');
                            }else {
                                tempAppInfoObject.totalGetTask += results[i].get('receiveCount');
                                var mackObject = results[i].get('tempMackTask');
                                if(mackObject != undefined){
                                    if(mackObject.get('taskStatus') == 'uploaded' || mackObject.get('taskStatus') == 'reUploaded'){
                                        tempAppInfoObject.totalSubmited++;
                                        tempAppInfoObject.smallHorseSubmited++;
                                    }else if(mackObject.get('taskStatus') == 'refused'){
                                        tempAppInfoObject.totalRejected++;
                                        tempAppInfoObject.smallHorseRejected++;
                                    }else if(mackObject.get('taskStatus') == 'accepted' || mackObject.get('taskStatus') == 'systemAccepted'){
                                        tempAppInfoObject.totalAccepted++;
                                        tempAppInfoObject.smallHorseAccepted++;
                                        if(mackObject.get('taskStatus') == 'systemAccepted'){
                                            tempAppInfoObject.totalSystemAccepted++;
                                            tempAppInfoObject.smallHorseSystemAccepted++;
                                        }
                                    }
                                }else {
                                    tempAppInfoObject.smallHorseUndo++;
                                }

                            }

                            counter++;
                            if (counter == promise){
                                tempAppInfoObject.totalUndo = tempAppInfoObject.yemaUndo + tempAppInfoObject.smallHorseUndo;

                                retApps.push(tempAppInfoObject);
                                counterForReceive++;
                                tryReturn(0, '');
                            }
                        }
                        else
                        {
                            counter++;
                            //except
                            console.error(counter + ' check task error: not user and no tempUser ' + promise);
                            if (counter == promise){
                                tempAppInfoObject.totalUndo = tempAppInfoObject.yemaUndo + tempAppInfoObject.smallHorseUndo;

                                tempAppInfoObject.errorMsg = 'check task error: not user and no tempUser';
                                retApps.push(tempAppInfoObject);
                                counterForReceive++;
                                tryReturn(0, '');
                            }
                        }
                    }
                    //没有上传,返回空值
                    if (promise == 0){
                        tryReturn(0, '');
                    }
                }, function(error){
                    counterForReceive++;
                    tryReturn(0, '');
                });
            })(results[i]);
        }
    });
});

// 定时的任务详情
router.post('/timerTask', function(req, res){
    var taskIds = req.body.taskIds;

    var query = new AV.Query(ASOPlanObjectSQL);
    query.containedIn('objectId', taskIds);
    query.include('appObject');
    query.descending('createdAt');
    query.limit(1000);
    query.find().then(function(timerTaskObject){
        var retApps = Array();
        for (var i = 0; i < timerTaskObject.length; i++){
            var timerTaskObj = Object();
            timerTaskObj.taskCountPerDay = timerTaskObject[i].get('taskCountPerDay');
            timerTaskObj.taskHour = timerTaskObject[i].get('taskHour');
            timerTaskObj.delayTaskDay = timerTaskObject[i].get('delayTaskDay');
            timerTaskObj.taskLastDay = timerTaskObject[i].get('taskLastDay');
            timerTaskObj.taskId = timerTaskObject[i].id;

            retApps.push(timerTaskObj)

        }

        res.json({'timerTaskOverviewList':retApps, 'errorId':0, 'errorMsg':''})


    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});


//***********************撤销任务***************************
router.get('/cancelTask/:taskId', function(req, res){
    var userId = util.useridInReq(req);
    var taskId = req.params.taskId;
    var query = new AV.Query(releaseTaskObject);
    query.include('userObject');
    query.include('appObject');
    query.get(taskId).then(function(taskObject){

        var remainCount = taskObject.get('remainCount');
        var taskPrice = taskObject.get('excUnitPrice');
        var userObject = taskObject.get('userObject');
        var excCount = taskObject.get('excCount');
        var appObject = taskObject.get('appObject');

        if (userId == userObject.id){
            if(taskObject.get('yeMa') != 'yeMa' && taskObject.get('timer') == true){
                res.json({'errorMsg':'该任务为定时计划任务，无法被撤销', 'errorId': -1});
                return;
            }

            if (remainCount == 0){
                res.json({'errorMsg':'该任务已经撤销了!', 'errorId': -1});
            }
            else {
                var unfreezingMoney = Math.floor(taskPrice * remainCount * 100) / 100;

                userObject.increment('freezingMoney', -unfreezingMoney);
                userObject.increment('totalMoney', unfreezingMoney);
                taskObject.set('cancelled', true);

                if(remainCount == taskObject.get('excCount')){
                    taskObject.set('close', true);
                }

                taskObject.set('excCount', excCount - remainCount);
                taskObject.set('remainCount', 0);

                userObject.save().then(function(){

                    //刷新redis
                    leanObjectRedis.releaseRedisTask(taskId, userId, remainCount);

                    messager.unfreezeMsg('您成功撤销了（' + appObject.get('trackName') + '）的剩余任务', unfreezingMoney, userObject.id, 1);
                    //返回冻结的Y币数量
                    AV.Object.saveAll([taskObject]).then(function(){
                        res.json({'errorMsg':'succeed', 'errorId': 0});
                    }, function(error){
                        res.json({'errorMsg':error.message, 'errorId': error.code});
                    });
                }, function(error){
                    res.json({'errorMsg':error.message, 'errorId': error.code});
                });
            }
        }else {
            res.json({'errorMsg':'您不是发布的用户,无权撤销任务', 'errorId': -1});
        }
    }, function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});

router.get('/oneTimerTask/:taskId', function(req, res){
    var taskId = req.params.taskId;

    var query = new AV.Query(ASOPlanObjectSQL);
    query.include('appObject');
    query.get(taskId).then(function(timerObject){
        var timerTaskObj = Object();
        var appObject = timerObject.get('appObject');
        // app相关
        timerTaskObj.appTrackName = appObject.get('trackName');
        timerTaskObj.appIcon = appObject.get('artworkUrl100');

        // 任务相关
        timerTaskObj.needGet = timerObject.get('needGet');
        timerTaskObj.needThird = timerObject.get('needThird');
        timerTaskObj.ranKing = timerObject.get('startRanking');
        timerTaskObj.searchKeyword = timerObject.get('asoKey');
        timerTaskObj.taskType = timerObject.get('taskType');
        timerTaskObj.commentKeys = timerObject.get('commentKeys'); // 标题
        timerTaskObj.commentContentKeys = timerObject.get('commentContentKeys'); // 内容
        timerTaskObj.taskCount = timerObject.get('taskCountPerDay');


        res.json({'timerTaskObject':timerTaskObj, 'errorId':0, 'errorMsg':''})

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});

// 撤销定时任务
router.post('/undoTimerTask', function(req, res){
    var userId = util.useridInReq(req);
    var taskId = req.body.taskId;

    var query = new AV.Query(ASOPlanObjectSQL);
    query.include('userObject');
    query.get(taskId).then(function(undoTimerTaskObject){
        if (undoTimerTaskObject.get('userObject').id == userId){
            undoTimerTaskObject.destroy().then(function (success) {

                res.json({'errorMsg':'撤销成功', 'errorId': 0});
            }, function (error) {
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
        }
        else {
            res.json({'errorMsg':'您不是发布的用户,无权撤销任务', 'errorId': -1});
        }

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});

module.exports = router;