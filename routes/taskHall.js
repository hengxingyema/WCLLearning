/**
 * Created by wujiangwei on 16/8/31.
 */
var express = require('express');
var router = express.Router();
var util = require('./util');
var AV = require('leanengine');

var Base64 = require('../public/javascripts/vendor/base64').Base64;
var File = AV.Object.extend('_File');

var tryPriceUtil = require('../utils/tryPriceUtil');
var leanObjectRedis = require('../utils/leanObjectRedis');

var tempUserSQL = AV.Object.extend('tempUser');
var mackTaskSQL = AV.Object.extend('mackTaskInfo');
var receiveTaskSQL = AV.Object.extend('receiveTaskObject');
var releaseTaskSQL = AV.Object.extend('releaseTaskObject');

var mentorRelationSQL = AV.Object.extend('mentorRelation');

//防作弊
var requestIp = require('request-ip');
var userAgent = require('express-useragent');

//任务到小马的过滤策略
//2.下午2Pm后,2端任务同时进行
var startFunnelHour = parseInt(process.env.smallHorseProtectEndHour) || 12;    //<= XX:59
var minFunnelHour = parseInt(process.env.smallHorseProtectStartHour) || 7;  //>= XX:00
//3.哪些天排除在保护器机制外
var noProtectDay = process.env.smallHorseDayRule || '0,6';

//默认Y币转人名币汇率
var YCoinToRMBRate = parseFloat(process.env.smallHorseYCoinToRMB) || 0.04;

//小马领取任务超时时间
var tempTaskMaxTime = parseInt(process.env.smallHorseMaxTaskTime) || (1000*60*60*1);
//var tempTaskMaxTime = 1000*60*2;

//已完成任务最多展示次数
var maxShowInvalidTask = parseInt(process.env.smallHorseMaxEndTaskShow) || 20;

function isInProtectDays(currentDate) {
    var noProtectDays = noProtectDay.split(',');
    for (var i = 0; i < noProtectDays.length; i++){
        if(currentDate.getDay() === parseInt(noProtectDays[i])){
            return false;
        }
    }

    return true;
}

function getTaskTypeNeedPic(releaseTaskObject){
    var taskType = releaseTaskObject.get('taskType');
    if(taskType == '下载'){
        return 2;
    }else if(taskType == '评论'){
        return 3;
    }else {
        var taskPicCount = releaseTaskObject.get('taskPicCount');
        if(taskPicCount == undefined || taskPicCount == 0){
            taskPicCount = 3;
        }

        return taskPicCount;
    }
}

function taskObjectToDic(taskObject){
    if(taskObject != undefined || taskObject.get('appObject') != undefined){
        var taskDic = Object();
        var appObject = taskObject.get('appObject');
        if(appObject == undefined){
            return undefined;
        }

        taskDic.taskId = taskObject.id;
        taskDic.appIcon = appObject.get('artworkUrl100');
        // taskDic.appName = appObject.get('trackName');
        taskDic.appName = taskObject.get('searchKeyword');

        taskDic.taskType = taskObject.get('taskType');

        if(appObject.get('formattedPrice') != '免费'){
            taskDic.formattedPrice = appObject.get('formattedPrice');
        }

        taskDic.remainCount = taskObject.get('remainCount');

        taskDic.doTaskPrice = taskObject.get('tempUserPrice');
        if(taskDic.doTaskPrice == 0){
            var rateUnitPrice = taskObject.get('rateUnitPrice');
            var doTaskPrice = rateUnitPrice * YCoinToRMBRate;
            taskDic.doTaskPrice = parseInt(doTaskPrice * 100)/100;
        }

        //正在做的任务
        taskDic.detailRem = taskObject.get('detailRem');

        var extraDemandArray = Array();
        if(taskObject.get('taskType') == '下载' || taskObject.get('taskType') == '评论'){
            if(taskObject.get('needGet') == true){
                extraDemandArray.push('需首次下载(获取按钮)');
            }
            //var priceStr = appObject.get('formattedPrice');
            //if(priceStr != '免费'){
            //    taskObject.appPrice = priceStr;
            //    var appPrice = parseFloat(priceStr.substring(1, priceStr.length));
            //    extraDemandArray.push('付费游戏 +' + tryPriceUtil.payAppRmb(appPrice));
            //}
            if(taskObject.get('needMoreReviewContent') == true){
                extraDemandArray.push('需超长评论');
                //extraDemandArray.push('需超长评论 +' + tryPriceUtil.needLongComment(true));
            }
            var asoRank = taskObject.get('ranKing');
            if(asoRank > 50){
                extraDemandArray.push('排名在' + taskObject.get('ranKing') + '位');
            }
            var registerStatus = taskObject.get('registerStatus');
            if(registerStatus == 'third'){
                //extraDemandArray.push('需要第三方登陆体验App +' + tryPriceUtil.needThirdLogin(registerStatus));
                extraDemandArray.push('需要第三方登陆体验App 5分钟');
            }
        }else {
            extraDemandArray = taskObject.get('extraDemands');
        }

        taskDic.specialNeeds = taskObject.get('needUserInputCoArray');

        taskDic.extraDemandArray = extraDemandArray;

        return taskDic;
    }

    return undefined;
}

//锁定任务(30分钟),定时器,30分钟后,看任务有没有做完,未作完,则释放锁,删除相关数据
//获取任务大厅任务
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
        // if(res != undefined){
        //     if(tempUserObject.get('phoneNumber') == undefined || tempUserObject.get('phoneNumber').length == 0) {
        //         res.json({'errorId': -100, 'message': '为了您的帐号不丢失（丢失了就无法提现了）\n请先去提现里绑定手机号吧'});
        //         return;
        //     }
        // }

        if(tempUserObject.get('isBadUser') == true){
            res.json({'errorId': -101, 'message': '啊啊啊，任务没抢到呢'});
            return;
        }

        leanObjectRedis.fetchLeanObjectFromCache(taskObjectId, 'releaseTaskObject').then(function (releTaskObject) {

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
                if(releTaskObject.get('needGet') == true){
                    query.equalTo('appObject', appObject);
                }else {
                    query.equalTo('excUniqueCode', releTaskObject.get('excUniqueCode'));
                }

                query.include('taskObject');
                query.descending('createdAt');
                query.find().then(function(results){
                    if (res != undefined && results.length > 0){
                        if(releTaskObject.get('needGet') == true){
                            errorMsg = "该任务需要首次下载,你已经下载过该App";
                        }else {
                            errorMsg = "你已经领取过该版本App的任务";
                        }
                        flag = false;
                        res.json({'errorId': -2, 'message': errorMsg});
                    }else {
                        //最多领取2条任务
                        var query = new AV.Query(receiveTaskSQL);
                        query.equalTo('tempUserObject', tempUser);
                        query.equalTo('expiredCount', 0);
                        query.doesNotExist('tempMackTask');
                        query.count().then(function(count){
                            //if(res != undefined && count >= 2){
                            //    errorMsg = "最多同时领取2条任务";
                            //    res.json({'errorId': -1, 'message': errorMsg});
                            //    return;
                            //}

                            if(res != undefined && releTaskObject.get('close') == true){
                                res.json({'errorId': -2, 'message': '任务已关闭,不能领取哦'});
                            }else if(res != undefined && releTaskObject.get('cancelled') == true){
                                res.json({'errorId': -2, 'message': '任务刚被发布者撤销,看看别的任务吧'});
                            }else {
                                var tempUserPrice = releTaskObject.get('tempUserPrice');
                                var appObject = releTaskObject.get('appObject');
                                var excUniqueCode = releTaskObject.get('excUniqueCode');


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

                                leanObjectRedis.seckillTask(taskObjectId, 'releaseTaskObject', userCId, 1).then(function (redisDatas) {
                                    //后端效验通过
                                    var savedReleTaskObject = new releaseTaskSQL();
                                    savedReleTaskObject.id = taskObjectId;
                                    savedReleTaskObject.increment('remainCount', -1);

                                    var tempUser = new tempUserSQL();
                                    tempUser.id = userCId;
                                    var ReceiveTaskObject = new receiveTaskSQL();
                                    ReceiveTaskObject.set('tempUserObject', tempUser);
                                    ReceiveTaskObject.set('taskObject', savedReleTaskObject);
                                    ReceiveTaskObject.set('appObject', appObject);
                                    ReceiveTaskObject.set('tempUserPrice', tempUserPrice);
                                    ReceiveTaskObject.set('bundleId', releTaskObject.get('bundleId'));

                                    ReceiveTaskObject.set('excUniqueCode', excUniqueCode);//换评信息
                                    ReceiveTaskObject.set('receiveDate', myDateStr);

                                    ReceiveTaskObject.set('receiveCount', 1);
                                    ReceiveTaskObject.set('receiveRemainCount', 1);

                                    if (releTaskObject.get('taskType') == '定制评论'){
                                        var reviewHeader = releTaskObject.get('reviewHeaderOptions');
                                        var customHeaderComments = reviewHeader.split('|')[0];

                                        var reviewContent = releTaskObject.get('reviewContentOptions');
                                        var customContentComments = reviewContent.split('|')[0];

                                        ReceiveTaskObject.set('customHeaderComments', customHeaderComments);
                                        ReceiveTaskObject.set('customContentComments', customContentComments);

                                        savedReleTaskObject.set('reviewHeaderOptions', reviewHeader.substring(customHeaderComments.length +1));
                                        savedReleTaskObject.set('reviewContentOptions', reviewContent.substring(customContentComments.length +1));
                                    }

                                    //小马试客,对于进入拒绝任务流程的一样需要进计时器
                                    //ReceiveTaskObject.set('timerDone', true);

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
                                            taskDetails(taskObjectId, userCId, res);
                                            //res.json({'errorId': 0, 'message': 'lock task succeed', 'lockTaskId': receTaskObject.id,
                                            //    'taskPicCount': getTaskTypeNeedPic(releTaskObject), 'doTaskCreatedAt': doTaskCreatedAt});
                                        }

                                    }, function(error){
                                        if(res != undefined) {
                                            res.json({'errorId': error.code, 'message': error.message});
                                        }
                                    });
                                }
                                , function (error) {

                                        if(error.message.indexOf('抢完') >= 0){
                                            var savedReleTaskObject = new releaseTaskSQL();
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
                            }
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

//超时后核实锁定任务
function unlockTaskIfNeeded(){
    // console.log('********** execute time out for small horse task');
    var lockTaskId = arguments[0];
    return unlockTaskWithRes(lockTaskId, undefined);
}

function unlockTaskWithRes(lockTaskId, res){
    var receTaskQuery = new AV.Query(receiveTaskSQL);
    receTaskQuery.include('taskObject');
    receTaskQuery.include('tempMackTask');
    // console.log('********** execute unlockTaskWithRes for task : ', lockTaskId);
    leanObjectRedis.fetchLeanObjectFromCache(lockTaskId, 'receiveTaskObject').then(function(receTaskObject){
        var taskObject = receTaskObject.get('taskObject');
        var doTaskObject = receTaskObject.get('tempMackTask');
        leanObjectRedis.fetchLeanObjectFromCache(taskObject.id, 'releaseTaskObject').then(function(releaseTaskInfo){
            console.log('----' + releaseTaskInfo.get('reviewHeaderOptions'));
            console.log('----' + releaseTaskInfo.get('reviewContentOptions'));
            if(doTaskObject == undefined){
                //任务超时未做
                taskObject.increment('remainCount', 1);

                var reviewHeader = releaseTaskInfo.get('reviewHeaderOptions');

                var reviewContent = releaseTaskInfo.get('reviewContentOptions');
                if (receTaskObject.get('customHeaderComments') != undefined || receTaskObject.get('customContentComments') != undefined){
                    taskObject.set('reviewHeaderOptions', receTaskObject.get('customHeaderComments').concat('|' + reviewHeader));
                    taskObject.set('reviewContentOptions', receTaskObject.get('customContentComments').concat('|' + reviewContent));
                }

                //主动取消了任务(还可以做)
                //回退任务条数
                taskObject.save().then(function(){
                    leanObjectRedis.releaseRedisTask(taskObject.id, receTaskObject.get('tempUserObject').id, 1);

                    receTaskObject.destroy().then(function (success) {
                        console.log('********** unlockTaskWithRes destroy succeed', lockTaskId);
                        // 删除任务记录成功(下次还可以做)
                        if(res != undefined) {
                            taskDetails(taskObject.id, receTaskObject.get('tempUserObject').id, res)
                            //res.json({'errorId': 0, 'message': 'unlock succeed'});
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

                //if(res == undefined){
                //    //任务超时(未取消)(不可在做该任务)
                //    AV.Object.saveAll([taskObject, receTaskObject]).then(function(){
                //        console.info('user ' + receTaskObject.get('tempUserObject').id + ' unlock task ' + lockTaskId + ' succeed');
                //    }, function(error){
                //        console.error('---------- timer !!!!!!!!!! user ' + receTaskObject.get('tempUserObject').id + ' unlock task ' + lockTaskId + ' failed');
                //    });
                //}else {
                //
                //}
            }else {
                //TODO: 思考被拒绝?
                if(res != undefined) {
                    res.json({'errorId': -1, 'message': '任务不存在'});
                }

            }
        },function(error){
            if(res != undefined) {
                res.json({'errorId': error.code, 'message': error.message});
            }
        });
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

//任务详情 + 用户的任务状态
function taskDetails(taskId, userCId, res){
    leanObjectRedis.fetchLeanObjectFromCache(taskId, 'releaseTaskObject').then(function(releaseTaskObject){
        var taskDetailDic = Object();

        //任务信息
        var inAppObject = releaseTaskObject.get('appObject');
        leanObjectRedis.fetchLeanObjectFromCache(inAppObject.id, 'IOSAppInfo').then(function(appObject){
            taskDetailDic.appIcon = appObject.get('artworkUrl100');
            taskDetailDic.appleId = appObject.get('appleId');
            taskDetailDic.appName = appObject.get('trackName');
            var priceStr = appObject.get('formattedPrice');
            if(priceStr != '免费'){
                taskDetailDic.appPrice = priceStr;
            }

            taskDetailDic.taskType = releaseTaskObject.get('taskType');
            taskDetailDic.taskPicCount = getTaskTypeNeedPic(releaseTaskObject);
            taskDetailDic.doTaskPrice = releaseTaskObject.get('tempUserPrice');
            if(taskDetailDic.doTaskPrice == 0){
                var rateUnitPrice = releaseTaskObject.get('rateUnitPrice');
                var doTaskPrice = rateUnitPrice * YCoinToRMBRate;
                taskDetailDic.doTaskPrice = parseInt(doTaskPrice * 100)/100;
            }

            //任务需求信息
            //截图1
            taskDetailDic.screenShotOne = Object();
            taskDetailDic.screenShotOne.searchKeyword = releaseTaskObject.get('searchKeyword');
            taskDetailDic.screenShotOne.ranKing = releaseTaskObject.get('ranKing');
            taskDetailDic.screenShotOne.ranKingPrice = tryPriceUtil.getRankRmb(releaseTaskObject.get('ranKing'));
            taskDetailDic.screenShotOne.needGet = releaseTaskObject.get('needGet');
            taskDetailDic.screenShotOne.needGetPrice = tryPriceUtil.needGetRmb(releaseTaskObject.get('needGet') == 'true');

            //截图2
            taskDetailDic.screenShotTwo = Object();
            taskDetailDic.screenShotTwo.registerStatus = releaseTaskObject.get('registerStatus');
            taskDetailDic.screenShotTwo.registerStatusPrice = tryPriceUtil.needThirdLogin(releaseTaskObject.get('registerStatus'));

            //截图3
            taskDetailDic.screenShotThird = Object();
            taskDetailDic.screenShotThird.titleKeyword = releaseTaskObject.get('titleKeyword');
            taskDetailDic.screenShotThird.reviewMustTitleKey = releaseTaskObject.get('reviewMustTitleKey');
            taskDetailDic.screenShotThird.reviewMustTitleKeyPrice = tryPriceUtil.pointCommentTitle(true);

            taskDetailDic.screenShotThird.commentKeyword = releaseTaskObject.get('commentKeyword');
            taskDetailDic.screenShotThird.reviewMustContentKey = releaseTaskObject.get('reviewMustContentKey');
            taskDetailDic.screenShotThird.reviewMustContentKeyPrice = tryPriceUtil.pointCommentContent(true);

            taskDetailDic.screenShotThird.needMoreReviewContent = releaseTaskObject.get('needMoreReviewContent');
            taskDetailDic.screenShotThird.needMoreReviewContentPrice = tryPriceUtil.needLongComment(releaseTaskObject.get('needMoreReviewContent') == 'true');

            // 特殊需求任务详情
            taskDetailDic.specialNeeds = releaseTaskObject.get('needUserInputCoArray');
            //备注
            taskDetailDic.userDetailInfo = releaseTaskObject.get('detailRem');
            taskDetailDic.remainCount = releaseTaskObject.get('remainCount');

            //用户有没有接受过任务
            var tempUser = new tempUserSQL();
            tempUser.id = userCId;

            var receTaskQuery = new AV.Query(receiveTaskSQL);
            receTaskQuery.equalTo('tempUserObject', tempUser);
            receTaskQuery.equalTo('taskObject', releaseTaskObject);
            receTaskQuery.include('tempMackTask');
            receTaskQuery.descending('createdAt');

            receTaskQuery.first().then(function(receObjects){
                if(receObjects != undefined){
                    //have lock task,need count down
                    taskDetailDic.lockTaskId = receObjects.id;
                    var doTaskCreatedAt = receObjects.createdAt.toLocaleDateString() + ' ' + receObjects.createdAt.toLocaleTimeString();
                    taskDetailDic.doTaskCreatedAt = doTaskCreatedAt;
                    var tempMackTask = receObjects.get('tempMackTask');
                    if(tempMackTask != undefined){
                        taskDetailDic.doTaskImgs = tempMackTask.get('requirementImgs');
                        taskDetailDic.doTaskStatus = tempMackTask.get('taskStatus');

                        if(taskDetailDic.doTaskStatus == 'refused'){
                            taskDetailDic.refusedReason = tempMackTask.get('detail');
                        }
                    }else if(receObjects.get('expiredCount') == 1){
                        //超时未完成
                        taskDetailDic.doTaskStatus = 'expired';
                    }

                    taskDetailDic.customHeaderComments = receObjects.get('customHeaderComments');
                    taskDetailDic.customContentComments = receObjects.get('customContentComments');

                    taskDetailDic.tempTaskMaxTime = tempTaskMaxTime;
                    res.json({'errorId': 0, 'taskDetail': taskDetailDic, 'message': 'lock task succeed', 'lockTaskId': receObjects.id,
                        'taskPicCount': getTaskTypeNeedPic(releaseTaskObject), 'doTaskCreatedAt': doTaskCreatedAt});
                }
                else {
                    taskDetailDic.tempTaskMaxTime = tempTaskMaxTime;
                    res.json({'errorId': 0, 'message': '', 'taskDetail': taskDetailDic});
                }
            }, function(error){
                res.json({'errorId': 0, 'message': 'get rece info error'});
            });
        }, function (error) {
            console.error('temp user get task info error:' + 'app not exist');
            res.json({'errorId': error.code, 'message': error.message});
        });

    }, function(error){
        console.error('temp user get task info error:' + error.message);
        res.json({'errorId': error.code, 'message': error.message});
    });
}

router.get('/:userCId/:taskId', function(req, res, next) {

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

    taskDetails(taskId, userCId, res)
});

//小马用户上传任务
router.post('/tempUserDoTask', function(req, res){
    var userCId = Base64.decode(req.body.userCId);
    var taskId = req.body.taskId;
    var requirementImgs = req.body.requirementImgs;

    var userInputArray = req.body.userInputArray;

    if(requirementImgs == undefined || requirementImgs.length == 0){
        res.json({'message':'未上传图片', 'errorId': -3});
        return;
    }

    //IP地址
    var clientIp = requestIp.getClientIp(req);
    //设备信息
    var source = req.headers['user-agent'];
    var ua = userAgent.parse(source);

    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (tempUserObject) {

        function dealUploadTask(mentorObject) {
            var tempMasterUserObject = (mentorObject != undefined ? mentorObject.get('masterUser') : undefined);

            var userUploadName = tempUserObject.get('userCodeId');
            var receiveTaskQuery = new AV.Query(receiveTaskSQL);
            receiveTaskQuery.include('taskObject');
            receiveTaskQuery.include('appObject');
            receiveTaskQuery.include('tempUserObject');
            receiveTaskQuery.include('tempMackTask');
            receiveTaskQuery.include('taskObject.userObject');
            receiveTaskQuery.get(taskId).then(function(receiveTaskObject){
                var tempMackObject = receiveTaskObject.get('tempMackTask');
                var taskObject = receiveTaskObject.get('taskObject');
                var appObject = receiveTaskObject.get('appObject');

                //这边必须不包含过期条目,因为expiredCount已经包含了
                if(receiveTaskObject.get('expiredCount') == 1){
                    res.json({'message':'任务已经超时,不在可以参加任务', 'errorId': -200});
                }
                //小马发布的任务，一旦被关闭，小马用户不可再做了
                //野马用户发布的任务，被关闭了，还是可以继续做的
                else if(taskObject.get('close') == true && taskObject.get('sendPlatform') == '小马')
                {
                    res.json({'errorId': -1, 'message': '任务刚刚被关闭了'});
                    unlockTaskWithRes(taskId, undefined);
                }
                else if(taskObject.get('cancelled') == true && taskObject.get('sendPlatform') == '小马')
                {
                    res.json({'errorId': -2, 'message': '任务刚刚被撤销了，任务失败'});
                    unlockTaskWithRes(taskId, undefined);
                }
                else
                {
                    if(tempMackObject == undefined)
                    {
                        //new task
                        tempMackObject = new mackTaskSQL();
                        tempMackObject.set('uploadName', userUploadName);
                        tempMackObject.set('requirementImgs', requirementImgs);
                        tempMackObject.set('taskStatus', 'uploaded');
                        tempMackObject.set('userInputArray', userInputArray);

                        //bugbug 循环以来, Leancloud的bug
                        tempMackObject.set('receiveTaskObject', receiveTaskObject);
                        tempMackObject.set("receiveTaskObject", AV.Object.createWithoutData("receiveTaskObject", receiveTaskObject.id));

                        //小马试客 做任务的人
                        tempMackObject.set('tempUserObject', tempUserObject);
                        if(tempMasterUserObject != undefined){
                            tempMackObject.set('tempMasterUserObject', tempMasterUserObject);
                            tempMackObject.set('mentorObject', mentorObject);
                        }

                        //发布任务的人
                        tempMackObject.set('releaseTaskObject', taskObject);
                        tempMackObject.set('releaseTaskUser', taskObject.get('userObject'));

                        //new app object
                        tempMackObject.set('appObject', taskObject.get('appObject'));

                        //设备信息
                        tempMackObject.set('IP', clientIp);
                        tempMackObject.set('Browser', ua.browser);
                        tempMackObject.set('OS', ua.os);
                        tempMackObject.set('Platform', ua.platform);
                        tempMackObject.set('Version', ua.version);

                        //ASO记录信息(new)
                        tempMackObject.set('asoKey', taskObject.get('searchKeyword'));
                        tempMackObject.set('appleId', appObject.get('appleId'));

                        tempMackObject.save().then(function(tempMackObject){
                            receiveTaskObject.set('tempMackTask', tempMackObject);
                            receiveTaskObject.increment('receiveRemainCount', -1);
                            receiveTaskObject.save().then(function(){

                                if(tempUserObject.get('phoneNumber') == undefined || tempUserObject.get('phoneNumber').length == 0) {
                                    res.json({'errorId': 0, 'message': '恭喜您完成了任务(1天内完成审核)<br><br>现在绑定手机号,让您的帐号和小马零花钱不丢失<br>(清除浏览记录会丢失帐号)'});
                                }else {
                                    res.json({'errorId':0, 'message':'', 'requirementImgs':requirementImgs});
                                }

                            }, function (error) {
                                //更新任务失败
                                console.error('upload task img failed(save task):' + taskStatus + 'error:' + error.message);
                                res.json({'message':error.message, 'errorId': error.code});
                            });
                        }, function (error) {
                            //更新任务失败
                            console.error('upload task img failed(save task):' + taskStatus + 'error:' + error.message);
                            res.json({'message':error.message, 'errorId': error.code});
                        });
                    }
                    else
                    {
                        //该用户已经做过任务,想重新传图
                        var taskStatus = tempMackObject.get('taskStatus');
                        if (taskStatus == 'accepted' || taskStatus == 'systemAccepted'){
                            //任务已经完成,无需再做
                            res.json({'message':'任务已经完成喽', 'errorId': -100});
                        }else if (taskStatus == 'refused' && tempMackObject.get('canRedo') == 0) {
                            res.json({'message':'任务已经失败', 'errorId': -101});
                        }else if (taskStatus == 'expired') {
                            res.json({'message':'任务已经超时过期', 'errorId': -101});
                        }else {
                            //自己重新提交,或者被拒绝后重新做任务
                            //销毁以往图片
                            var images = tempMackObject.get('requirementImgs');
                            var query_file = new AV.Query(File);
                            query_file.containedIn('url', images);
                            query_file.find().then(function(imgResults){
                                for (var e = 0; e < imgResults.length; e++){
                                    imgResults[e].destroy().then(function(){
                                        //remove success
                                    })
                                }
                            });

                            //设备信息
                            tempMackObject.set('IP', clientIp);
                            tempMackObject.set('Browser', ua.browser);
                            tempMackObject.set('OS', ua.os);
                            tempMackObject.set('Platform', ua.platform);
                            tempMackObject.set('Version', ua.version);

                            tempMackObject.set('requirementImgs', requirementImgs);
                            tempMackObject.set('userInputArray', userInputArray);
                            //区分 自己提交和 拒绝后提交
                            if (taskStatus == 'refused' || taskStatus == 'reUploaded'){
                                tempMackObject.set('taskStatus', 'reUploaded');
                            }else {
                                tempMackObject.set('taskStatus', 'uploaded');
                            }
                        }

                        tempMackObject.save().then(function(){
                            res.json({'errorId':0, 'message':'', 'requirementImgs':requirementImgs});
                        }, function (error) {
                            //更新任务失败
                            console.error('upload task img failed(save task):' + taskStatus + 'error:' + error.message);
                            res.json({'message':error.message, 'uploadName':userUploadName, 'errorId': error.code});
                        });
                    }
                }
            }, function(error){
                console.error('upload task img failed(receive task object error):' + error.message);
                res.json({'errorId': error.code, 'message': error.message});
            });
        }

        var inviteCode = tempUserObject.get('inviteCode');

        if(inviteCode != undefined && inviteCode.length > 2){

            var mentorUserQuery = new AV.Query(mentorRelationSQL);
            mentorUserQuery.equalTo('user', tempUserObject);
            mentorUserQuery.equalTo('masterUserCode', inviteCode);
            mentorUserQuery.include('masterUser');
            mentorUserQuery.first().then(function (mentorObject) {
                dealUploadTask(mentorObject);
            }, function (error) {
                console.error('small horse master ' + masterCode + ' money error ', error.message);
                dealUploadTask(undefined);
            });

            //TODO RMB Logger
        }else {
            dealUploadTask(undefined);
        }
    }, function (error) {
        console.error('upload task img failed(temp user object error):' + error.message);
        res.json({'errorId': error.code, 'message': error.message});
    });
});

//我的任务
router.post('/myTask', function(req, res) {
    var userCId = Base64.decode(req.body.userCId);
    var tempUser = new tempUserSQL();
    tempUser.id = userCId;

    //小马试客,我的任务
    var query = new AV.Query(receiveTaskSQL);
    query.equalTo('tempUserObject', tempUser);
    query.notEqualTo('close', true);//过期
    query.lessThanOrEqualTo('showTimer', maxShowInvalidTask);

    query.include('taskObject');
    query.include('appObject');
    query.include('tempMackTask');
    query.descending('createdAt');

    query.find().then(function(results){
        //已完成/过期任务 3次展示后自动消失

        var retList = [];
        var undoTask = 0;
        var willGetRmb = 0;
        var needSaveReceList = [];

        for (var i = 0; i < results.length; i++){
            var receTaskObject = results[i];
            var taskObject = receTaskObject.get('taskObject');
            var appObject = receTaskObject.get('appObject');
            var tempMackObject = receTaskObject.get('tempMackTask');

            var myTaskDic = Object();
            if(appObject == undefined || taskObject == undefined){
                continue;
            }

            myTaskDic.taskId = taskObject.id;
            myTaskDic.appIcon = appObject.get('artworkUrl100');
            myTaskDic.appName = appObject.get('trackName');

            myTaskDic.doTaskPrice = receTaskObject.get('tempUserPrice');
            if(myTaskDic.doTaskPrice == 0){
                var rateUnitPrice = receTaskObject.get('rateUnitPrice');
                var doTaskPrice = YCoinToRMBRate * rateUnitPrice;
                myTaskDic.doTaskPrice = parseInt(doTaskPrice * 100)/100;
            }

            //status
            if(tempMackObject == undefined){
                //未做(时间)
                if(receTaskObject.get('expiredCount') == 0){
                    myTaskDic.statusDes = '未完成';

                    var now = new Date();
                    var leftTime = tempTaskMaxTime - (now.getTime() - receTaskObject.createdAt.getTime());
                    if(leftTime < 10){
                        //已经超时
                        myTaskDic.statusDes = '已超时';
                        unlockTaskWithRes(receTaskObject.id, undefined);
                    }else {
                        undoTask++;
                        willGetRmb += myTaskDic.doTaskPrice;
                        myTaskDic.createdAt = receTaskObject.createdAt.toLocaleDateString() + ' ' + receTaskObject.createdAt.toLocaleTimeString();
                    }
                }else {
                    //超时未做过期
                    myTaskDic.statusDes = '已超时';
                    receTaskObject.increment('showTimer', 1);
                    needSaveReceList.push(receTaskObject);
                }
            }else {
                //做了
                var taskStatus = tempMackObject.get('taskStatus');
                if (taskStatus == 'uploaded' || taskStatus == 'reUploaded'){
                    //审核中(时间)
                    myTaskDic.statusDes = '审核中';
                    //myTaskDic.createdAt = receTaskObject.createdAt;
                }else if (taskStatus == 'accepted' || taskStatus == 'systemAccepted'){
                    //完成
                    myTaskDic.statusDes = '已完成';
                    receTaskObject.increment('showTimer', 1);
                    needSaveReceList.push(receTaskObject);
                }else if(taskStatus == 'refused'){
                    //拒绝
                    myTaskDic.statusDes = '被拒绝';
                    receTaskObject.increment('showTimer', 1);
                    myTaskDic.refuseReason = tempMackObject.get('detail');
                }else if(taskStatus == 'expired'){
                    //拒绝未更新过期
                    myTaskDic.statusDes = '已超时';
                    receTaskObject.increment('showTimer', 1);
                    needSaveReceList.push(receTaskObject);
                }
            }

            retList.push(myTaskDic);
        }

        //save
        if(needSaveReceList.length > 0){
            AV.Object.saveAll(needSaveReceList).then(function(avobjs){
                //
            }, function(error){
                //
            });
        }

        res.json({'errorId': 0, 'message': '', 'masterConfig' : tryPriceUtil.masterConfigInfo(), 'tempTaskMaxTime': tempTaskMaxTime, 'retList': retList, 'undoTask': undoTask, 'willGetRmb': willGetRmb});
    }, function(error){
        console.error('get temp user tasks error:' + error.message);
        res.json({'errorId': error.code, 'message': error.message});
    });
});



//处理每次上传任务后数据不对的情况
function closeSmallHorseTaskObject(){

    if(process.env.smallHorseProtectEndHour == undefined){
        return;
    }

    console.log('--------------------------------------------');
    console.log('run closeSmallHorseTaskObject to deal small horse task');
    console.log('____________________________________________');

    var nowTime = new Date().getTime();

    var canIsOneHour = nowTime - tempTaskMaxTime;
    var oneHour = new Date(canIsOneHour);

    var taskObjects = [];

    var receTaskQuery = new AV.Query(receiveTaskSQL);
    receTaskQuery.exists('tempUserObject');
    receTaskQuery.doesNotExist('tempMackTask');
    receTaskQuery.lessThanOrEqualTo('createdAt', oneHour);
    receTaskQuery.find().then(function(receiveTaskObjectInfo){
        for (var i = 0; i < receiveTaskObjectInfo.length; i++){
            var receTaskObject = receiveTaskObjectInfo[i];

            var taskObject = util.addLeanObject(receTaskObject.get('taskObject'), taskObjects);

            var doTaskObject = receTaskObject.get('tempMackTask');
            if(doTaskObject == undefined) {

                //任务超时未做
                if(taskObject != undefined){
                    console.log(receTaskObject.id + ' destroy succeed and change task object : ' + taskObject.id);
                    taskObject.increment('remainCount', 1);
                }
                leanObjectRedis.releaseRedisTask(taskObject.id, receTaskObject.get('tempUserObject').id, 1);
                receTaskObject.destroy().then(function (success) {

                }, function (error) {
                    // 删除失败
                    console.error('lean up service and destroy failed, ', error.message);
                });
            }
        }

        if(taskObjects.length > 0){
            AV.Object.saveAll(taskObjects).then(function(){

            }, function(error){
                console.error('lean up service and save all failed, ', error.message);
            });

            //仅有需要处理的任务,才开启定时器
            console.log('service restart time start');
            setTimeout(closeSmallHorseTaskObject, tempTaskMaxTime);
        }
    },function(error){
        console.error('closeSmallHorseTaskObject error ', error.message);
    })

}

closeSmallHorseTaskObject();

module.exports = router;