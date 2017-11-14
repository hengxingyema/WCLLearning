var express = require('express');
var router = express.Router();
var AV = require('leanengine');
var util = require('./util');
var tryPriceUtil = require('../utils/tryPriceUtil');
var Base64 = require('../public/javascripts/vendor/base64').Base64;

var tempUserSQL = AV.Object.extend('tempUser');
var mentorRelationSQL = AV.Object.extend('mentorRelation');

var leanObjectRedis = require('../utils/leanObjectRedis');
var lotteryRecordSQL = AV.Object.extend('lotteryRecord');
var lotteryPoolSQL = AV.Object.extend('lotteryPool');
var telePhonePay = require('../utils/telephonePay');
var toUpDepositsSql = AV.Object.extend('tempUserWithdrawalObject');

//小马用户初始变量
//前多少次徒弟任务获得指定的钱
var beSmallHorseUserMoney = parseFloat(process.env.smallHorseUserOriginalMoney) || 1;
//前多少次徒弟任务获得指定的钱(多少钱)
var minUserWithDrawRMB = parseInt(process.env.smallHorseMinUserWithDrawRMB) || 10;
//师徒获取Y币比率
var serviceChargeRate = parseFloat(process.env.smallHorseServiceChargeRate) || 0.02;

function responseUserInfo(tempUserObject, inviteCode, apprenticeCount, res) {

    var userInfoObject = {};
    userInfoObject.masterCode = inviteCode;
    userInfoObject.userCId = Base64.encode(tempUserObject.id);
    userInfoObject.userCode = tempUserObject.get('userCodeId');

    userInfoObject.apprenticeMoney = tempUserObject.get('apprenticeMoney');
    userInfoObject.withdrawMoney = tempUserObject.get('withdrawMoney');
    userInfoObject.totalMoney = tempUserObject.get('totalMoney');
    userInfoObject.currentMoney = tempUserObject.get('currentMoney');
    userInfoObject.todayMoney = tempUserObject.get('todayMoney');
    userInfoObject.isMarketingUser = tempUserObject.get('isMarketingUser');
    userInfoObject.mobilePhoneNumber = tempUserObject.get('phoneNumber');
    userInfoObject.aliPayName = tempUserObject.get('aliAccount');

    userInfoObject.apprenticeCount = apprenticeCount;

    if (tempUserObject.get('userIcon') == undefined){
        userInfoObject.userIcon = 'http://ac-rbmsnntf.clouddn.com/c27fc165746589075f91.png'
    }else {
        userInfoObject.userIcon = tempUserObject.get('userIcon');
    }

    res.json({
        'userInfoObject':userInfoObject,
        'masterConfig' : tryPriceUtil.masterConfigInfo(),
        'errorId': 0, 'message': 'auto create account succeed'
    });
}


//获取用户(若不存在,则自动创建半账号),返回账号相关数据
router.post('/becomeMarketingUser', function(req, res) {
    var userCId = Base64.decode(req.body.userCId);
    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (data) {

        if(data.get('phoneNumber') == undefined || data.get('phoneNumber').length == 0){
            res.json({'errorId': 1, 'message': '推广大使帐号很重要,先绑定下手机号吧'});
            return;
        }
        data.set('isMarketingUser', true);

        data.save().then(function(){
            res.json({'errorId': 0, 'message': ''});
        }, function(error){
            res.json({'errorId': error.code, 'message': error.message});
        });

    }, function (error) {
        res.json({'errorId': error.code, 'message': error.message});
    });
});

function apprenticeSpaceIndex(totalMarketingCount) {
    // <li>有效徒弟20-49人,每位徒弟得0.4元奖励</li>
    // <li>有效徒弟50-99人,每位徒弟得0.5元奖励</li>
    // <li>有效徒弟100-199人,每位徒弟得0.6元奖励</li>
    // <li>有效徒弟200-399人,每位徒弟得0.7元奖励</li>
    // <li>有效徒弟400-699人,每位徒弟得0.8元奖励</li>
    // <li>有效徒弟700-999人,每位徒弟得0.9元奖励</li>
    // <li>有效徒弟超1000人,每位徒弟得1元奖励</li>
    var apprenticeCounts = [20, 50, 100, 200, 400, 700, 1000];
    var apprenticeRewards = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    var outRewardPerApprentice = 1;

    var rewardIndex = 0;
    for(var i = 0; i < apprenticeCounts.length; i++){
        if(totalMarketingCount < apprenticeCounts[0]){
            return rewardIndex;
        }
        if(i == apprenticeCounts.length - 1){
            if(totalMarketingCount > apprenticeCounts[apprenticeCounts.length - 1]){
                return outRewardPerApprentice;
            }
            return rewardIndex;
        }else {
            if(totalMarketingCount >= apprenticeCounts[i] && totalMarketingCount < apprenticeCounts[i + 1]){
                return apprenticeRewards[i];
            }
        }
    }
    return rewardIndex;
}

//查询推广大使有多少成功的推广人数
router.post('/marketingApprenticeCount', function(req, res) {
    var userCId = Base64.decode(req.body.userCId);
    var userCode = req.body.userCode;

    var tempUserQuery = new AV.Query(tempUserSQL);
    tempUserQuery.get(userCId).then(function (masterUserObject) {

        var usedMarketingApprenticeCount = masterUserObject.get('usedMarketingApprenticeCount');
        if(usedMarketingApprenticeCount == undefined){
            usedMarketingApprenticeCount = 0;
        }

        if(masterUserObject.get('isMarketingUser') == true){
            //是推广大使，查询有多少成功的徒弟了
            var apprenticeTempUserQuery = new AV.Query(tempUserSQL);
            apprenticeTempUserQuery.equalTo('inviteCode', userCode);
            apprenticeTempUserQuery.equalTo('isMarketingApprentice', true);
            apprenticeTempUserQuery.exists('phoneNumber');
            apprenticeTempUserQuery.greaterThanOrEqualTo('taskCount', 1);
            apprenticeTempUserQuery.count().then(function (totalCount) {
                var canUsedMartingApprenticeCount = totalCount - usedMarketingApprenticeCount;
                var marketingMessages = [];
                marketingMessages.push('您已经成功推广' + totalCount + '人');
                var rewardsPerApp = apprenticeSpaceIndex(totalCount);

                if(usedMarketingApprenticeCount > 0){
                    marketingMessages.push('你已经领取了:' + usedMarketingApprenticeCount + '个徒弟的奖励金额');
                }
                if(rewardsPerApp > 0){
                    marketingMessages.push('当前可领取奖励:' + canUsedMartingApprenticeCount + ' * ' + rewardsPerApp + '=' + (canUsedMartingApprenticeCount * rewardsPerApp) + '元');
                }else {
                    if(totalCount < 20){
                        marketingMessages.push('您还差' + (20 - totalCount) + '个徒弟方可领取推广奖励');
                    }
                }

                res.json({'errorId': 0, 'message': '', 'rewardMessages' : marketingMessages});
            }, function (error) {
                res.json({'errorId': error.code, 'message': error.message});
            })
        }else {
            res.json({'errorId': 1, 'message': '您不是推广大使'});
        }

    }, function (error) {
        res.json({'errorId': error.code, 'message': error.message});
    });
});

//获取推广奖励
router.post('/getMarketingApprenticeReward', function(req, res) {
    var userCId = Base64.decode(req.body.userCId);
    var userCode = req.body.userCode;

    var tempUserQuery = new AV.Query(tempUserSQL);
    tempUserQuery.get(userCId).then(function (masterUserObject) {

        var usedMarketingApprenticeCount = masterUserObject.get('usedMarketingApprenticeCount');
        if(usedMarketingApprenticeCount == undefined){
            masterUserObject.set('usedMarketingApprenticeCount', 0);
            usedMarketingApprenticeCount = 0;
        }

        if(masterUserObject.get('isMarketingUser') == true){
            //是推广大使，查询有多少成功的徒弟了
            var apprenticeTempUserQuery = new AV.Query(tempUserSQL);
            apprenticeTempUserQuery.equalTo('inviteCode', userCode);
            apprenticeTempUserQuery.exists('phoneNumber');
            apprenticeTempUserQuery.equalTo('isMarketingApprentice', true);
            apprenticeTempUserQuery.greaterThanOrEqualTo('taskCount', 1);
            apprenticeTempUserQuery.count().then(function (totalCount) {

                var isToday = true;
                var myDate = new Date();
                var month = (myDate.getMonth() + 1).toString();
                var day = myDate.getDate().toString();
                var yearStr = myDate.getFullYear().toString();
                var todayStr = yearStr + '-' + month + '-' + day;
                var todayMoneyDate = masterUserObject.get('todayMoneyDate');
                if(todayMoneyDate != todayStr){
                    //非当天赚到的钱
                    isToday = false;
                }

                var canUsedMartingApprenticeCount = totalCount - usedMarketingApprenticeCount;
                var marketingMessages = [];
                marketingMessages.push('您已经成功推广' + totalCount + '人');
                var rewardsPerApp = apprenticeSpaceIndex(totalCount);

                var canGetReward = canUsedMartingApprenticeCount * rewardsPerApp;

                if(canGetReward == 0){
                    res.json({'errorId': 1, 'message': '暂无推广奖励可领取,加油推广吧,奖励多多哦'});
                    return;
                }

                masterUserObject.increment('currentMoney', canGetReward);
                masterUserObject.increment('totalMoney', canGetReward);
                masterUserObject.increment('usedMarketingApprenticeCount', canUsedMartingApprenticeCount);
                if(isToday == true){
                    masterUserObject.increment('todayMoney', canGetReward);
                }else {
                    masterUserObject.set('todayMoneyDate', todayStr);
                    masterUserObject.set('todayMoney', canGetReward);
                }

                masterUserObject.save().then(function () {
                    res.json({'errorId': 0, 'message': '推广大使的奖励(' + canGetReward + '元)已经打入您的账户', 'temUserInfo': getUserMoneyInfo(masterUserObject)});
                },function (error) {
                    res.json({'errorId': error.code, 'message': error.message});
                });
            }, function (error) {
                res.json({'errorId': error.code, 'message': error.message});
            })
        }else {
            res.json({'errorId': 1, 'message': '您不是推广大使'});
        }

    }, function (error) {
        res.json({'errorId': error.code, 'message': error.message});
    });
});

//获取用户(若不存在,则自动创建半账号),返回账号相关数据
router.get('/:userCId/:inviteCode', function(req, res) {
    var userCId = req.params.userCId;
    var inviteCode = req.params.inviteCode;

    // console.log('userCId ' + userCId + ' inviteCode ' + inviteCode);

    var myDate = new Date();
    var month = (myDate.getMonth() + 1).toString();
    var day = myDate.getDate().toString();
    var yearStr = myDate.getFullYear().toString();
    var todayStr = yearStr + '-' + month + '-' + day;

    function generateNewUser(isMarketingApprentice){
        var myDate = new Date();
        var month = parseInt(myDate.getMonth()) + 1;
        var day = parseInt(myDate.getDate());
        var year = myDate.getFullYear().toString();
        var yearStr = year.substring(2, 4);

        //时间唯一标识码(2050前代码无问题)
        //16 + 12 + 31 = 59
        var codePre = (parseInt(yearStr) + month + day).toString();
        var userCode = codePre;

        var tempUserQuery = new AV.Query(tempUserSQL);
        tempUserQuery.startsWith('userCodeId', codePre);
        tempUserQuery.count().then(function (count) {
            //随机字符
            //BUGBUG count 不对
            var chars = ['0','0','0','0','0','0','0','0','0','0',
                'A','B','C','D','E','F','G','H','I','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z',
                'a','b','c','d','e','f','g','h','i','j','k','l','m','n','p','q','r','s','t','u','v','w','x','y','z'];

            var tailNum = 0; // 至少一位
            var tempCount = count;
            while(tempCount != 0)
            {
                tempCount = parseInt(tempCount / 10);
                tailNum++;
            }

            //目前最多6位,每天最多新增9999个用户
            for(var i = 0; i < 2; i++){
                var randomCharIndex = Math.floor(Math.random() * chars.length);
                userCode += chars[randomCharIndex];
            }
            userCode += count;

            var tempInitMoney = beSmallHorseUserMoney;
            if(isMarketingApprentice == true){
                tempInitMoney = 0;
            }
            //create temp account with code
            var newUser = new tempUserSQL();
            newUser.set('userCodeId', userCode);
            newUser.set('totalMoney', tempInitMoney);
            newUser.set('todayMoney', tempInitMoney);
            newUser.set('currentMoney', tempInitMoney);

            newUser.set('apprenticeMoney', 0);
            newUser.set('withdrawMoney', 0);

            newUser.set('todayMoneyDate', todayStr);
            newUser.save().then(function(tempUserObject){
                //console.log('first generate user succeed, masterCode = ' + inviteCode);
                //var masterCode = tempUserObject.get('inviteCode');

                //师徒关系
                if(inviteCode != undefined && inviteCode.length > 4 && inviteCode != 'home'){
                    bindMaster(userCode, inviteCode, undefined);
                }else {
                    inviteCode = undefined;
                }

                responseUserInfo(tempUserObject, inviteCode, 0, res);
            }, function(error){
                console.error('first generate user error, error = ' + error.message);
                res.json({'errorId': error.code, 'message': error.message});
            })

        }, function (error) {
            console.error('first generate user error, error = ' + error.message);
            res.json({'errorId': error.code, 'message': error.message});
        });
    }

    if (userCId == undefined || userCId == 'null' || userCId == 'undefined'){
        //generation header code
        if(inviteCode != undefined  && inviteCode != 'home'){
            //是不是推广大使，推广大使的徒弟无起始1元奖励
            var tempUserQuery = new AV.Query(tempUserSQL);
            tempUserQuery.equalTo('userCodeId', inviteCode);
            tempUserQuery.first().then(function (masterUserObject) {
                if(masterUserObject != undefined && masterUserObject.get('isMarketingUser') == true){
                    generateNewUser(true);
                }else {
                    generateNewUser(false);
                }

            }, function (error) {
                generateNewUser(false);
            });
        }else {
            generateNewUser(false);
        }
    }
    else {
        userCId = Base64.decode(req.params.userCId);
        leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (data) {

            if(data != undefined && data.get('error') != undefined){
                //BUGBUG redis里不知道为何有脏数据
                //TODO 如何清除redis里的脏数据？
                console.error('redis dirty data for tempuser.so generate new one');
                generateNewUser(false);
                return;
            }

            var todayMoney = 0;
            var todayMoneyDate = data.get('todayMoneyDate');
            if(todayMoneyDate != todayStr){
                //非当天赚到的钱
                todayMoney = 0;
                data.set('todayMoneyDate', todayStr);
                data.set('todayMoney', 0);
                data.save();
            }

            var userCode = data.get('userCodeId');
            var masterCode = data.get('inviteCode');
            //师徒关系
            if(inviteCode != undefined && inviteCode.length > 5 || inviteCode != 'home' || inviteCode != 'tab'){
                bindMaster(userCode, inviteCode, undefined);
            }

            if(masterCode != undefined && masterCode.length > 0){
                inviteCode = masterCode;
            }

            if(inviteCode == 'home' || inviteCode == 'tab'){
                inviteCode = undefined;
            }

            var mentorQuery = new AV.Query(mentorRelationSQL);
            mentorQuery.equalTo('masterUser', data);

            mentorQuery.count().then(function(apprenticeCount){

                responseUserInfo(data, inviteCode, apprenticeCount, res);

            }, function(error){
                responseUserInfo(data, inviteCode, 0, res);
            });

        }, function (error) {
            if(inviteCode != undefined && inviteCode != 'home'){
                //是不是推广大使，推广大使的徒弟无起始1元奖励
                var tempUserQuery = new AV.Query(tempUserSQL);
                tempUserQuery.equalTo('userCodeId', inviteCode);
                tempUserQuery.first().then(function (masterUserObject) {
                    if(masterUserObject != undefined && masterUserObject.get('isMarketingUser') == true){
                        generateNewUser(true);
                    }else {
                        generateNewUser(false);
                    }

                }, function (error) {
                    generateNewUser(false);
                });
            }else {
                generateNewUser(false);
            }
        });
    }

    //get unique userCode
});

function getUserMoneyInfo(savedObject){
    var temUserObject = Object();
    temUserObject.userCId = Base64.encode(savedObject.id);
    temUserObject.userCode = savedObject.get('userCodeId');
    temUserObject.aliAccount = savedObject.get('aliAccount');
    temUserObject.aliPayUserName = savedObject.get('aliPayUserName');
    //提现中金额
    temUserObject.withdrawMoney = savedObject.get('withdrawMoney');
    temUserObject.phoneNumber = savedObject.get('phoneNumber');

    temUserObject.isMarketingUser = savedObject.get('isMarketingUser');
    temUserObject.isMarketingApprentice = savedObject.get('isMarketingApprentice');

    if (savedObject.get('userIcon') == undefined){
        temUserObject.userIcon = 'http://ac-rbmsnntf.clouddn.com/c27fc165746589075f91.png'
    }else {
        temUserObject.userIcon = savedObject.get('userIcon');
    }

    if(temUserObject.isMarketingApprentice == true){
        //推广大师徒弟提现无限制
        temUserObject.canWithdrawMoney = savedObject.get('currentMoney');
        temUserObject.surplusMoney = 0;
        temUserObject.minUserWithDrawRMB = 0;
        //提现手续费
        temUserObject.chargeRate = 0;
    }else {
        //能提现的
        if(savedObject.get('currentMoney') < minUserWithDrawRMB){
            temUserObject.canWithdrawMoney = 0;
        }
        else {
            var minM = Math.floor(savedObject.get('currentMoney')/minUserWithDrawRMB);
            temUserObject.canWithdrawMoney = minM * minUserWithDrawRMB;
        }
        //剩余金额
        temUserObject.surplusMoney = Math.floor((savedObject.get('currentMoney') - temUserObject.canWithdrawMoney)*100)/100;
        temUserObject.minUserWithDrawRMB = minUserWithDrawRMB;
        //提现手续费
        temUserObject.chargeRate = parseInt(serviceChargeRate*100);
    }

    return temUserObject;
}

//绑定支付宝
router.post('/bindAliPay', function(req, res) {
    var userCId = Base64.decode(req.body.userCId);
    var aliAccount = req.body.aliAccount;

    var query = new AV.Query(tempUserSQL);
    query.equalTo('aliAccount', aliAccount);
    query.find().then(function(tempUserObject){
        if (tempUserObject.length > 0){
            res.json({'errorId':-2, 'message':'该支付宝已经绑定过'})
        }
        else {
            leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (tempUserObject) {
                if(tempUserObject.get('aliAccount') != undefined){
                    res.json({'errorId': -1, 'message': '无法修改支付宝,如需修改请联系管理人员!'});
                }
                else {
                    tempUserObject.set('aliAccount', aliAccount);
                    tempUserObject.save().then(function(){
                        res.json({'temUserInfo': getUserMoneyInfo(tempUserObject), 'errorId': 0, 'message': 'succeed bind your ali account'});
                    }, function(error){
                        console.error('bind zhifubao error:' + error.message);
                        res.json({'errorId': error.code, 'message': error.message});
                    })
                }
            }, function(error){
                console.error('bind zhifubao error:' + error.message);
                res.json({'errorId': error.code, 'message': error.message});
            });
        }


    },function(error){
        res.json({'errorId': error.code, 'message': error.message});
    });
});

//申请提现
router.post('/withDraw', function(req, res) {
    var userCId = Base64.decode(req.body.userCId);

    var nowDate = new Date();
    var withdrawDate = nowDate.getFullYear() + '/' + (nowDate.getMonth() + 1) + '/' + nowDate.getDate();
    //var aliAccount = req.body.aliAccount;
    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (tempUserObject) {
        var aliAccount = tempUserObject.get('aliAccount');
        if(aliAccount == undefined || aliAccount.length == 0){
            res.json({'errorId': -3, 'message': '请先绑定支付宝账号'});
            return;
        }
        if (tempUserObject.get('aliPayUserName') == undefined || tempUserObject.get('aliPayUserName').length == 0){
            res.json({'errorId': -3, 'message': '抱歉，支付宝提现须绑定与支付宝账号相同的姓名'});
            return;
        }

        if (tempUserObject.get('phoneNumber') == undefined || tempUserObject.get('phoneNumber') == '' ||
            tempUserObject.get('phoneNumber').length != 11){
            res.json({'errorId': -3, 'message': '请先填写手机号码'});
            return;
        }

        var currentMoney = tempUserObject.get('currentMoney');
        var withdrawMoney = tempUserObject.get('withdrawMoney');
        var isMarketingApprentice = tempUserObject.get('isMarketingApprentice');
        if(isMarketingApprentice != true && currentMoney < minUserWithDrawRMB){
            res.json({'errorId': -1, 'message': '亲,满' + minUserWithDrawRMB + '元才可以提现哦'});
        }
        else if(withdrawMoney > 0){
            res.json({'errorId': -2, 'message': '上一次提现正在进行中,会在1~2个工作日内到账,到帐后方可继续提现'});
        }
        else {
            if(isMarketingApprentice == true){
                withdrawMoney = currentMoney;
            }else {
                withdrawMoney = parseInt(currentMoney / minUserWithDrawRMB) * minUserWithDrawRMB;

                var serviceRecharge = withdrawMoney * serviceChargeRate;
                if(currentMoney - withdrawMoney < serviceRecharge){
                    res.json({'errorId': -3, 'message': '提现手续费不足: 本次提现需要' + serviceRecharge.toFixed(2) + '手续费'});
                    return;
                }
            }

            var changedTempUser = new tempUserSQL();
            changedTempUser.id  = userCId;
            changedTempUser.increment('currentMoney', -withdrawMoney);
            changedTempUser.increment('withdrawMoney', withdrawMoney);
            changedTempUser.set('withdrawDate', withdrawDate);

            tempUserObject.increment('currentMoney', -withdrawMoney);
            tempUserObject.increment('withdrawMoney', withdrawMoney);
            changedTempUser.save().then(function(savedObject){
                res.json({'errorId': 0, 'temUserInfo': getUserMoneyInfo(tempUserObject), 'message': '申请提现' + withdrawMoney + '元,将会在1~2个工作日内到账'});
            }, function(error){
                console.error('withdraw failed:' + error.message);
                res.json({'errorId': error.code, 'message': error.message});
            })
        }
    }, function(error){
        console.error('bind zhifubao error:' + error.message);
        res.json({'errorId': error.code, 'message': error.message});
    });
});

//TODO RMB Logger

/*-*********************************************
 *******************师徒关系**********************
 **********************************************-*/
//绑定邀请码
function bindMaster(userCode, masterUserCode, res){
    //query current day register number
    var tempUserQuery = new AV.Query(tempUserSQL);
    tempUserQuery.containedIn('userCodeId', [userCode, masterUserCode]);
    tempUserQuery.find().then(function (userDatas) {

        if(userDatas.length != 2){
            if(res != undefined){
                res.json({'errorId': -1, 'message': 'invite code not exist'});
            }
        }else {
            var masterUserObject, userObject;
            for(var i = 0; i < 2; i++){
                if(userDatas[i].get('userCodeId') == masterUserCode){
                    masterUserObject = userDatas[i];
                }else {
                    userObject = userDatas[i];
                }
            }

            //师傅是不是推广大师
            var isMarketingUser = masterUserObject.get('isMarketingUser');
            if(isMarketingUser == undefined){
                isMarketingUser = false;
            }

            //1.userObject 无师傅
            if(userObject.get('inviteCode') != undefined && userObject.get('inviteCode').length > 0){
                // console.log(userCode + ' have master:' + userObject.get('inviteCode'));
                if(res != undefined){
                    res.json({'errorId': -1, 'message': '你已经有师傅啦'});
                }
                return;
            }
            //2.masterUserObject 的师傅不是 userObject
            if(masterUserObject.get('inviteCode') == userCode){
                // console.log(masterUserCode + ' have master:' + userCode);
                if(res != undefined){
                    res.json({'errorId': -1, 'message': '他已经是您的徒弟了'});
                }
                return;
            }

            userObject.set('inviteCode', masterUserCode);
            if(isMarketingUser == true){
                //是否是推广大使的徒弟
                userObject.set('isMarketingApprentice', true);
            }

            //拜师不获得金钱
            //var isToday = true;
            //var myDate = new Date();
            //var month = (myDate.getMonth() + 1).toString();
            //var day = myDate.getDate().toString();
            //var yearStr = myDate.getFullYear().toString();
            //var todayStr = yearStr + '-' + month + '-' + day;
            //var todayMoneyDate = userObject.get('todayMoneyDate');
            //if(todayMoneyDate != todayStr){
            //    //非当天赚到的钱
            //    isToday = false;
            //}
            //
            ////增加用户的钱(总额,可用,今日)
            //userObject.increment('totalMoney', bindMasterFeedingMoney);
            //userObject.increment('currentMoney', bindMasterFeedingMoney);
            //if(isToday == true){
            //    userObject.increment('todayMoney', bindMasterFeedingMoney);
            //}else {
            //    //更新日期到最新
            //    userObject.set('todayMoneyDate', todayStr);
            //    userObject.set('todayMoney', bindMasterFeedingMoney);
            //}
            ////TODO RMB Logger

            //建立徒弟层级的关系网
            //建立徒孙层级的关系网(一级即可,暂时不需要,通过数据处理获得相关数据)
            var userRelation = new mentorRelationSQL();
            userRelation.set('masterUserCode', masterUserCode);
            userRelation.set('userCode', userCode);
            userRelation.set('masterUser', masterUserObject);
            userRelation.set('user', userObject);
            if(isMarketingUser == true){
                //是否是推广大使的关系子弟
                userRelation.set('isMarketingRelation', masterUserCode);
            }

            AV.Object.saveAll([userObject, userRelation]).then(function(){
                if(res != undefined){
                    res.json({'errorId': 0, 'message': 'bind master succeed'});
                }
            }, function(error){
                if(res != undefined){
                    res.json({'errorId': error.code, 'message': error.message});
                }
            });
        }

    }, function (error) {
        if(res != undefined){
            res.json({'errorId': error.code, 'message': error.message});
        }
    });
}


router.post('/bindMaster', function(req, res) {
    var userCode = req.body.userCode;
    var masterUserCode = req.body.masterCode;
    if(masterUserCode == undefined || masterUserCode.length < 5){
        return res.json({'errorId': -2, 'message': 'invite code not right'});
    }

    bindMaster(userCode, masterUserCode, res);
});

// 提现界面获取数据
router.post('/withdrawDeposit', function(req, res){
    var userCId = Base64.decode(req.body.userCId);

    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function(tempUserInfo){
        if (tempUserInfo.phoneNumber == '' || tempUserInfo.phoneNumber == undefined || tempUserInfo.aliAccount == '' || tempUserInfo.aliAccount == undefined){
            var query = new AV.Query(tempUserSQL);
            query.get(userCId).then(function(tempUserInfo){
                res.json({'temUserInfo': getUserMoneyInfo(tempUserInfo)})
            },function(error){
                res.json({'errorId': error.code, 'message': error.message});
            });

        }else {
            res.json({'temUserInfo': getUserMoneyInfo(tempUserInfo)})
        }

    },function(error){
        res.json({'errorId': error.code, 'message': error.message});
    })
});

//绑定手机号
router.post('/requestSms', function(req, res){
    if(req.body.phoneNumber == undefined || req.body.phoneNumber.length == 0){
        res.json({'errorId': -1, 'message': 'phone error'});
        return;
    }

    AV.Cloud.requestSmsCode({
        mobilePhoneNumber: req.body.phoneNumber,
        name: '小马-我的零花钱',
        op: '绑定手机号',
        ttl: 5
    }).then(function(){
        //发送成功
        res.json({'errorId': 0, 'message': 'send sms code succeed', 'mobilePhoneNumber':req.body.phoneNumber});
    }, function(error){
        //发送失败
        console.error('request sms error code ' + error.code + ' / message ' + error.message);
        res.json({'errorId': error.code, 'message': '发送验证码失败 : ' + error.message});
    });
});

// 绑定支付宝名字
router.post('/aliPayName', function(req, res){
    var userCId = Base64.decode(req.body.userCId);

    var userAilPayName = req.body.aliPayUserName;
    var tempUserQuery = new AV.Query(tempUserSQL);
    tempUserQuery.get(userCId).then(function(userInfo){

        userInfo.set('aliPayUserName', userAilPayName);
        userInfo.save().then(function(){
            res.json({'errorId':0, 'errorMsg':'绑定完成', 'aliPayUserName':userAilPayName})
        })
    },function(error){
        res.json({'errorId': error.code, 'message': error.message});
    })
});

function firstBinderPhone(userCId, phoneNumber, res){
    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function(data){
        data.set('phoneNumber', phoneNumber);
        data.save().then(function(tempUserInfo){
            res.json({'errorId': 0, 'message': 'bind succeed', 'userCId': Base64.encode(tempUserInfo.id), 'temUserInfo': getUserMoneyInfo(tempUserInfo)})
        }, function(error){
            res.json({'errorId': error.code, 'message': error.message});
        });
    },function(error){
        res.json({'errorId': error.code, 'message': error.message});
    })
}

router.post('/bindPhone', function(req, res){
    var userCId = Base64.decode(req.body.userCId);

    if(req.body.phoneNumber == undefined || req.body.phoneNumber.length == 0){
        res.json({'errorId': -1, 'message': 'phone error'});
        return;
    }

    AV.Cloud.verifySmsCode(req.body.smsCode, req.body.phoneNumber).then(function(){
        //验证成功

        var tempUserQuery = new AV.Query(tempUserSQL);
        tempUserQuery.equalTo('phoneNumber', req.body.phoneNumber);
        tempUserQuery.descending('updatedAt');
        tempUserQuery.first().then(function (tempUserObject) {
            if(tempUserObject == undefined){
                //binder phone
                firstBinderPhone(userCId, req.body.phoneNumber, res);
            }else {
                //老账号
                var phoneNumber = tempUserObject.get('phoneNumber');
                if(phoneNumber != undefined && phoneNumber.length > 0 && phoneNumber != req.body.phoneNumber){
                    res.json({'errorId': -3, 'message': '该账号已经绑定了手机号: '+ req.body.phoneNumber});
                    return;
                }

                tempUserObject.set('phoneNumber', req.body.phoneNumber);
                tempUserObject.save().then(function(savedObject){
                    res.json({'errorId': 0, 'userCId': Base64.encode(tempUserObject.id), 'temUserInfo': getUserMoneyInfo(savedObject), 'message': '绑定手机号成功'});
                }, function(error){
                    console.error('bind phone error code ' + error.code + ' / message ' + error.message);
                    res.json({'errorId': error.code, 'message': '验证失败 : ' + err.message});
                })
            }
        }, function(error){
            console.error('bind phone error code ' + error.code + ' / message ' + error.message);
            res.json({'errorId': error.code, 'message': error.message});
        });

    }, function(error){
        //验证失败
        console.error('bind phone error code ' + error.code + ' / message ' + error.message);
        res.json({'errorId': error.code, 'message': '验证失败 : ' + error.message});
    });
});

//手机号登陆

// banner
router.get('/banner', function(req, res){
    var query = new AV.Query('bannerObject');
    query.equalTo('close', true);
    query.equalTo('bannerType', 'ponyHome');
    query.find().then(function(bannerObject){
        var bannerList = Array();
        for (var i = 0; i < bannerObject.length; i++){
            var bannerObjects = Object();
            bannerObjects.bannerUrl = bannerObject[i].get('bannerURL');
            bannerObjects.clickBanner = bannerObject[i].get('clickBanner');
            bannerList.push(bannerObjects)
        }
        res.json({'bannerUrl': bannerList, 'errorId': 0, 'errorMsg':''})
    },function(error) {
        res.json({'errorMsg': error.message, 'errorId': error.code});
    })
});

// query audit count
router.post('/userAuditCount', function(req, res){
    var userCId = Base64.decode(req.body.gUserCId);
    var temUserObject = new tempUserSQL();
    temUserObject.id = userCId;

    var mackTaskObjectSql = AV.Object.extend('mackTaskInfo');
    var query = new AV.Query(mackTaskObjectSql);
    query.equalTo('tempUserObject', temUserObject);
    query.containedIn('taskStatus', ['uploaded', 'reUploaded']);
    query.count().then(function(count){

        res.json({'errorId':0, 'errorMsg':'', 'userAuditCount':count})
    },function(error){
        res.json({'errorMsg': error.message, 'errorId': error.code});
    })

});

// 手机充值接口
router.post('/phonePay', function(req, res){
    var userCId = Base64.decode(req.body.gUserCId);
    var phoneNumber = req.body.phoneNumber;
    var topUpAmount = req.body.topUpAmount;

    var query = new AV.Query(tempUserSQL);
    query.get(userCId).then(function(tempUserObject){
        var availableMoney = tempUserObject.get('currentMoney');
        if (availableMoney < topUpAmount){
            res.json({'errorId':-1 ,'errorMsg':'余额不足'})
        }
        else {
            telePhonePay.verifyWhetherCanTopUp(topUpAmount, phoneNumber, function(resultsObject, isCanTopUp){
                if (isCanTopUp == true){
                    telePhonePay.phoneChargeStraight(topUpAmount, phoneNumber, function(topUpResultsObject, resultObject, topUpResults){
                        if (topUpResults == true){
                            tempUserObject.increment('currentMoney', -parseInt(topUpAmount));
                            tempUserObject.set('phoneTopUpIsSuccess', false);
                            var messageObject = new toUpDepositsSql();
                            messageObject.set('tempUserObject', tempUserObject);
                            messageObject.set('applyAmount', parseInt(topUpAmount));
                            messageObject.set('type', '手机充值');
                            messageObject.set('mobilePhone', phoneNumber);
                            messageObject.set('ordercash', resultObject.ordercash); // 进货价格,可以算出中间差价
                            messageObject.set('cardname', resultObject.cardname); // 充值名称
                            messageObject.set('sporderId', resultObject.sporder_id); // 聚合订单号
                            messageObject.set('uorderid', resultObject.uorderid);   // 商户自定的订单号
                            messageObject.set('status', resultObject.game_state); // *充值状态:0充值中 1成功 9撤销，刚提交都返回0*
                            messageObject.set('differenceRMB', topUpAmount- resultObject.ordercash); // 差价

                            messageObject.save().then(function(successObject){

                                res.json({'errorId':0 ,'errorMsg':topUpResultsObject.reason, 'status':resultObject.game_state})
                            },function(error){
                                res.json({'errorMsg': error.message, 'errorId': error.code});
                            })

                        }
                        else {
                            res.json({'errorId':-1 ,'errorMsg':topUpResultsObject.reason})
                        }
                    });
                }
                else {
                    console.log('failure:' + resultsObject.reason);
                    res.json({'errorId':-1 ,'errorMsg':resultsObject.reason})
                }

            })
        }
    })
});


module.exports = router;
