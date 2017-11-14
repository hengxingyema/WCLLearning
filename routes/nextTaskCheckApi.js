/**
 * Created by cailong on 2016/10/8.
 */

'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

var leanObjectRedis = require('../utils/leanObjectRedis');

var messager = require('../utils/messager');

var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var releaseTaskObject = AV.Object.extend('releaseTaskObject');
var receiveTaskObject = AV.Object.extend('receiveTaskObject');
var mackTaskInfo = AV.Object.extend('mackTaskInfo');
var revokeTaskSQL = AV.Object.extend('revokeTaskObject');

var tempUserSQL = AV.Object.extend('tempUser');

var YCoinToRMBRate = parseFloat(process.env.smallHorseYCoinToRMB) || 0.04;

//前多少次徒弟任务获得指定的钱
var masterRMBPreCount = parseInt(process.env.smallHorseMasterRMBPreCount) || 20;
//前多少次徒弟任务获得指定的钱(多少钱)
var masterRMBPreRMB = parseFloat(process.env.smallHorseMasterRMBPreRMB) || 0.5;
//师徒获取Y币比率
var masterRMBRate = parseFloat(process.env.smallHorseMasterRMBRate) || 0.1;

router.get('/:taskObjectId', function(req, res) {
    res.render('nextTaskCheck');
});

function userReceTaskDetail(tempSubmission, tempAppInfoObject, receTaskObject, data){
    var submitted = 0, accepted = 0, rejected = 0;
    tempSubmission.entries = Array();
    for (var j = 0; j < data.length; j++) {
        //已做任务的信息状态
        var taskStatus = data[j].get('taskStatus');
        if (taskStatus == 'uploaded' || taskStatus == 'reUploaded'){
            submitted++;
        }else if(taskStatus == 'systemAccepted' || taskStatus == 'accepted'){
            accepted++;
        }else if(taskStatus == 'refused'){
            rejected++;
        }else if(taskStatus == 'expired'){
            //已经在定时器里增加过期数据,无需在这边计算 —— 唉
        }

        //已做任务详情
        var entry = Object();
        entry.id = data[j].id;
        entry.uploadName = data[j].get('uploadName');
        entry.imgs = data[j].get('requirementImgs');
        entry.status = data[j].get('taskStatus');
        entry.detail = data[j].get('detail');
        entry.submitMsg = data[j].get('submitMsg'); //留言
        entry.createdAt = data[j].createdAt.toLocaleDateString() + ' ' + data[j].createdAt.toLocaleTimeString();

        entry.IP = data[j].get('IP');
        entry.Browser = data[j].get('Browser');
        entry.OS = data[j].get('OS');
        entry.Platform = data[j].get('Platform');
        entry.Version = data[j].get('Version');

        //申诉
        var revokeObject = data[j].get('revokeObject');
        if(revokeObject != undefined){
            if(revokeObject.get('revokeStatus') == 'revokeSucceed'){
                entry.revokeStr = revokeObject.get('dealInfo');
            }
        }
        tempSubmission.entries.push(entry);

    }

    tempSubmission.submitted = submitted;//待审核
    tempAppInfoObject.totalSubmited += submitted;
    tempSubmission.rejected = rejected;//已拒绝
    tempAppInfoObject.totalRejected += rejected;
    tempSubmission.accepted = accepted;//已完成
    tempAppInfoObject.totalAccepted += accepted;
    //未提交/已过期
    if (receTaskObject.get('expiredCount') != undefined && receTaskObject.get('expiredCount') > 0){
        //过期(定时器走过了)
        tempSubmission.abandoned = receTaskObject.get('expiredCount');
        tempSubmission.pending = 0;

        //小马的超时会再次释放任务,不计算在超时内
        if(receTaskObject.get('tempUserObject') == undefined){
            tempAppInfoObject.totalTimeout += tempSubmission.abandoned;
        }

    }else {
        //未提交
        var undoTask = receTaskObject.get('receiveCount') - data.length;
        tempSubmission.pending = undoTask;
        tempSubmission.abandoned = 0;
        tempAppInfoObject.totalUndo += undoTask;
    }

    tempAppInfoObject.submissions.push(tempSubmission);
}

router.get('/taskAudit/:taskObjectId/:taskType', function(req, res){
    var userId = util.useridInReq(req);

    var taskType = req.params.taskType;

    var user = new AV.User();
    user.id = userId;

    var taskObjectId = req.params.taskObjectId;

    var query = new AV.Query(releaseTaskObject);
    query.include('appObject');
    leanObjectRedis.fetchLeanObjectFromCache(taskObjectId, 'releaseTaskObject').then(function(taskObjInfo){

        // var needChangeTasksForBug = [];

        var taskInfoObject = Object();

        leanObjectRedis.fetchLeanObjectFromCache(taskObjInfo.get('appObject').id, 'IOSAppInfo').then(function(appObject) {

            //App基本信息
            taskInfoObject.taskId = taskObjInfo.id;
            taskInfoObject.artworkUrl100 = appObject.get('artworkUrl100');
            taskInfoObject.statusHistory = taskObjInfo.get('statusHistory');

            taskInfoObject.trackName = appObject.get('trackName');

            taskInfoObject.appId = appObject.get('appleId');
            taskInfoObject.sellerName = appObject.get('sellerName');
            taskInfoObject.latestReleaseDate = appObject.get('latestReleaseDate');
            taskInfoObject.formattedPrice = appObject.get('formattedPrice');
            taskInfoObject.excUniqueCode = appObject.get('excUniqueCode');
            taskInfoObject.createdAt = taskObjInfo.createdAt;

            //任务需求
            taskInfoObject.rateUnitPrice = taskObjInfo.get('rateUnitPrice'); // 任务金额
            taskInfoObject.taskType = taskObjInfo.get('taskType');  // 任务类型
            taskInfoObject.excCount = taskObjInfo.get('excCount');  // 任务数量

            taskInfoObject.ranking = taskObjInfo.get('ranKing');     // 任务排名
            taskInfoObject.score = taskObjInfo.get('Score');         // 任务评分
            taskInfoObject.searchKeyword = taskObjInfo.get('searchKeyword');  // 搜索关键词

            taskInfoObject.titleKeyword = taskObjInfo.get('titleKeyword');  // 标题关键词
            taskInfoObject.commentKeyword = taskObjInfo.get('commentKeyword');  // 评论关键词

            taskInfoObject.detailRem = taskObjInfo.get('detailRem'); // 任务备注

            //收费需求
            taskInfoObject.needGet = taskObjInfo.get('needGet'); // 是否有获取
            taskInfoObject.registerStatus = taskObjInfo.get('registerStatus'); // 注册方式
            taskInfoObject.needMoreReviewContent = taskObjInfo.get('needMoreReviewContent'); // 是否超长评论
            taskInfoObject.reviewMustTitleKey = taskObjInfo.get('reviewMustTitleKey'); // 标题必须包含
            taskInfoObject.reviewMustContentKey = taskObjInfo.get('reviewMustContentKey'); // 评论必须包含

            //实时数据
            taskInfoObject.remainCount = taskObjInfo.get('remainCount');
            taskInfoObject.cancelled = taskObjInfo.get('cancelled');

            //查询领取任务数据库

            taskInfoObject.submissions = Array();
            var queryReceive = new AV.Query(receiveTaskObject);
            queryReceive.equalTo('taskObject', taskObjInfo);
            queryReceive.greaterThan('receiveCount', 0);
            queryReceive.include('userObject');
            //小马
            queryReceive.include('tempUserObject');
            queryReceive.include('tempMackTask');
            queryReceive.ascending('createdAt');
            queryReceive.limit(1000);
            queryReceive.find().then(function (results) {
                var promise = results.length;
                var counter = 0;

                taskInfoObject.totalGetTask = 0;
                taskInfoObject.totalAccepted = 0;
                taskInfoObject.totalSubmited = 0;
                taskInfoObject.totalUndo = 0;
                taskInfoObject.totalRejected = 0;
                taskInfoObject.totalTimeout = 0;

                if (results.length == 0) {
                    res.json({'app': taskInfoObject, 'errorId': 0, 'errorMsg': 'empty'});
                    return;
                }

                for (var i = 0; i < results.length; i++) {
                    //receive task object
                    var submission = Object();
                    submission.id = results[i].id;
                    submission.receiveCount = results[i].get('receiveCount');

                    submission.createdAt = results[i].createdAt;

                    var user = results[i].get('userObject');
                    var tempUser = results[i].get('tempUserObject');

                    //小马用户领取的,并且超时,不计算为领取进度
                    //小马用户超时的任务,会自动再次释放出来
                    if (user != undefined) {
                        //换评系统里领取任务基本信息
                        submission.userId = user.id;

                        var userNickname = user.get('userNickname');
                        var userQQ = user.get('userQQ');
                        //优先QQ,其次昵称,其次手机号(有码)
                        if (userQQ != undefined && userQQ.length > 0) {
                            submission.username = 'QQ: ' + userQQ;
                        } else {
                            if (userNickname == undefined || userNickname.length == 0) {
                                submission.username = user.get('username').substring(0, 7) + '****';
                            } else {
                                submission.username = userNickname;
                            }
                        }

                        //console.log('user : ' + submission.username + ' receive count : ' + submission.receiveCount);
                        taskInfoObject.totalGetTask += submission.receiveCount;

                        //具体做的任务信息
                        (function (receTaskObject, tempSubmission) {
                            var relation = receTaskObject.relation('mackTask');
                            var query = relation.query();

                            var taskStatuss = [];
                            if (taskType == 'uploaded') {
                                taskStatuss.push('uploaded');
                                taskStatuss.push('reUploaded');
                            } else if (taskStatuss == 'accepted') {
                                taskStatuss.push('accepted');
                                taskStatuss.push('systemAccepted');
                            } else {
                                taskStatuss.push(taskType);
                            }

                            query.containedIn('taskStatus', taskStatuss);
                            query.descending('createdAt');
                            query.include('revokeObject');
                            query.limit(1000);
                            query.find().then(function (data) {

                                userReceTaskDetail(tempSubmission, taskInfoObject, receTaskObject, data);

                                counter++;

                                if (counter == promise) {
                                    res.json({'app': taskInfoObject, 'errorId': 0, 'errorMsg': ''});
                                }
                            }, function (error) {
                                counter++;
                                if (counter == promise) {
                                    res.json({'app': taskInfoObject, 'errorId': error.code, 'errorMsg': error.message});
                                }
                            });
                        })(results[i], submission);
                    }
                    else if
                    (tempUser != undefined) {
                        //小马系统领取的任务
                        if (results[i].get('expiredCount') > 0) {
                            //不显示
                            counter++;
                            if (counter == promise) {
                                res.json({'app': taskInfoObject, 'errorId': 0, 'errorMsg': ''});
                            }
                            //console.log('tempUser : ' + tempUser.get('userCodeId') + ' expired count : ' + results[i].get('expiredCount'));
                            continue;
                        } else {
                            //console.log('tempUser : ' + tempUser.get('userCodeId') + ' receive count : ' + submission.receiveCount);
                            taskInfoObject.totalGetTask += submission.receiveCount;
                        }

                        submission.username = tempUser.get('userCodeId');
                        var tempMackTask = results[i].get('tempMackTask');
                        if (tempMackTask != undefined) {
                            if (taskType == 'uploaded') {
                                if (tempMackTask.get('taskStatus') == 'uploaded' || tempMackTask.get('taskStatus') == 'reUploaded') {
                                    userReceTaskDetail(submission, taskInfoObject, results[i], [tempMackTask]);
                                }
                            } else if (taskType == 'accepted') {
                                if (tempMackTask.get('taskStatus') == 'accepted' || tempMackTask.get('taskStatus') == 'systemAccepted') {
                                    userReceTaskDetail(submission, taskInfoObject, results[i], [tempMackTask]);
                                }
                            } else {
                                if (tempMackTask.get('taskStatus') == taskType) {
                                    userReceTaskDetail(submission, taskInfoObject, results[i], [tempMackTask]);
                                }
                            }
                        } else {
                            //未做任务呢
                            userReceTaskDetail(submission, taskInfoObject, results[i], []);
                        }

                        counter++;
                        if (counter == promise) {
                            res.json({'app': taskInfoObject, 'errorId': 0, 'errorMsg': ''});
                        }
                    }
                    else {
                        counter++;
                        //except
                        console.error(counter + ' check task error: not user and no tempUser ' + promise);
                        if (counter == promise) {
                            res.json({
                                'app': taskInfoObject,
                                'errorId': -1,
                                'errorMsg': 'check task error: not user and no tempUser'
                            });
                        }
                    }
                }
                //没有上传,返回空值
                if (promise == 0) {
                    res.json({'app': taskInfoObject, 'errorId': 0, 'errorMsg': 'empty'});
                }
            }, function (error) {
                res.json({'app': taskInfoObject, 'errorId': error.code, 'errorMsg': error.message});
            });
        });


    }, function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});


//****************************接收逻辑******************************
router.post('/accept/:entryId', function(req, res) {
    var entryId = req.params.entryId;
    var revokeReason = req.body.revokeReason;


    //lock
    var nowDate = new Date();
    var nowHours =  nowDate.getHours();
    var nowMinutes =  nowDate.getMinutes();
    if((nowHours == 10 && nowMinutes > 54) || (nowHours == 11 && nowHours < 10)){
        res.json({'errorMsg':'10:55 - 11:10 审核任务系统维护中,请稍候...', 'errorId': -1});
        return;
    }

    var userId = util.useridInReq(req);

    var userObject = new AV.User();
    userObject.id = userId;

    var query = new AV.Query(mackTaskInfo);
    //2个用户
    query.include('doTaskUser');
    query.include('releaseTaskUser');
    query.include('releaseTaskObject');

    query.include('receiveTaskObject');
    query.include('receiveTaskObject.taskObject');
    //消息
    query.include('receiveTaskObject.appObject');

    //小马试客
    query.include('tempUserObject');
    query.include('revokeObject');
    query.include('mentorObject');
    query.include('tempMasterUserObject');
    query.get(entryId).then(function(doTaskObject) {

        var needSaveForAcceptList = [];

        var myDate = new Date();
        if(doTaskObject.get('taskStatus') == 'accepted'){
            res.json({'errorMsg':'任务已经被接受', 'errorId': -1});
            return;
        }
        var revokeObject = doTaskObject.get('revokeObject');

        //野马用户
        var receUserObject = doTaskObject.get('doTaskUser');
        var senderUserObject = doTaskObject.get('releaseTaskUser');

        //小马试客用户
        var tempUserObject = doTaskObject.get('tempUserObject');

        //接受的任务
        var receiveTaskObject = doTaskObject.get('receiveTaskObject');

        var appObject = receiveTaskObject.get('appObject');
        //消息产生所需数据
        var trackName = appObject.get('trackName');

        //发布任务Object
        var task = doTaskObject.get('releaseTaskObject');
        if(task == undefined){
            //兼容s
            task = receiveTaskObject.get('taskObject');
        }
        //野马价格(以领取任务时的价格为准)
        //兼容老版本，若无领取任务时的价格，以发布任务的单价为准
        var rateUnitPrice = receiveTaskObject.get('rateUnitPrice');
        if(rateUnitPrice == undefined){
            rateUnitPrice = task.get('rateUnitPrice');
        }
        //小马价格
        var tempUserPrice = receiveTaskObject.get('tempUserPrice');
        //野马发布的价格
        var excUnitPrice = task.get('excUnitPrice');

        if(receUserObject != undefined || tempUserObject != undefined){

            var userName;
            if(receUserObject != undefined){
                userName = receUserObject.get('username');

                //user new task status
                if(receUserObject.get('registerBonus') == 'register_upload_task'){
                    receUserObject.set('registerBonus', 'register_accept_task');
                }
                // 接收任务后 把钱打给用户记录流水
                receUserObject.increment('totalMoney', rateUnitPrice);

                //Y币流水
                var messageObject = messager.earnMsg('您提交的任务(' + trackName + ')被审核通过', rateUnitPrice, receUserObject.id, receUserObject);
                needSaveForAcceptList.push(messageObject);

                //邀请任务
                var inviteUserId = receUserObject.get('inviteUserId');
                if(inviteUserId != undefined && inviteUserId.length > 0 && inviteUserId != 'invite_done'){
                    var inviteUserObject = new AV.User();
                    inviteUserObject.id = receUserObject.get('inviteUserId');
                    inviteUserObject.increment('inviteSucceedCount', 1);
                    needSaveForAcceptList.push(inviteUserObject);

                    receUserObject.set('inviteUserId', 'invite_done');
                    needSaveForAcceptList.push(receUserObject);
                }
            }else if(tempUserObject != undefined) {
                userName = tempUserObject.get('userCodeId');

                var isToday = true;
                var month = (myDate.getMonth() + 1).toString();
                var day = myDate.getDate().toString();
                var yearStr = myDate.getFullYear().toString();
                var todayStr = yearStr + '-' + month + '-' + day;

                //增加做小马用户的钱
                //是不是今天
                var todayMoneyDate = tempUserObject.get('todayMoneyDate');
                if (todayMoneyDate != todayStr) {
                    //非当天赚到的钱
                    isToday = false;
                }

                var tempUserGetRMB = 0;
                if (tempUserPrice > 0) {
                    tempUserGetRMB = tempUserPrice;
                } else {
                    tempUserGetRMB = rateUnitPrice * YCoinToRMBRate;
                    tempUserGetRMB = parseInt(tempUserGetRMB * 100) / 100;
                }

                //正在做的任务减少
                needSaveForAcceptList.push(task);

                //增加用户的钱(总额,可用,今日)
                tempUserObject.increment('taskCount', 1);
                tempUserObject.increment('totalMoney', tempUserGetRMB);
                tempUserObject.increment('currentMoney', tempUserGetRMB);
                if (isToday == true) {
                    tempUserObject.increment('todayMoney', tempUserGetRMB);
                } else {
                    //更新日期到最新
                    tempUserObject.set('todayMoneyDate', todayStr);
                    tempUserObject.set('todayMoney', tempUserGetRMB);
                }
                needSaveForAcceptList.push(tempUserObject);
                // console.log('****** task be accept by user ------ temp do task user ' + tempUserObject.get('userCodeId') + '(add total RMB) +' + tempUserGetRMB);


                //增加小马用户师傅的钱
                var masterUserObject = doTaskObject.get('tempMasterUserObject');
                if(masterUserObject != undefined){
                    var masterRewards;

                    //计算师傅奖励
                    var mentorObject = doTaskObject.get('mentorObject');
                    mentorObject.increment('taskCount', 1);
                    if(mentorObject.get('taskCount') <= masterRMBPreCount){
                        masterRewards = masterRMBPreRMB;
                    }else {
                        masterRewards = tempUserGetRMB * masterRMBRate;
                        masterRewards = parseInt(masterRewards * 100)/100;
                    }

                    var mentorIsToday = true;
                    var mentorTodayMoneyDate = masterUserObject.get('todayMoneyDate');
                    if (mentorTodayMoneyDate != todayStr) {
                        //非当天赚到的钱
                        mentorIsToday = false;
                    }

                    //增加师父的钱(总额,可用,今日)
                    masterUserObject.increment('apprenticeTaskCount', 1);
                    masterUserObject.increment('totalMoney', masterRewards);
                    masterUserObject.increment('currentMoney', masterRewards);
                    masterUserObject.increment('apprenticeMoney', masterRewards);
                    if (mentorIsToday == true) {
                        masterUserObject.increment('todayMoney', masterRewards);
                        // console.log('****** small horse ------ master add RMB(today) ' + masterUserObject.get('userCodeId') + '(add total RMB) +' + masterRewards);
                    } else {
                        //更新日期到最新
                        masterUserObject.set('todayMoneyDate', todayStr);
                        masterUserObject.set('todayMoney', masterRewards);
                        // console.log('****** small horse ------ master add RMB(first today) ' + masterUserObject.get('userCodeId') + '(add total RMB) +' + masterRewards);
                    }

                    // 徒弟为师傅赚多少钱
                    doTaskObject.set('tempMasterUserMoney', masterRewards);

                    needSaveForAcceptList.push(doTaskObject);
                    needSaveForAcceptList.push(mentorObject);
                    needSaveForAcceptList.push(masterUserObject);
                }
            }

            // 发布任务的人冻结钱变少
            if(doTaskObject.get('canRedo') == 0 && doTaskObject.get('taskStatus') == 'refused'){
                //申诉成功（不能被重新做的任务，被申诉成功了，扣除相关的钱）
                //领取任务+1
                receiveTaskObject.increment('receiveCount', 1);
                needSaveForAcceptList.push(receiveTaskObject);
                //发布任务数+1
                if(task.get('remainCount') > 0){
                    task.increment('remainCount', -1);

                    if(task.get('yeMa') == 'yeMa') {
                        senderUserObject.increment('freezingMoney', -excUnitPrice);
                        var messageObject = messager.payMsg('您接受了(' + userName + ')提交的任务(' + trackName + ')结果', excUnitPrice, senderUserObject.id, senderUserObject);
                        needSaveForAcceptList.push(messageObject);
                    }else {
                        //广告主
                    }
                }else {
                    if(task.get('yeMa') == 'yeMa') {
                        //扣除总账户余额
                        senderUserObject.increment('totalMoney', -(excUnitPrice));
                        var messageObject = messager.penaltyMsg(userName, trackName, excUnitPrice, senderUserObject);
                        needSaveForAcceptList.push(messageObject);
                    }else {
                        //额外的任务被完成，扣除广告主 cashMoney 这条任务的钱
                        var costMoney = task.get('adsRMBPerTask');
                        senderUserObject.increment('cashMoney', -(costMoney));
                        var messageObject = messager.cashMoneyUsedForPlan(costMoney, task.get('planObject'), senderUserObject);
                        needSaveForAcceptList.push(messageObject);
                    }
                    task.increment('excCount', 1);
                }
                // needSaveForAcceptList.push(task);
            }else {
                if(task.get('yeMa') == 'yeMa') {
                    senderUserObject.increment('freezingMoney', -excUnitPrice);
                    var messageObject = messager.payMsg('您接受了(' + userName + ')提交的任务(' + trackName + ')结果', excUnitPrice, senderUserObject.id, senderUserObject);
                    needSaveForAcceptList.push(messageObject);
                }else {
                    //广告主
                }
            }
            doTaskObject.set("taskStatus", 'accepted');
            doTaskObject.set('auditUserObject', userObject);
            doTaskObject.unset('canRedo');
            needSaveForAcceptList.push(doTaskObject);

            if(revokeObject != undefined){
                revokeObject.set('revokeStatus', 'revokeSucceed');
                revokeObject.set('dealInfo', revokeReason);
                needSaveForAcceptList.push(revokeObject);
            }

            //保存2份流水
            AV.Object.saveAll(needSaveForAcceptList).then(function(){
                res.json({'errorMsg':'', 'errorId': 0});
            }, function (error) {
                res.json({'errorMsg': error.message, 'errorId': error.code});
            });

            //任务系统
            //每日任务(5:30前审核完所有的任务)
            var taskDate = doTaskObject.createdAt;
            //需要当天的任务才可以
            if(myDate.getDay() == taskDate.getDay()){
                if(myDate.getHours() < 17 || (myDate.getHours() == 17 && myDate.getMinutes() < 31))
                {
                    if (userId == senderUserObject.id){
                        util.dayTaskIncrement(userId, 'checkTaskY', 1);
                    }
                }
            }
        }else {
            console.error('accept task error: not user and no tempUser');
        }

    }, function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});

//*************拒绝逻辑******************************

router.post('/reject/:entryId', function(req, res) {
    var entryId = req.params.entryId;
    var refusedReason = req.body.refusedReason;

    var userId = util.useridInReq(req);

    var userObject = new AV.User();
    userObject.id = userId;

    var formalRedo;
    if(refusedReason.indexOf('任务失败') >= 0){
        formalRedo = false;
    }else {
        formalRedo = req.body.formalRedo;
    }

    //lock
    var nowDate = new Date();
    var nowHours =  nowDate.getHours();
    var nowMinutes =  nowDate.getMinutes();
    if((nowHours == 10 && nowMinutes > 54) || (nowHours == 11 && nowHours < 10)){
        res.json({'errorMsg':'10:55 - 11:10 审核任务系统维护中,请稍候...', 'errorId': 1});
        return;
    }

    var query = new AV.Query(mackTaskInfo);
    query.include('releaseTaskObject');
    query.include('receiveTaskObject');
    query.get(entryId).then(function(doTaskObject) {

        var needSavedList = [];

        if(formalRedo == false){
            //can not open
            var releaseTask = doTaskObject.get('releaseTaskObject');
            var receiveTask = doTaskObject.get('receiveTaskObject');

            //无法重新做的任务
            doTaskObject.set("taskStatus", 'refused');
            doTaskObject.set("canRedo", 0);

            if(refusedReason.indexOf('任务失败') < 0){
                refusedReason = '任务失败(' + refusedReason + ')';
            }

            //释放任务余量
            releaseTask.increment('remainCount', 1);
            needSavedList.push(releaseTask);

            //释放redis任务
            if(receiveTask.get('userObject') != undefined){
                leanObjectRedis.releaseRedisTask(releaseTask.id, receiveTask.get('userObject').id, 1);
            }else {
                leanObjectRedis.releaseRedisTask(releaseTask.id, receiveTask.get('tempUserObject').id, 1);
            }

            //修改领取任务余量
            receiveTask.increment('receiveCount', -1);
            needSavedList.push(receiveTask);
        }else {
            doTaskObject.set("taskStatus", 'refused');
        }

        doTaskObject.set('detail', refusedReason);
        doTaskObject.set('auditUserObject', userObject);
        needSavedList.push(doTaskObject);
        AV.Object.saveAll(needSavedList).then(function () {
            res.json({'errorMsg':'', 'errorId': 0});
        }, function(error){
            res.json({'errorMsg':error.message, 'errorId': error.code});
        });
    }, function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});


module.exports = router;