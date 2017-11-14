//截图任务Api
/**
 * Created by cailong on 2016/12/12.
 */
var express = require('express');
var router = express.Router();
var util = require('./util');
var AV = require('leanengine');

var Base64 = require('../public/javascripts/vendor/base64').Base64;
var File = AV.Object.extend('_File');

var tryPriceUtil = require('../utils/tryPriceUtil');
var leanObjectRedis = require('../utils/leanObjectRedis');

var tempUserSQL = AV.Object.extend('tempUser');  // 小马用户的库
var mackTaskSQL = AV.Object.extend('mackTaskInfo'); // 上传截图的库
var receiveTaskSQL = AV.Object.extend('receiveTaskObject'); // 领取任务的库
var releaseTaskSQL = AV.Object.extend('releaseTaskObject'); // 发布任务的库

var mentorRelationSQL = AV.Object.extend('mentorRelation'); // 师徒库

//防作弊
var requestIp = require('request-ip');
var userAgent = require('express-useragent');

//任务到小马的过滤策略
//2.下午2Pm后,2端任务同时进行
var startFunnelHour = parseInt(process.env.smallHorseProtectEndHour) || 13;    //<= XX:59
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
        taskDic.searchKeyword = taskObject.get('searchKeyword');

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

//获取任务大厅任务
router.get('/:userCId/:page', function(req, res, next) {
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

    if (userCId == undefined){
        //generation header code
        res.json({'errorId': -1, 'message': 'not register user'});
    }else {

        leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (tempUserObject) {
            //获取用户做过的任务(1个App同一版本用户只能做一次)
            //doTaskInfoSQL 都是有效任务(含有效锁定和已做过)
            var doTaskQuery = new AV.Query(receiveTaskSQL);
            doTaskQuery.equalTo('tempUserObject', tempUserObject);
            //最新1000个即可(模糊精准)
            doTaskQuery.descending('createdAt');
            doTaskQuery.limit(1000);

            //野马发布的任务,保护期外显示在小马
            //商城任务一直显示
            var yemaLockQuery = undefined;
            var myDate = new Date();

            //获取所有的发布的任务
            var releaseTaskQuery;

            var releaseTaskNoGetQuery = new AV.Query(releaseTaskSQL);
            releaseTaskNoGetQuery.notEqualTo('needGet', true);
            //排除掉我曾经做过的同版本的App的任务(不需要获取)
            releaseTaskNoGetQuery.doesNotMatchKeyInQuery('excUniqueCode', 'excUniqueCode', doTaskQuery);

            var releaseTaskNeedGetQuery = new AV.Query(releaseTaskSQL);
            releaseTaskNeedGetQuery.equalTo('needGet', true);
            //排除掉我曾经做过的同版本的App的任务(需要获取)
            releaseTaskNeedGetQuery.doesNotMatchKeyInQuery('appObject', 'appObject', doTaskQuery);

            releaseTaskQuery = new AV.Query.or(releaseTaskNoGetQuery, releaseTaskNeedGetQuery);

            //如果在保护期内,只显示商城的任务（野马发布任务里的不显示）
            //if(isInProtectDays(myDate) && myDate.getHours() >= minFunnelHour && myDate.getHours() <= startFunnelHour) {
            //    releaseTaskQuery.exists('adsRMBPerTask');
            //
            //    var releaseTaskXiaomaQuery = new AV.Query(releaseTaskSQL);
            //    releaseTaskXiaomaQuery.equalTo('sendPlatform', '小马');
            //
            //    releaseTaskQuery = AV.Query.or(releaseTaskQuery, releaseTaskXiaomaQuery);
            //
            //}

            if(tempUserObject.get('isManager') == true){
                //不是管理员
                releaseTaskQuery = new AV.Query(releaseTaskSQL);
            }

            releaseTaskQuery.equalTo('close', false);
            releaseTaskQuery.equalTo('cancelled', false);
            //releaseTaskQuery.greaterThan('remainCount', 0);

            releaseTaskQuery.greaterThanOrEqualTo('remainCount', 1);

            //脏用户
            if(tempUserObject.get('isBadUser') == true){
                releaseTaskQuery.equalTo('remainCount', 0);
            }

            //管理员视角
            if(tempUserObject.get('isManager') != true){
                releaseTaskQuery.notEqualTo('hidden', true);
            }

            var pageCount = 20;
            releaseTaskQuery.include('appObject');
            //releaseTaskQuery.equalTo('taskType', '评论');
            releaseTaskQuery.skip(page * pageCount);
            releaseTaskQuery.limit(pageCount);
            releaseTaskQuery.descending('createdAt');
            releaseTaskQuery.descending('tempUserPrice');
            releaseTaskQuery.descending('manualSortIndex');
            releaseTaskQuery.descending('remainCount');

            releaseTaskQuery.find().then(function(datas){

                var retArray = Array();
                for(var i = 0; i < datas.length; i++){
                    var taskInfo = taskObjectToDic(datas[i]);
                    if(taskInfo != undefined){
                        retArray.push(taskInfo);
                    }
                }

                res.json({'errorId': 0, 'message': '', 'tasks': retArray, 'masterConfig' : tryPriceUtil.masterConfigInfo()});

            }, function(error){
                res.json({'errorId': error.code, 'message': error.message});
            });

            //task check

        }, function (error) {
            res.json({'errorId': error.code, 'message': error.message});
        });
    }

    //get unique userCode
});


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

        var doTaskQuery = new AV.Query(releaseTaskSQL);
        //最新1000个即可(模糊精准)
        doTaskQuery.descending('createdAt');
        doTaskQuery.limit(1000);

        var releaseTaskNeedGetQuery = new AV.Query(receiveTaskSQL);
        releaseTaskNeedGetQuery.matchesKeyInQuery('appObject', 'appObject', doTaskQuery);

        releaseTaskNeedGetQuery.equalTo('tempUserObject', tempUserObject);
        releaseTaskNeedGetQuery.exists('taskObject');
        releaseTaskNeedGetQuery.include('appObject');
        releaseTaskNeedGetQuery.include('taskObject');

        releaseTaskNeedGetQuery.find().then(function(datas){

            var retArray = Array();
            var ongoingTaskArray = Array();
            for(var i = 0; i < datas.length; i++){
                var taskDic = Object();
                var appObject = datas[i].get('appObject');
                var taskObject = datas[i].get('taskObject');

                // app信息
                taskDic.appIcon = appObject.get('artworkUrl100');
                if(appObject.get('formattedPrice') != '免费'){
                    taskDic.formattedPrice = appObject.get('formattedPrice');
                }

                // 任务信息
                taskDic.taskId = taskObject.id;
                taskDic.searchKeyword = taskObject.get('searchKeyword');

                taskDic.taskType = taskObject.get('taskType');

                taskDic.remainCount = taskObject.get('remainCount');

                if (datas[i].get('receiveRemainCount') == 0){
                    retArray.push(taskDic);
                }
                else {
                    ongoingTaskArray.push(taskDic);
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

module.exports = router;