/**
 * Created by apple on 8/16/16.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');


var User = AV.Object.extend('_User');
var releaseTaskObject = AV.Object.extend('releaseTaskObject');
var receiveTaskObject = AV.Object.extend('receiveTaskObject');
var mackTaskInfo = AV.Object.extend('mackTaskInfo');
var appInfoSql = AV.Object.extend('IOSAppInfo');

function sameDate(date1, date2){
    if (date1.getFullYear() == date2.getFullYear() &&
        date1.getMonth() == date2.getMonth() &&
        date1.getDate() == date2.getDate()){
        return true;
    }
    else return false;
}

function pushIntoArray(array, newItem){
    for (var i = 0; i < array.length; i++){
        if (array[i] == newItem){
            return;
        }
    }
    array.push(newItem);
    return;
}


router.get('/', function(req, res) {
    res.render('webAnalysis');
});

router.post('/webData', function(req, res){

    //BUGBUG 不准确数据

    //console.log('webData Post');
    var timePosted = req.body.currentTime;
    var currentTime = new Date();
    var fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    //currentTime.setDate(currentTime.getDate() - 5);


    //需要返回的数据
    var totalUsers = 0;

    var totalReleaseTaskToday = 0;
    var totalReleaseTaskAmountToday = 0;
    var releaseTaskUserIds = [];

    var totalReceiveTaskToday = 0;
    var totalReceiveTaskAmountToday = 0;
    var receiveTaskUserIds = [];
    var totalReceiveTaskError = 0;

    //query结束标示
    var flags = {};
    flags['userFlag'] = false;
    flags['releaseTaskFlag'] = false;
    flags['receiveTaskFlag'] = false;


    //数据返回测试
    function rtnJson(){
        //console.log('tried');
        for (var x in flags){
            if (flags[x] == false){
                return;
            }
        }
        //console.log('returned');
        res.json({'errorId': 0, 'errorMsg':'',
            'totalUsers': totalUsers,
            'totalReleaseTaskToday': totalReleaseTaskToday,
            'totalReleaseTaskAmountToday':totalReleaseTaskAmountToday,
            'releaseTaskUserIds':releaseTaskUserIds,

            'totalReceiveTaskToday': totalReceiveTaskToday,
            'totalReceiveTaskAmountToday': totalReceiveTaskAmountToday,
            'receiveTaskUserIds': receiveTaskUserIds,
            'totalReceiveTaskError':totalReceiveTaskError});
    }

    var userQuery = new AV.Query(User);
    userQuery.count().then(function(count){
        totalUsers = count;
        flags['userFlag'] = true;
        rtnJson();
    });

    var releaseTaskQuery = new AV.Query(releaseTaskObject);
    releaseTaskQuery.greaterThanOrEqualTo('createdAt', fiveDaysAgo);
    releaseTaskQuery.limit(1000);
    releaseTaskQuery.include('userObject');
    releaseTaskQuery.find().then(function(tasks){
        for (var i = 0; i < tasks.length; i++){
            var createdAt = tasks[i].createdAt;
            if (sameDate(createdAt, currentTime)){
                totalReleaseTaskToday++;
                totalReleaseTaskAmountToday += tasks[i].get('excCount');
                var userId = tasks[i].get('userObject').id;
                pushIntoArray(releaseTaskUserIds, userId)
            }
        }
        flags['releaseTaskFlag'] = true;
        rtnJson();
    });

    var receiveTaskQuery = new AV.Query(receiveTaskObject);
    receiveTaskQuery.greaterThanOrEqualTo('createdAt', fiveDaysAgo);
    receiveTaskQuery.limit(1000);
    receiveTaskQuery.include('userObject');
    receiveTaskQuery.find().then(function(tasks){
        for (var i = 0; i < tasks.length; i++){
            var createdAt = tasks[i].createdAt;
            if (sameDate(createdAt, currentTime)){
                if (tasks[i].get('receiveCount') != undefined){
                    totalReceiveTaskToday++;
                    totalReceiveTaskAmountToday += tasks[i].get('receiveCount');
                    var userId = tasks[i].get('userObject').id;
                    pushIntoArray(receiveTaskUserIds, userId)
                }
                else {totalReceiveTaskError++;}
            }
        }
        console.log(totalReceiveTaskAmountToday);
        flags['receiveTaskFlag'] = true;
        rtnJson();
    })
});


//才龙

// 野马用户累积发布任务数和完成有效数
router.get('/taskCount', function(req, res){

    var releaseTotalCount = 0; // 发布任务总数
    var receiveTotalCount = 0; // 完成有效任务数
    var enterAppCount = 0;     // 入驻App数
    var byRefused = 0;         // 被拒绝率

    //野马上线多少天
    var currentTime = Date.now();  // 获取指定时间时间戳

    // 注：野马是2016年8月1日上线的, 月份需要减1,因为从0开始算的
    var targetTime = new Date(2016, 7, 1).getTime();

    // 获取差值，如果指定日期早于现在，则为负数
    var offsetTime = targetTime - currentTime;

    // 求绝对值，获取相差的时间
    offsetTime = Math.abs(offsetTime);

    // 将时间转位天数
    // 注：Javascript中时间戳的单位是毫秒
    var onlineTime = Math.floor(offsetTime / (1000 * 60 * 60 * 24));

    var beilv = 2;

    //query结束一个钥匙
    var releaseTaskFlag = false;
    var receiveTaskFlag = false;
    var enterAppCountFlag = false;
    var byRefusedFlag = false;

    // 共发布多少条
    var query = new AV.Query(releaseTaskObject);
    query.count().then(function(releaseTaskObjCount){
        releaseTotalCount = releaseTaskObjCount * beilv;
        releaseTaskFlag = true;
        rtnJson();
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });

    // 累计完成App下载/好评数（条）
    var queryReceive = new AV.Query(mackTaskInfo);
    queryReceive.count().then(function(count){
        receiveTotalCount = count * beilv;
        receiveTaskFlag = true;
        rtnJson();

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });

    // 被拒绝数
    var queryMackTask = new AV.Query(mackTaskInfo);
    queryMackTask.containedIn('taskStatus', ['expired', 'refused']);
    queryMackTask.count().then(function(byRefusedCount){
        byRefused = byRefusedCount * beilv;
        byRefusedFlag = true;
        rtnJson();
    });


    var queryApp = new AV.Query(appInfoSql);
    queryApp.count().then(function(appCount){
        enterAppCount = appCount * beilv;
        enterAppCountFlag = true;
        rtnJson();
    });

    //数据返回
    function rtnJson(){
        if (releaseTaskFlag == true && receiveTaskFlag == true && enterAppCountFlag == true && byRefusedFlag == true){
            res.json({'releaseTotalCount':releaseTotalCount, 'receiveTotalCount': receiveTotalCount, 'onlineTime':onlineTime,
                'finishRate':(byRefused/receiveTotalCount * 100.00).toFixed(2) + '%', 'enterAppCount': enterAppCount});
        }
    }

});

module.exports = router;
