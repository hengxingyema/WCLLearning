/**
 * Created by cailong on 16/9/27.
 */

'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

var leanObjectRedis = require('../utils/leanObjectRedis');

var serviceChargeRate = parseFloat(process.env.smallHorseServiceChargeRate) || 0.02;

var tempUserSQL = AV.Object.extend('tempUser');
var recordWhoOperateObjectSql = AV.Object.extend('recordWhoOperateObject');

router.get('/app/manager', function(req, res) {
    res.render('withdrawDeposit');
});

// 申请提现后台数据
router.post('/app/withdrawDetail', function(req, res){
    //var canSeePlayMoneyUserIds = ['57e27a49a0bb9f0058b97544'];
    //canSeePlayMoneyUserIds = canSeePlayMoneyUserIds.concat(['57e277e0bf22ec00582c9ab6', '57e27ba3a0bb9f0058b9853d', '57e2773c0e3dd90069898320']);
    //
    //if(util.indexInList(userId, canSeePlayMoneyUserIds) == -1){
    //    res.json({'errorMsg':'请先登陆管理员账号', 'errorId': -100, 'tempUserInfoList':[]});
    //    return;
    //}

    var userWithdraw = req.body.userWithdraw;
    var query = new AV.Query(tempUserSQL);

    if (userWithdraw == '普通提现用户'){
        query.greaterThan('withdrawMoney', 0);
        query.notEqualTo('isBadUser', true);
        query.notEqualTo('isMarketingUser', true);
        query.notEqualTo('isMarketingApprentice', true);
        query.descending('withdrawDate');
        query.limit(1000);
    }else if(userWithdraw == '推广大使'){
        query.greaterThan('withdrawMoney', 0);
        query.notEqualTo('isBadUser', true);
        query.equalTo('isMarketingUser', true);
        query.notEqualTo('isMarketingApprentice', true);
        query.descending('withdrawDate');
        query.limit(1000);
    }else {
        query.greaterThan('withdrawMoney', 0);
        query.notEqualTo('isBadUser', true);
        query.equalTo('isMarketingApprentice', true);
        query.descending('withdrawDate');
        query.limit(1000);
    }

    query.find().then(function(tempUserObj){
        var tempUserArray = Array();
        for (var i = 0; i < tempUserObj.length; i++){
            var tempUserObject = Object();
            tempUserObject.objectId = tempUserObj[i].id;
            tempUserObject.userCodeId = tempUserObj[i].get('userCodeId');  // 用户的名字代号
            tempUserObject.totalMoney = tempUserObj[i].get('totalMoney');  // 总金额
            tempUserObject.taskCount = tempUserObj[i].get('taskCount');   // 做任务数
            tempUserObject.aliAccount = tempUserObj[i].get('aliAccount');
            tempUserObject.currentMoney = tempUserObj[i].get('currentMoney'); // 可用金额
            tempUserObject.withdrawMoney = tempUserObj[i].get('withdrawMoney');  // 申请提现金额
            tempUserObject.withdrawDate = tempUserObj[i].get('withdrawDate');  // 申请提现日期
            tempUserObject.apprenticeTaskCount = tempUserObj[i].get('apprenticeTaskCount');  // 徒弟完成任务数
            tempUserObject.aliPayUserName = tempUserObj[i].get('aliPayUserName');  // 姓名

            tempUserArray.push(tempUserObject)
        }
        res.json({'tempUserInfoList': tempUserArray, 'errorId':0, 'errorMsg':''})
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});

// 点击确认打款
router.post('/app/playMoney', function(req, res){
    var userId = util.useridInReq(req);

    var userObject = new AV.User();
    userObject.id = userId;

    var nowDate = new Date();
    var operTime = nowDate.getFullYear() + '-' + (nowDate.getMonth() + 1) + '-' + nowDate.getDate();

    if(userId == undefined){
        res.json({'errorMsg':'请先登陆账号', 'errorId': -100});
        return;
    }

    var tempUserId = req.body.tempUserId;
    var withdrawMoney = req.body.withdrawMoney;

    leanObjectRedis.fetchLeanObjectFromCache(tempUserId, 'tempUser').then(function(userInfoObject){
        var serviceChargeMoney;

        if(userInfoObject.get('isMarketingApprentice') == true){
            //推广大使徒弟不扣手续费
            serviceChargeMoney = 0;
        }else {
            serviceChargeMoney = userInfoObject.get('withdrawMoney') * serviceChargeRate;
        }

        var tempUserObject = new tempUserSQL();
        tempUserObject.id = tempUserId;

        tempUserObject.increment('currentMoney', -serviceChargeMoney);
        tempUserObject.increment('withdrawMoney', -withdrawMoney);

        tempUserObject.save().then(function(){
            userInfoObject.increment('currentMoney', -serviceChargeMoney);
            userInfoObject.increment('withdrawMoney', -withdrawMoney);
            var recordWhoOperateObj = new recordWhoOperateObjectSql();
            recordWhoOperateObj.set('operateUser', userObject);
            recordWhoOperateObj.set('receiveUser', userInfoObject);
            recordWhoOperateObj.set('payMoney', withdrawMoney);
            recordWhoOperateObj.set('serviceChargeMoney', serviceChargeMoney);
            recordWhoOperateObj.save();

            res.json({'errorMsg':'', 'errorId': 0});
        },function(error){
            res.json({'errorMsg':error.message, 'errorId': error.code});
        })
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })

});

// 小马有效用户数据
router.get('/tempEffectiveUser', function(req, res) {
    res.render('tempEffectiveUser');
});

router.get('/effectiveUser/:pageCount', function(req, res){
    var pageIndex = parseInt(req.params.pageCount);
    var hasmore = 1;
    var queryTotalUser = new AV.Query(tempUserSQL);
    queryTotalUser.exists('phoneNumber');
    queryTotalUser.count().then(function(count){
        var totalCount = count;

        var query = new AV.Query(tempUserSQL);
        query.exists('phoneNumber');
        query.skip(pageIndex);
        query.limit(500);
        query.descending('createdAt');
        query.find().then(function(results){
            if (totalCount > results.length + pageIndex){
                hasmore = 1;
            }else {
                hasmore = 0;
            }

            var tempUserArray = Array();
            for (var i = 0; i < results.length; i++){
                var tempUserObject = Object();
                tempUserObject.userCodeId = results[i].get('userCodeId');  // 用户的名字代号
                tempUserObject.aliAccount = results[i].get('aliAccount');

                tempUserObject.phoneNumber = results[i].get('phoneNumber');
                tempUserObject.aliPayUserName = results[i].get('aliPayUserName');  // 姓名
                tempUserObject.withdrawDate = results[i].createdAt;

                tempUserArray.push(tempUserObject)
            }
            res.json({'effectiveTempUserList': tempUserArray, 'hasMore':hasmore,'errorId':0, 'errorMsg':''})

        })

    })

});

module.exports = router;