var express = require('express');
var AV = require('leanengine');
var router = express.Router();
var https = require('https');
var util = require('./util');

var Base64 = require('../public/javascripts/vendor/base64').Base64;

var IOSAppExcLogger = AV.Object.extend('IOSAppExcLogger');
var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var releaseTaskObject = AV.Object.extend('releaseTaskObject'); // 发布任务库
var receiveTaskObject = AV.Object.extend('receiveTaskObject'); // 领取任务库
var mackTaskObjectSql = AV.Object.extend('mackTaskInfo'); // 领取任务库

var leanObjectRedis = require('../utils/leanObjectRedis');

/* GET home page. */
router.get('/', function(req, res, next) {
    res.sendFile('./views/index.html');
});

router.get('/index/homeNotice', function(req, res) {
    var userId = util.useridInReq(req);

    leanObjectRedis.fetchLeanObjectFromCache(userId, '_User').then(function(userObject){
        var firstRecharge = userObject.get('firstRecharge');
        // if(firstRecharge == 0){
        //     res.json({'errorId':0, 'errorMsg':'', 'homeNotice': '首充双倍'})
        // }else {
        //     res.json({'errorId':0, 'errorMsg':'no activity'})
        // }
        res.json({'errorId':0, 'errorMsg':'no activity'})
    }, function(error){
        res.json({'errorId':error.code, 'errorMsg':error.message})
    })
});


router.get('/index', function(req, res){
    //未做任务和拒绝的数
    var totalRefusedCount = undefined;
    var totalUndoCount = undefined;

    var userId = util.useridInReq(req);
    var userObject = new AV.User();
    userObject.id = userId;

    //用户被拒绝任务条数
    //可以重新做的
    var refusedTaskQuery = new AV.Query(mackTaskObjectSql);
    refusedTaskQuery.equalTo('doTaskUser', userObject);
    refusedTaskQuery.equalTo('taskStatus', 'refused');
    refusedTaskQuery.notEqualTo('canRedo', 0);

    // var refusedUnDoTaskQuery = new AV.Query(mackTaskObjectSql);
    // refusedUnDoTaskQuery.equalTo('doTaskUser', userObject);
    // //不能被重新做的任务（2天内）
    // refusedUnDoTaskQuery.equalTo('taskStatus', 'refused');
    // refusedUnDoTaskQuery.equalTo('canRedo', 0);
    // // refusedUnDoTaskQuery.greaterThanOrEqualTo('updatedAt', util.getOffTimer(0, 0, 0, 0));
    // refusedUnDoTaskQuery.greaterThanOrEqualTo('updatedAt', util.getOffTimer(2, 0, 0, 0));

    // refusedTaskQuery = AV.Query.or(refusedTaskQuery, refusedUnDoTaskQuery);
    refusedTaskQuery.count().then(function(count){
        totalRefusedCount = count;
        resposeBack();
    },function (error) {
        totalRefusedCount = 0;
        resposeBack();
    });

    //用户未做任务条数
    var yemaUndoReceiveQuery = new AV.Query(receiveTaskObject);
    //前一日下午6点前提交的任务
    yemaUndoReceiveQuery.equalTo('userObject', userObject);
    yemaUndoReceiveQuery.greaterThan('receiveRemainCount', 0);
    yemaUndoReceiveQuery.equalTo('close', false);
    yemaUndoReceiveQuery.ascending('createdAt');
    yemaUndoReceiveQuery.limit(1000);
    yemaUndoReceiveQuery.find().then(function(results){

        var undoCount = 0;
        for(var i = 0; i < results.length; i++) {
            var receiveTaskObject = results[i];
            undoCount += receiveTaskObject.get('receiveRemainCount');
        }
        totalUndoCount = undoCount;

        resposeBack();
    }, function (error) {
        totalUndoCount = 0;
        resposeBack();
    });

    function resposeBack(){
        if(totalRefusedCount != undefined && totalUndoCount != undefined){
            res.json({'totalUndoCount':totalUndoCount, 'totalRefusedCount':totalRefusedCount,'errorId':0, 'errorMsg':''})
        }
    }
});

// 首页导航栏api
router.get('/index/unCheckTaskCount', function(req, res){
    var userId = util.useridInReq(req);
    var releaseTaskUser = new AV.User();
    releaseTaskUser.id = userId;

    //用户未审核任务个数
    var unCheckTaskQuery = new AV.Query(mackTaskObjectSql);
    unCheckTaskQuery.equalTo('releaseTaskUser', releaseTaskUser);
    unCheckTaskQuery.containedIn('taskStatus', ['uploaded', 'reUploaded']);
    unCheckTaskQuery.count().then(function(pendingCount){
        res.json({'pendingCount':pendingCount, 'userObjectId':Base64.encode(userId), 'errorId':0, 'errorMsg':''})
    },function (error) {
        res.json({'pendingCount':0, 'userObjectId':Base64.encode(userId), 'errorId':error.code, 'errorMsg':error.message})
    });
});

module.exports = router;
