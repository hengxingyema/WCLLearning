/**
 * Created by cailong on 2016/10/12.
 */

var express = require('express');
var router = express.Router();
var AV = require('leanengine');
var Base64 = require('../public/javascripts/vendor/base64').Base64;

var tempUserSQL = AV.Object.extend('tempUser');
var mentorRelationSQL = AV.Object.extend('mentorRelation');
var mackTaskInfoObjectSql = AV.Object.extend('mackTaskInfo');
var withdrawDepositsSql = AV.Object.extend('recordWhoOperateObject');


// 小马明细详情 按照评论 下载 徒弟 提现分类
router.get('/currentAsset/:type/:userCId/:page', function(req, res){
    if(req.params.userCId == 'null'){
        res.json({'errorId': -1, 'message': 'not register user'});
        return;
    }

    var userCId = Base64.decode(req.params.userCId);
    var userCIdObject = AV.Object.createWithoutData('tempUserSQL', userCId);
    var page = req.params.page;
    var type = req.params.type; //1下载 2评论
    var taskType = '';
    if (type == 1){
        taskType = '下载'
    }
    else if (type == 2){
        taskType = '评论'
    }
    else if (type == 3){
        taskType = '徒弟'
    }
    else if (type == 4){
        taskType = '提现'
    }

    var pageCount = 20;

    if (userCId == undefined){
        res.json({'errorId': -1, 'message': 'not register user'});
    }
    else {
        if (taskType == '下载' || taskType == '评论'){
            var temUserTaskQuery = new AV.Query(mackTaskInfoObjectSql);
            temUserTaskQuery.equalTo('tempUserObject', userCIdObject);
            temUserTaskQuery.containedIn('taskStatus', ['accepted', 'systemAccepted']);
            temUserTaskQuery.include('releaseTaskObject');
            temUserTaskQuery.include('receiveTaskObject');
            temUserTaskQuery.include('releaseTaskObject.appObject');
            temUserTaskQuery.skip(page * pageCount);
            temUserTaskQuery.limit(pageCount);
            temUserTaskQuery.descending('updatedAt');
            temUserTaskQuery.find().then(function(mackTaskObject){
                var retApps = Array();
                for (var i = 0; i < mackTaskObject.length; i++){
                    var currentAssetDetailObject = Object();
                    var releaseObject = mackTaskObject[i].get('releaseTaskObject');
                    var receiveObject = mackTaskObject[i].get('receiveTaskObject');
                    var appObjectInfo = releaseObject.get('appObject');

                    var taskTypeOp = releaseObject.get('taskType');
                    if (taskType === taskTypeOp){

                        // app信息
                        currentAssetDetailObject.appTrackName = appObjectInfo.get('trackName');

                        // 完成任务时间
                        currentAssetDetailObject.finishTime = mackTaskObject[i].createdAt;

                        // 完成任务得到的金额
                        currentAssetDetailObject.earnMoney = receiveObject.get('tempUserPrice');

                        retApps.push(currentAssetDetailObject);
                    }
                }
                res.json({'errorId': 0, 'errorMsg':'', 'retApps':retApps})
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            })
        }
        else if (taskType == '徒弟'){

            var temProtegeQuery = new AV.Query(mackTaskInfoObjectSql);
            temProtegeQuery.equalTo('tempMasterUserObject', userCIdObject);
            temProtegeQuery.containedIn('taskStatus', ['accepted', 'systemAccepted']);
            temProtegeQuery.exists('tempMasterUserMoney');
            temProtegeQuery.include('tempUserObject');
            temProtegeQuery.include('mentorObject');
            temProtegeQuery.include('appObject');
            temProtegeQuery.include('receiveTaskObject');
            temProtegeQuery.skip(page * pageCount);
            temProtegeQuery.limit(pageCount);
            temProtegeQuery.descending('updatedAt');
            temProtegeQuery.find().then(function(protegeObjects){
                var discipleArray = Array();
                for (var d = 0; d < protegeObjects.length; d++){
                    var protegeObject = Object();

                    // 任务完成时间
                    protegeObject.finishTime = protegeObjects[d].updatedAt;

                    // 徒弟为师傅赚的钱
                    protegeObject.protegeForMasterEarnMoney = protegeObjects[d].get('tempMasterUserMoney');

                    // 徒弟Id
                    var tempUserObject = protegeObjects[d].get('tempUserObject');
                    protegeObject.protegeUserCodeId = tempUserObject.get('userCodeId');

                    // app名字
                    var appObject = protegeObjects[d].get('appObject');
                    protegeObject.appTrackName = appObject.get('trackName');

                    discipleArray.push(protegeObject);

                }

                res.json({'errorId': 0, 'errorMsg':'', 'discipleArray':discipleArray})
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
        }
        else if (taskType == '提现'){
            var withdrawQuery = new AV.Query(withdrawDepositsSql);
            withdrawQuery.equalTo('receiveUser', userCIdObject);
            withdrawQuery.include('receiveUser');
            withdrawQuery.skip(page * pageCount);
            withdrawQuery.limit(pageCount);
            withdrawQuery.descending('createdAt');
            withdrawQuery.find().then(function(withdrawInfo){
                var withdrawInfoArray = Array();
                for (var e = 0; e < withdrawInfo.length; e++){
                    var withdrawInfoObject = Object();
                    var temUserObject = withdrawInfo[e].get('receiveUser');

                    //提现金额
                    withdrawInfoObject.depositsRMB = withdrawInfo[e].get('payMoney');

                    // 支付宝帐号信息
                    withdrawInfoObject.aliAccount = temUserObject.get('aliAccount');

                    // 提现日期
                    withdrawInfoObject.depositsTime = withdrawInfo[e].createdAt;

                    withdrawInfoArray.push(withdrawInfoObject)
                }
                res.json({'depositsList':withdrawInfoArray, 'errorId':0, 'errorMsg':''})
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            })
        }
    }

});

module.exports = router;

