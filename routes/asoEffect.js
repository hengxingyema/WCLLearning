/**
 * Created by wujiangwei on 2016/11/7.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

var IOSAppSQL = AV.Object.extend('IOSAppInfo');
var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var releaseTaskObject = AV.Object.extend('releaseTaskObject');
var receiveTaskObject = AV.Object.extend('receiveTaskObject');
var mackTaskInfo = AV.Object.extend('mackTaskInfo');


router.get('/', function(req, res) {
    res.render('asoEffect');
});


//*************页面左侧控制器条目*************************
router.get('/asoEffect/:appObjectId', function(req, res){
    var userId = util.useridInReq(req);
    var appObjectId = req.params.appObjectId;

    var user = new AV.User();
    user.id = userId;

    var query = new AV.Query(releaseTaskObject);
    query.equalTo('userObject', user);
    query.greaterThan('excCount', 0);

    if(appObjectId != 'all'){
        var appObject = new IOSAppSQL();
        appObject.id = appObjectId;
        query.equalTo('appObject', appObject);
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
});

module.exports = router;