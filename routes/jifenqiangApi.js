/**
 * Created by wujiangwei on 2017/1/8.
 */

var express = require('express');
var router = express.Router();
var AV = require('leanengine');
var _ = require('underscore');
var util = require('./util');
var Base64 = require('../public/javascripts/vendor/base64').Base64;

var leanObjectRedis = require('../utils/leanObjectRedis');

var tempUserSQL = AV.Object.extend('tempUser');
var openedAppRecordSQL = AV.Object.extend('openedAppRecord'); // 记录app打开的时间
var receiveTaskObjectSQL = AV.Object.extend('receiveTaskObject'); // 领取任务的库

//上传用户已经安装的Apps
router.post('/installedApps', function(req, res) {
    var userCId = Base64.decode(req.body.userCId);
    var newInstalledAppIds = req.body.installedAppIds;

    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function(tempUserObject){
        //对用户新的手机上的 App的bundle ids 和 数据库的取并集（永远不删除用户做过的任务）

        var installedAppBundleIds = tempUserObject.get('installedAppBundleIds');
        var prepareSavedTempUser = new tempUserSQL();
        prepareSavedTempUser.id = userCId;
        if(installedAppBundleIds == undefined){
            prepareSavedTempUser.set('installedAppBundleIds', newInstalledAppIds);
        }else {
            //取并集,且去重
            var bingInstalledAppBundleIds = _.union(newInstalledAppIds, installedAppBundleIds);
            prepareSavedTempUser.set('installedAppBundleIds', bingInstalledAppBundleIds);
        }

        prepareSavedTempUser.save().then(function (savedObject) {
            res.json({'errorId':0, 'errorMsg':'save succeed'})
        }, function (error) {
            res.json({'errorId': error.code, 'message': error.message});
        });

        res.json({'errorId':0, 'errorMsg':''})
    },function(error){
        res.json({'errorId': error.code, 'message': error.message});
    });
});

// 打开App
router.post('/openedApp', function(req, res){
    //记录用户已经打开了某个应用，并且需要使用三分钟
    var userCId = Base64.decode(req.body.userCId);

    var userObject = new tempUserSQL();
    userObject.id = userCId;

    var openedAppId = req.body.openedAppId;

    var deviceType = req.body.deviceType; // 设备类型
    var deviceName = req.body.deviceName; // 设备名称
    var MACAddress = req.body.MACAddress; // mac地址
    var OSVersion = req.body.OSVersion; // 系统版本号
    var totalDiskSpace = req.body.totalDiskSpace; // 手机存储空间
    var freeDiskSpace = req.body.freeDiskSpace; // 可用手机存储空间
    var isJailBreak = req.body.isJailBreak; // 是否越狱
    var netStatus = req.body.netStatus; // 网络状态
    var IPAddress = req.body.IPAddress; // IP地址
    var isSimulateIDFA = req.body.isSimulateIDFA; // 是否是虚拟IDFA（用户如果限制了广告追踪，则是虚拟的）

    var phoneInfoidFa = req.body.idfa; // 广告追踪符

    console.log('设备类型:' + deviceType);
    console.log('设备名称:' + deviceName);
    console.log('系统版本号:' + OSVersion);
    console.log('是否越狱:' + isJailBreak);
    console.log('广告追踪符:' + phoneInfoidFa);
    console.log('ip地址:' + IPAddress);

    var query = new AV.Query(receiveTaskObjectSQL);
    query.equalTo('tempUserObject', userObject);
    query.equalTo('bundleId', openedAppId);
    query.first().then(function(recTaskObject){

        var openedAppRecordObject = new openedAppRecordSQL();
        openedAppRecordObject.set('tempUserObject', userObject);
        openedAppRecordObject.set('openedAppId', openedAppId);
        openedAppRecordObject.set('receiveTaskObject', recTaskObject);
        openedAppRecordObject.set('deviceType', deviceType);
        openedAppRecordObject.set('deviceName', deviceName);
        openedAppRecordObject.set('MACAddress', MACAddress);
        openedAppRecordObject.set('OSVersion', OSVersion);
        openedAppRecordObject.set('totalDiskSpace', totalDiskSpace);
        openedAppRecordObject.set('freeDiskSpace', freeDiskSpace);
        openedAppRecordObject.set('isJailBreak', isJailBreak);
        openedAppRecordObject.set('netStatus', netStatus);
        openedAppRecordObject.set('IPAddress', IPAddress);
        openedAppRecordObject.set('isSimulateIDFA', isSimulateIDFA);
        openedAppRecordObject.set('phoneInfoidFa', phoneInfoidFa);

        openedAppRecordObject.save().then(function(openedAppInfo){
            res.json({'errorId': 0, 'errorMsg': userCId, 'taskId':openedAppInfo.id});
        },function(error){
            res.json({'errorId': error.code, 'message': error.message});
        });
    },function(error){
        res.json({'errorId': error.code, 'message': error.message});
    });


    //var receTaskObject = new receiveTaskObjectSQL();
    //receTaskObject.id = taskObjectDetail.lockTaskId;

});

//领取奖励
router.post('/getJifenqiangMoney', function(req, res){
    //记录用户已经打开了某个应用，并且需要使用三分钟
    var userCId = Base64.decode(req.body.userCId);
    var taskId = req.body.taskId;
    var taskObjectDetail = req.body.taskObject;

    var userObject = new tempUserSQL();
    userObject.id = userCId;

    var query = new AV.Query(openedAppRecordSQL);
    query.include('receiveTaskObject');
    if (taskId != undefined){
        query.get(taskId).then(function(openedAppRecordObject){
            getMoney(openedAppRecordObject)

        },function(error){
            res.json({'errorId': error.code, 'message': error.message});
        });
    }else {
        query.equalTo('tempUserObject', userObject);
        query.equalTo('openedAppId', taskObjectDetail.bundleId);
        query.descending('createdAt');
        query.limit(1);
        query.first().then(function(openedAppRecordObject){
            if (openedAppRecordObject == undefined){
                res.json({'errorId': -1, 'errorMsg': 'APP未打开,请打开APP哦!'});
            }
            else {
                getMoney(openedAppRecordObject);
            }

        },function(error){
            res.json({'errorId': error.code, 'message': error.message});
        })
    }


    function getMoney(openedAppRecordObject){
        var nowDate = new Date();
        var nowDateTimeStr = nowDate.getHours()*60*60 +  nowDate.getMinutes() * 60 + nowDate.getSeconds();

        var openedAppTime = openedAppRecordObject.createdAt;
        var openedAppTimeStr = openedAppTime.getHours()*60*60 + openedAppTime.getMinutes()* 60 + openedAppTime.getSeconds();

        console.log('相差时间:' + (nowDateTimeStr - openedAppTimeStr));
        if (nowDateTimeStr - openedAppTimeStr < 180){
            res.json({'errorId': -1, 'errorMsg': '试玩时间不够喔,请重新打开APP'});
        }
        else {
            userObject.increment('todayMoney', taskObjectDetail.temUserUnitPrice);
            userObject.increment('totalMoney', taskObjectDetail.temUserUnitPrice);
            userObject.increment('currentMoney', taskObjectDetail.temUserUnitPrice);

            var receiveTaskObject = openedAppRecordObject.get('receiveTaskObject');
            receiveTaskObject.set('receiveRemainCount', 0);

            AV.Object.saveAll([userObject, receiveTaskObject]).then(function () {
                // 成功
                res.json({'errorId': 0, 'message': ''});
            }, function (error) {
                // 异常处理
                res.json({'errorId': error.code, 'message': error.message});
            });
        }
    }
});

module.exports = router;
