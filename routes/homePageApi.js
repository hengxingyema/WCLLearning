/**
 * Created by cailong on 16/8/29.
 */

'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');
var messager = require('../utils/messager');

// 声明
var User = AV.Object.extend('_User');
var releaseTaskObjectSql = AV.Object.extend('releaseTaskObject'); // 发布任务库
var receiveTaskObjectSql = AV.Object.extend('receiveTaskObject'); // 领取任务库
var checkInsObjectSql = AV.Object.extend('checkInsObject');
var inviteUserObjectSql = AV.Object.extend('inviteUserObject');  // 邀请好友奖励库
var mackTaskInfo = AV.Object.extend('mackTaskInfo');
var everydayTaskObjectSql = AV.Object.extend('everydayTaskObject'); // 每日任务库

var newUserObject = AV.Object.extend('newUserObject'); // 新用户领取YB记录的库
var goodsObject = AV.Object.extend('goodsObject'); // 是否购买过XX的库

var maxCheckIn = 10;
var inviteRegisterYCoin = 20;
var inviteTaskYCoin = 100;

router.get('/', function(req, res) {
    res.render('homePageSx');
});

// banner
router.get('/banner', function(req, res){
    var query = new AV.Query('bannerObject');
    query.equalTo('close', true);
    query.equalTo('bannerType', 'homePage');
    query.find().then(function(bannerObject){
        var bannerList = Array();
        for (var i = 0; i < bannerObject.length; i++){
            var bannerObjects = Object();
            bannerObjects.bannerUrl = bannerObject[i].get('bannerURL');
            bannerObjects.clickBanner = bannerObject[i].get('clickBanner');
            bannerList.push(bannerObjects)
        }
        res.json({'bannerUrl': bannerList, 'errorId': 0, 'errorMsg':''})
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});


// 签到

function getExtraCheckYCoin(checkInsObj)
{
    //最多每次得额外10个Y币
    var latestDays = checkInsObj.get('latestDays');
    if(latestDays == undefined){
        latestDays = 0;
    }

    latestDays += 1;

    var extraYCoin = parseInt(latestDays/maxCheckIn);
    return (extraYCoin > 4 ? 4 : extraYCoin) + 1;
}

router.get('/ischeckins', function(req, res){
    var userId = util.useridInReq(req);

    var userObject = new User();
    userObject.id = userId;

    // 今日日期
    var myDate = new Date();
    var myDateStr = myDate.getFullYear() + '-' + (parseInt(myDate.getMonth())+1) + '-' + myDate.getDate();

    // 昨天日期
    var nowTimestamp = new Date().getTime();
    var yesterdayTimestamp = nowTimestamp - 1000*60*60*24;
    var yesterdayDate = new Date(yesterdayTimestamp);
    var yesterdayDateStr = yesterdayDate.getFullYear() + '-' + (parseInt(yesterdayDate.getMonth())+1) + '-' + yesterdayDate.getDate();

    var query = new AV.Query(checkInsObjectSql);
    query.equalTo('checkInsUserObject', userObject);
    query.descending('createdAt');
    query.first().then(function(checkInsOb){
        if (checkInsOb == undefined || checkInsOb.length <= 0){
            res.json({'errorId':0, 'isCheckIns': 0, 'todayYB': 1, 'latestDays':0, 'continueCheck': 2})
        }else {
            var todayGiftYb = 0;
            var tomorrowGiftYb = 0;

            var checkInYCoin = checkInsOb.get('checkInsCount');
            var latestDays = checkInsOb.get('latestDays');
            if(latestDays == undefined){
                latestDays = 0;
            }

            var checkTime = checkInsOb.get('checkInsTime');
            if (checkTime == myDateStr){
                //已经签到
                if(checkInYCoin == maxCheckIn){
                    tomorrowGiftYb = getExtraCheckYCoin(checkInsOb);
                }else {
                    tomorrowGiftYb = checkInYCoin + 1;
                }
                res.json({'errorId':0, 'isCheckIns': 1, 'todayYB': checkInYCoin, 'latestDays':latestDays, 'continueCheck': tomorrowGiftYb})
            }
            else if (checkTime == yesterdayDateStr){
                //连续签到
                if (checkInYCoin < maxCheckIn){
                    todayGiftYb = checkInYCoin + 1;
                }else {
                    todayGiftYb = getExtraCheckYCoin(checkInsOb);
                }

                if(todayGiftYb == maxCheckIn){
                    tomorrowGiftYb = getExtraCheckYCoin(checkInsOb);
                }else {
                    tomorrowGiftYb = todayGiftYb + 1;
                }

                res.json({'errorId':0, 'isCheckIns': 0, 'todayYB': todayGiftYb, 'latestDays':latestDays, 'continueCheck': tomorrowGiftYb})
            }
            else {
                res.json({'errorId':0, 'isCheckIns': 0, 'todayYB': 1, 'latestDays':0,  'continueCheck': 2})
            }
        }
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })

});

// 点击签到接口
router.post('/checkIns', function(req, res){
    var userId = util.useridInReq(req);

    // 今日日期
    var myDate = new Date();
    var myDateStr = myDate.getFullYear() + '-' + (parseInt(myDate.getMonth())+1) + '-' + myDate.getDate();

    // 昨天日期
    var nowTimestamp = new Date().getTime();
    var yesterdayTimestamp = nowTimestamp - 1000*60*60*24;
    var yesterdayDate = new Date(yesterdayTimestamp);
    var yesterdayDateStr = yesterdayDate.getFullYear() + '-' + (parseInt(yesterdayDate.getMonth())+1) + '-' + yesterdayDate.getDate();

    var userObject = new User();
    userObject.id = userId;

    var query = new AV.Query(checkInsObjectSql);
    query.equalTo('checkInsUserObject', userObject);
    //query.containedIn('checkInsTime', [myDateStr, yesterdayDateStr]);
    query.include('checkInsUserObject');
    query.descending('createdAt');
    query.first().then(function(checkInsObj){
        if (checkInsObj == undefined || checkInsObj.length == 0){
            // 一次都没签到,断了签到
            var checkInsObject = new checkInsObjectSql();
            checkInsObject.set('checkInsUserObject', userObject);
            checkInsObject.set('checkInsCount', 1);
            checkInsObject.set('latestDays', 1);
            checkInsObject.set('checkInsTime', myDateStr);

            userObject.increment('totalMoney', 1);
            userObject.increment('feedingMoney', 1);

            AV.Object.saveAll([checkInsObject, userObject]).then(function(){

                messager.bonusMsg(myDateStr + '日签到', 1, userId);
                res.json({'errorId': 0, 'errorMsg': ''});
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            })
        }
        else if (checkInsObj.get('checkInsTime') == myDateStr){
            res.json({'errorId': -1, 'errorMsg': '您今天已经签到过喽,明天再来吧'});
        }
        else if(checkInsObj.get('checkInsTime') == yesterdayDateStr){
            // 属于连续签到
            var lastCheckInYCoin = checkInsObj.get('checkInsCount');
            if (lastCheckInYCoin < maxCheckIn){
                lastCheckInYCoin = lastCheckInYCoin + 1;
            }else {
                lastCheckInYCoin = getExtraCheckYCoin(checkInsObj);
            }

            checkInsObj.set('checkInsCount', lastCheckInYCoin);

            checkInsObj.set('checkInsTime', myDateStr);
            checkInsObj.increment('latestDays', 1);

            userObject.increment('totalMoney', lastCheckInYCoin);
            userObject.increment('feedingMoney', lastCheckInYCoin);
            AV.Object.saveAll([checkInsObj, userObject]).then(function(){

                messager.bonusMsg(myDateStr + '日连续签到', lastCheckInYCoin, userId);
                res.json({'errorId': 0, 'errorMsg': '签到成功'})
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            })
        }
        else {
            checkInsObj.set('checkInsUserObject', userObject);
            checkInsObj.set('checkInsCount', 1);
            checkInsObj.set('latestDays', 1);
            checkInsObj.set('checkInsTime', myDateStr);

            userObject.increment('totalMoney', 1);
            userObject.increment('feedingMoney', 1);

            AV.Object.saveAll([checkInsObj, userObject]).then(function(){

                messager.bonusMsg(myDateStr + '日签到', 1, userId);
                res.json({'errorId': 0, 'errorMsg': ''});
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            })
        }

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});


// 每日任务
router.get('/dayTask', function(req, res){
    var userId = util.useridInReq(req);
    var userObject = new User();
    userObject.id = userId;

    // 今日日期
    var myDate = new Date();
    var myDateStr = myDate.getFullYear() + '-' + (parseInt(myDate.getMonth())+1) + '-' + myDate.getDate();

    var query = new AV.Query(everydayTaskObjectSql);
    query.equalTo('userObject', userObject);
    query.equalTo('taskDateStr', myDateStr);
    query.include('userObject');
    query.descending('createdAt');
    query.first().then(function(dayTaskObject){
        if (dayTaskObject == undefined){
            // 无今日任务
            res.json({'errorId': 0, 'errorMsg': 'none'});
        }
        else {
            // 有了今日任务
            res.json({
                'releaseTaskY':dayTaskObject.get('releaseTaskY'),
                'doTaskY':dayTaskObject.get('doTaskY'),
                'checkTaskY':dayTaskObject.get('checkTaskY'),
                'errorId': 0, 'errorMsg': ''});
        }

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});

router.post('/dayTask', function(req, res){
    var userId = util.useridInReq(req);
    var userObject = new User();
    userObject.id = userId;

    var actionId = req.body.actionId;

    // 今日日期
    var myDate = new Date();
    var myDateStr = myDate.getFullYear() + '-' + (parseInt(myDate.getMonth())+1) + '-' + myDate.getDate();

    var query = new AV.Query(everydayTaskObjectSql);
    query.equalTo('userObject', userObject);
    query.equalTo('taskDateStr', myDateStr);
    query.include('userObject');
    query.descending('createdAt');
    query.first().then(function(dayTaskObject){
        if (dayTaskObject == undefined){
            // 无今日任务
            res.json({'errorId': -1, 'errorMsg': '未满足条件'});
        }
        else {
            // 有了今日任务
            var bonusYCoin = dayTaskObject.get(actionId);
            userObject.increment('totalMoney', bonusYCoin);
            userObject.increment('feedingMoney', bonusYCoin);

            dayTaskObject.set(actionId, 0);
            var totalBonusYCoinKey = actionId + 'All';
            dayTaskObject.increment(totalBonusYCoinKey, bonusYCoin);

            AV.Object.saveAll([userObject, dayTaskObject]).then(function(){

                //Y币流水
                if(actionId == 'releaseTaskY'){
                    messager.bonusMsg('每日任务(' + myDateStr + '),10点前发布任务', bonusYCoin, userId);
                }else if(actionId == 'doTaskY'){
                    messager.bonusMsg('每日任务(' + myDateStr + '),4:30前完成任务', bonusYCoin, userId);
                }else if(actionId == 'checkTaskY'){
                    messager.bonusMsg('每日任务(' + myDateStr + '),5:30前审核任务', bonusYCoin, userId);
                }

                //succeed
                res.json({'errorId': 0, 'releaseTaskY':dayTaskObject.get('releaseTaskY'),
                    'doTaskY':dayTaskObject.get('doTaskY'),
                    'checkTaskY':dayTaskObject.get('checkTaskY')});
            }, function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
        }

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});


// 我发布的任务
router.get('/myReleaseTask', function(req, res){
    var userId = util.useridInReq(req);

    var userObject = new User();
    userObject.id = userId;

    var query = new AV.Query(releaseTaskObjectSql);
    query.equalTo('userObject', userObject);
    query.equalTo('close', false);
    query.include('appObject');
    query.descending('createdAt');
    query.descending('remainCount');
    query.limit(5);
    query.find().then(function(relObjects){
        var retApps = Array();
        for (var i = 0; i < relObjects.length; i++){
            // 任务详情
            var releaseObject = Object();
            releaseObject.taskType = relObjects[i].get('taskType');
            releaseObject.excCount = relObjects[i].get('excCount');
            releaseObject.remainCount = relObjects[i].get('remainCount');

            //succeedProgressStyle


            var progressStr =  parseFloat(releaseObject.excCount - releaseObject.remainCount) / parseFloat(releaseObject.excCount) * 100 + '%';
            releaseObject.receProgressStyle = {"width":progressStr};



            releaseObject.taskObjectId = relObjects[i].id;

            // app详情
            var userRelApp = relObjects[i].get('appObject');
            releaseObject.artworkUrl100 = userRelApp.get('artworkUrl100');
            releaseObject.trackName = userRelApp.get('trackName');
            releaseObject.appleId = userRelApp.get('appleId');

            if(i != relObjects.length - 1){
                releaseObject.bottom = {"border-bottom":"1px solid #cccccc"}
            }

            retApps.push(releaseObject);
        }
        res.json({'myReleaseTaskInfo':retApps})
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});

// 获取邀请好友奖励
router.get('/noviceTask', function(req, res){
    var userId = util.useridInReq(req);

    var priorityQuery = new AV.Query(User);
    priorityQuery.get(userId).then(function(userObject){
        var noviceObject = Object();

        //首次充值
        noviceObject.hasFirstRecharge = 1;
        if(userObject.get('firstRecharge') != undefined && userObject.get('firstRecharge') > 0){
            noviceObject.hasFirstRecharge = 0;
        }

        //尊贵客人
        noviceObject.luxuryUserStep = userObject.get('luxuryUserStep');
        noviceObject.luxuryYCoin = 0;
        var luxuryDay = noviceObject.luxuryUserStep;
        if(luxuryDay == 1){
            noviceObject.luxuryYCoin = 100;
        }else if(luxuryDay < 6){
            noviceObject.luxuryYCoin = luxuryDay * 10 + 30;
        }else if(luxuryDay < 11){
            noviceObject.luxuryYCoin = luxuryDay * 10;
        }else if(luxuryDay < 16){
            noviceObject.luxuryYCoin = (luxuryDay - 5) * 10;
        }

        var registerBonus = userObject.get('registerBonus');

        var inviteUserCount = userObject.get('inviteCount'); // 邀请的人数
        var inviteUserSucceedCount = userObject.get('inviteSucceedCount'); // 邀请成功做任务的人

        var query = new AV.Query(inviteUserObjectSql);
        query.equalTo('inviteUserObject', userObject);
        query.include('inviteUserObject');
        query.first().then(function(userInfoObject){

            if (userInfoObject == undefined || userInfoObject.length == 0){
                //新手任务
                if (registerBonus == 'register_upload_task'){
                    noviceObject.noviceReward = 20;
                    noviceObject.noviceTaskAcceptReward = 0;
                }
                else if (registerBonus == 'register_accept_task'){
                    noviceObject.noviceReward = 20;
                    noviceObject.noviceTaskAcceptReward = 30;
                }
                else {
                    noviceObject.noviceReward = 0;
                    noviceObject.noviceTaskAcceptReward = 0;
                }

                //邀请
                noviceObject.canReceive = inviteUserCount * inviteRegisterYCoin;
                noviceObject.successCanReceive = inviteUserSucceedCount * inviteTaskYCoin;
                res.json({'noviceTaskObject': noviceObject})
            }else {
                var inviteUserReward = userInfoObject.get('inviteUserReward'); // 邀请用户奖励
                var guideUserRewardYB = userInfoObject.get('guideUserRewardYB'); // 引导新人奖励
                var uploadHaveReceive = userInfoObject.get('noviceTaskType');

                // 新手任务
                if (registerBonus == 'register_upload_task'){
                    noviceObject.noviceTaskAcceptReward = 0;
                    if(uploadHaveReceive == 'uploadHaveReceive'){
                        noviceObject.noviceReward = -1; // 新手任务被审核通过
                    }else {
                        noviceObject.noviceReward = 20;  // 新手领取并上传了任务
                    }
                }
                else if (registerBonus == 'register_accept_task'){
                    if(uploadHaveReceive == undefined){
                        //一个都没领取,先领第一步的奖励
                        noviceObject.noviceReward = 20;
                        noviceObject.noviceTaskAcceptReward = 0;
                    }
                    else if(uploadHaveReceive == 'uploadHaveReceive'){
                        //领取了第一次任务奖励
                        noviceObject.noviceReward = -1;
                        noviceObject.noviceTaskAcceptReward = 30;
                    }else if(uploadHaveReceive == 'finishNoviceTask'){
                        //全部都领了
                        noviceObject.noviceReward = -1;
                        noviceObject.noviceTaskAcceptReward = -1;
                    }
                }
                else if (registerBonus == 'register_new'){
                    noviceObject.noviceReward = 0; // 0 未满足条件
                    noviceObject.noviceTaskAcceptReward = 0;
                }
                else {
                    noviceObject.noviceReward = -1; // -1 已经领取
                    noviceObject.noviceTaskAcceptReward = -1;
                }

                // 邀请注册奖励
                var inviteYb = inviteUserCount * inviteRegisterYCoin;
                if (inviteUserCount == undefined || inviteUserCount == 0){
                    noviceObject.canReceive = -1;
                }else if(inviteYb == inviteUserReward){
                    noviceObject.canReceive = 0;
                }
                else {
                    noviceObject.canReceive = inviteYb - inviteUserReward;
                }

                // 引导新手奖励
                var inviteUserYb = inviteUserSucceedCount * inviteTaskYCoin;
                if (inviteUserSucceedCount == undefined || inviteUserSucceedCount == 0){
                    noviceObject.successCanReceive = -1;
                }else if(inviteUserYb == guideUserRewardYB){
                    noviceObject.successCanReceive = 0;
                }
                else {
                    noviceObject.successCanReceive = inviteUserYb - guideUserRewardYB;
                }
                res.json({'noviceTaskObject': noviceObject});
            }

        },function(error){
            res.json({'errorMsg':error.message, 'errorId': error.code});
        })

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });

});

// 领取奖励post
router.post('/userReceiveAward', function(req, res){
    var userId = util.useridInReq(req);
    var actionId = req.body.actionId;

    var userQuery = new AV.Query(User);
    userQuery.get(userId).then(function(userObject){
        var inviteUserCount = userObject.get('inviteCount');
        var inviteUserSucceedCount = userObject.get('inviteSucceedCount');
        var query = new AV.Query(inviteUserObjectSql);
        query.equalTo('inviteUserObject', userObject);
        query.include('inviteUserObject');
        query.first().then(function(receiveObject){
            if (receiveObject == undefined || receiveObject.length == 0){
                var inviteUserObject = new inviteUserObjectSql();
                var increaseYB = 0;
                if (actionId == 'uploadHaveReceive'){
                    inviteUserObject.set('noviceTaskType', 'uploadHaveReceive');
                    inviteUserObject.set('totalReceiveMoney', 20);
                    inviteUserObject.set('inviteUserObject', userObject);
                    increaseYB += 20;
                }
                else if (actionId == 'finishNoviceTask'){
                    inviteUserObject.set('noviceTaskType', 'finishNoviceTask');
                    inviteUserObject.set('totalReceiveMoney', 30);
                    inviteUserObject.set('inviteUserObject', userObject);
                    increaseYB += 30;
                }
                else if (actionId == 'inviteUserReward'){
                    //首次
                    inviteUserObject.set('inviteUserReward', inviteUserCount * inviteRegisterYCoin);
                    inviteUserObject.set('totalReceiveMoney', inviteUserCount * inviteRegisterYCoin);
                    inviteUserObject.set('inviteUserObject', userObject);
                    increaseYB += inviteUserCount * inviteRegisterYCoin;
                }
                else {
                    //首次
                    inviteUserObject.set('guideUserRewardYB', inviteUserSucceedCount * inviteTaskYCoin);
                    inviteUserObject.set('totalReceiveMoney', inviteUserSucceedCount * inviteTaskYCoin);
                    inviteUserObject.set('inviteUserObject', userObject);
                    increaseYB += inviteUserSucceedCount * inviteTaskYCoin;
                }

                userObject.increment('totalMoney', increaseYB);
                userObject.increment('feedingMoney', increaseYB);
                AV.Object.saveAll([inviteUserObject, userObject]).then(function(){

                    if (actionId == 'uploadHaveReceive'){
                        messager.bonusMsg('完成新手任务(第一步)', 20, userId);
                    }
                    else if (actionId == 'finishNoviceTask'){
                        messager.bonusMsg('完成新手任务(第二步)', 30, userId);
                    }
                    else if (actionId == 'inviteUserReward'){
                        //首次
                        messager.bonusMsg('首次-邀请' + inviteUserCount +'名用户注册', increaseYB, userId);
                    }
                    else {
                        //首次
                        messager.bonusMsg('首次-引导' + inviteUserSucceedCount +'名用户完成新手任务', increaseYB, userId);
                    }

                    res.json({'errorId': 0, 'errorMsg': '已经领完'});
                },function(error){
                    res.json({'errorMsg':error.message, 'errorId': error.code});
                })

            }else {
                var inviterReward = receiveObject.get('inviteUserReward');
                var guideRewardYB = receiveObject.get('guideUserRewardYB');
                var increaseUserYB = 0;
                if (actionId == 'uploadHaveReceive'){
                    receiveObject.set('noviceTaskType', 'uploadHaveReceive');
                    increaseUserYB += 20;
                }
                else if (actionId == 'finishNoviceTask'){
                    receiveObject.set('noviceTaskType', 'finishNoviceTask');
                    increaseUserYB += 30;
                }
                else if (actionId == 'inviteUserReward'){
                    receiveObject.increment('inviteUserReward', inviteUserCount * inviteRegisterYCoin - inviterReward);
                    receiveObject.increment('totalReceiveMoney', inviteUserCount * inviteRegisterYCoin - inviterReward);
                    increaseUserYB += inviteUserCount * inviteRegisterYCoin - inviterReward;
                }
                else {
                    receiveObject.increment('guideUserRewardYB', inviteUserSucceedCount * inviteTaskYCoin - guideRewardYB);
                    receiveObject.increment('totalReceiveMoney', inviteUserSucceedCount * inviteTaskYCoin - guideRewardYB);
                    increaseUserYB += inviteUserSucceedCount * inviteTaskYCoin - guideRewardYB;
                }

                userObject.increment('totalMoney', increaseUserYB);
                userObject.increment('feedingMoney', increaseUserYB);

                AV.Object.saveAll([receiveObject, userObject]).then(function(){

                    if (actionId == 'uploadHaveReceive'){
                        messager.bonusMsg('完成新手任务(第一步)', 20, userId);
                    }
                    else if (actionId == 'finishNoviceTask'){
                        messager.bonusMsg('完成新手任务(第二步)', 30, userId);
                    }
                    else if (actionId == 'inviteUserReward'){
                        messager.bonusMsg('您又邀请了' + increaseUserYB/inviteRegisterYCoin +'名用户注册', increaseUserYB, userId);
                    }
                    else {
                        messager.bonusMsg('您又引导了' + increaseUserYB/inviteTaskYCoin +'名用户完成新手任务', increaseUserYB, userId);
                    }

                    res.json({'errorId': 0, 'errorMsg': '已经领完'});
                },function(error){
                    res.json({'errorMsg':error.message, 'errorId': error.code});
                })
            }

        },function(error){
            res.json({'errorMsg':error.message, 'errorId': error.code});
        });
    })
});

// 新人礼包

function queryUserMackTaskCount(doTaskUserObject, userCanGetYbObject, actionId, res){
    // 查询用户做了多少任务,可以得领取多少YB
    var userMackTaskQuery = new AV.Query(mackTaskInfo);
    userMackTaskQuery.equalTo('doTaskUser', doTaskUserObject);
    userMackTaskQuery.containedIn('taskStatus', ['accepted', 'systemAccepted']);
    userMackTaskQuery.count().then(function(userMackTaskCount){

        if (actionId == 'canGet50YB'){
            if (userMackTaskCount >= 5){
                userCanGetYbObject.canGet50YB = true;
            }
            else {
                res.json({'errorId':-1, 'errorMsg':'条件不满足'});
                return;
            }
        }

        if (actionId == 'canGet100YB'){
            if (userMackTaskCount >= 20){
                userCanGetYbObject.canGet100YB = true;
            }
            else {
                res.json({'errorId':-1, 'errorMsg':'条件不满足'});
                return;
            }
        }


        queryUserA(doTaskUserObject, actionId, res)
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
}

router.get('/newUser', function(req, res){
    var userId = util.useridInReq(req);

    var userObject = new User();
    userObject.id = userId;

    // 注：固定从16.10.28开始算, 月份需要减1,因为从0开始算的
    var targetTimeDate = new Date(2016, 9, 28);
    var query = new AV.Query(User);
    query.include('newUserInfoObject');
    query.greaterThanOrEqualTo('createdAt', targetTimeDate);
    query.get(userId).then(function(userInfo){
        var userCanGetYbObject = Object();

        // 创建日期
        var userCreate = userInfo.createdAt;

        var userReceiveYB = userInfo.get('newUserInfoObject');
        if (userReceiveYB == undefined){
            userCanGetYbObject.newUserOneGetYB = true;
            userCanGetYbObject.newUserTwoGetYB = false;
            userCanGetYbObject.newUserThreeGetYB = false;
            userCanGetYbObject.canGet50YB = true;
            userCanGetYbObject.canGet100YB = true;
        }
        else {
            // 当天日期
            var nowDate = new Date();
            var userEntryDate = nowDate.getFullYear() + '-' + (nowDate.getMonth() + 1) + '-' + nowDate.getDate();

            // 第二天
            var userCreateTwoDate = userCreate.getFullYear() + '-' + (userCreate.getMonth() + 1) + '-' + (userCreate.getDate() + 1);

            // 第三天
            var userCreateThreeDate = userCreate.getFullYear() + '-' + (userCreate.getMonth() + 1) + '-' + (userCreate.getDate() + 2);

            var type = userReceiveYB.get('receiveType');
            var taskCountType = userReceiveYB.get('taskCountType');
            if (userCreateTwoDate == userEntryDate && type == 'newUserOneGetYB'){
                userCanGetYbObject.newUserOneGetYB = 'lala';
                userCanGetYbObject.newUserTwoGetYB = true;
                userCanGetYbObject.newUserThreeGetYB = false;
                userCanGetYbObject.canGet50YB = true;
                userCanGetYbObject.canGet100YB = true;
            }
            else if (userCreateThreeDate == userEntryDate && type == 'newUserTwoGetYB'){
                userCanGetYbObject.newUserOneGetYB = 'lala';
                userCanGetYbObject.newUserTwoGetYB = 'lala';
                userCanGetYbObject.newUserThreeGetYB = true;
                userCanGetYbObject.canGet50YB = true;
                userCanGetYbObject.canGet100YB = true;
            }
            else if (taskCountType == 'canGet50YB' && type == 'newUserThreeGetYB'){
                userCanGetYbObject.newUserOneGetYB = 'lala';
                userCanGetYbObject.newUserTwoGetYB = 'lala';
                userCanGetYbObject.newUserThreeGetYB = 'lala';
                userCanGetYbObject.canGet50YB = 'lala';
                userCanGetYbObject.canGet100YB = true;
            }
            else if (taskCountType == 'canGet100YB' && type == 'newUserThreeGetYB'){
                userCanGetYbObject.newUserOneGetYB = 'lala';
                userCanGetYbObject.newUserTwoGetYB = 'lala';
                userCanGetYbObject.newUserThreeGetYB = 'lala';
                userCanGetYbObject.canGet50YB = 'lala';
                userCanGetYbObject.canGet100YB = 'lala';
                userCanGetYbObject = '';
            }
            else if (taskCountType == 'canGet50YB' && type == 'newUserOneGetYB'){
                userCanGetYbObject.newUserOneGetYB = 'lala';
                userCanGetYbObject.newUserTwoGetYB = false;
                userCanGetYbObject.newUserThreeGetYB = false;
                userCanGetYbObject.canGet50YB = 'lala';
                userCanGetYbObject.canGet100YB = true;
            }
            else if (taskCountType == 'canGet100YB' && type == 'newUserOneGetYB'){
                userCanGetYbObject.newUserOneGetYB = 'lala';
                userCanGetYbObject.newUserTwoGetYB = false;
                userCanGetYbObject.newUserThreeGetYB = false;
                userCanGetYbObject.canGet50YB = 'lala';
                userCanGetYbObject.canGet100YB = 'lala';
            }
            else if (taskCountType == 'canGet50YB' && type == undefined){
                userCanGetYbObject.newUserOneGetYB = true;
                userCanGetYbObject.newUserTwoGetYB = false;
                userCanGetYbObject.newUserThreeGetYB = false;
                userCanGetYbObject.canGet50YB = 'lala';
                userCanGetYbObject.canGet100YB = true;
            }
            else if (taskCountType == 'canGet100YB' && type == undefined){
                userCanGetYbObject.newUserOneGetYB = true;
                userCanGetYbObject.newUserTwoGetYB = false;
                userCanGetYbObject.newUserThreeGetYB = false;
                userCanGetYbObject.canGet50YB = 'lala';
                userCanGetYbObject.canGet100YB = 'lala';
            }

            else if (type == 'newUserOneGetYB' && (taskCountType == undefined || taskCountType == '')){
                userCanGetYbObject.newUserOneGetYB = 'lala';
                userCanGetYbObject.newUserTwoGetYB = false;
                userCanGetYbObject.newUserThreeGetYB = false;
                userCanGetYbObject.canGet50YB = true;
                userCanGetYbObject.canGet100YB = true;
            }
            else if (type == 'newUserTwoGetYB' && (taskCountType == undefined || taskCountType == '')){
                userCanGetYbObject.newUserOneGetYB = 'lala';
                userCanGetYbObject.newUserTwoGetYB = 'lala';
                userCanGetYbObject.newUserThreeGetYB = false;
                userCanGetYbObject.canGet50YB = true;
                userCanGetYbObject.canGet100YB = true;
            }
            else if (type == 'newUserThreeGetYB' && (taskCountType == undefined || taskCountType == '')){
                userCanGetYbObject.newUserOneGetYB = 'lala';
                userCanGetYbObject.newUserTwoGetYB = 'lala';
                userCanGetYbObject.newUserThreeGetYB = 'lala';
                userCanGetYbObject.canGet50YB = true;
                userCanGetYbObject.canGet100YB = true;
            }

        }

        res.json({'userCanGetYbObject':userCanGetYbObject, 'errorId':0, 'errorMsg':''});

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code, 'userCanGetYbObject':''});
    })

});

function queryUserA (newUserInfo, actionId, res){
    var query = new AV.Query(newUserObject);
    query.equalTo('userObject', newUserInfo);
    query.first().then(function(newUserReceiveYBInfo){
        if (newUserReceiveYBInfo == undefined){
            var newUserInfoObject = new newUserObject();
            if (actionId == 'newUserOneGetYB'){
                newUserInfoObject.set('userObject', newUserInfo);
                newUserInfoObject.set('receiveYB', 105);
                newUserInfoObject.set('receiveType', 'newUserOneGetYB');

                newUserInfo.increment('totalMoney', 105);
                newUserInfo.set('newUserInfoObject', newUserInfoObject);
            }
            else if (actionId == 'canGet50YB'){
                newUserInfoObject.set('userObject', newUserInfo);
                newUserInfoObject.set('receiveYB', 50);
                newUserInfoObject.set('taskCountType', 'canGet50YB');

                newUserInfo.increment('totalMoney', 50);
                newUserInfo.set('newUserInfoObject', newUserInfoObject);
            }
            else if (actionId == 'canGet100YB'){
                newUserInfoObject.set('userObject', newUserInfo);
                newUserInfoObject.set('receiveYB', 100);
                newUserInfoObject.set('taskCountType', 'canGet100YB');

                newUserInfo.increment('totalMoney', 100);
                newUserInfo.set('newUserInfoObject', newUserInfoObject);
            }

            AV.Object.saveAll([newUserInfoObject, newUserInfo]).then(function(){
                if (actionId == 'newUserOneGetYB'){
                    messager.bonusMsg('完成新人注册奖励礼包(第一步)', 105, newUserInfo.id);
                }
                else if (actionId == 'canGet50YB'){
                    messager.bonusMsg('完成新人完成5条任务奖励礼包(第四步)', 50, newUserInfo.id);
                }
                else if (actionId == 'canGet100YB'){
                    messager.bonusMsg('完成新人完成20条任务奖励礼包(第五步)', 100, newUserInfo.id);
                }

                res.json({'errorId':0, 'errorMsg':''})
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });

        }
        else {
            if (actionId == 'newUserOneGetYB'){
                newUserReceiveYBInfo.increment('receiveYB', 105);
                newUserReceiveYBInfo.set('receiveType', 'newUserOneGetYB');

                newUserInfo.increment('totalMoney', 105);
            }
            else if (actionId == 'newUserTwoGetYB'){
                newUserReceiveYBInfo.increment('receiveYB', 105);
                newUserReceiveYBInfo.set('receiveType', 'newUserTwoGetYB');

                newUserInfo.increment('totalMoney', 105);
            }
            else if (actionId == 'newUserThreeGetYB'){
                newUserReceiveYBInfo.increment('receiveYB', 105);
                newUserReceiveYBInfo.set('receiveType', 'newUserThreeGetYB');

                newUserInfo.increment('totalMoney', 105);
            }
            else if (actionId == 'canGet50YB'){
                newUserReceiveYBInfo.increment('receiveYB', 50);
                newUserReceiveYBInfo.set('taskCountType', 'canGet50YB');

                newUserInfo.increment('totalMoney', 50);
            }
            else if (actionId == 'canGet100YB'){
                newUserReceiveYBInfo.increment('receiveYB', 100);
                newUserReceiveYBInfo.set('taskCountType', 'canGet100YB');

                newUserInfo.increment('totalMoney', 100);
            }

            AV.Object.saveAll([newUserReceiveYBInfo, newUserInfo]).then(function(){
                if (actionId == 'newUserOneGetYB'){
                    messager.bonusMsg('完成新人注册奖励礼包(第一步)', 105, newUserInfo.id);
                }
                else if (actionId == 'newUserTwoGetYB'){
                    messager.bonusMsg('完成新人连续登录2天奖励礼包(第二步)', 105, newUserInfo.id);
                }
                else if (actionId == 'newUserThreeGetYB'){
                    messager.bonusMsg('完成新人连续登录3天奖励礼包(第三步)', 105, newUserInfo.id);
                }
                else if (actionId == 'canGet50YB'){
                    messager.bonusMsg('完成新人完成5条任务奖励礼包(第四步)', 50, newUserInfo.id);
                }
                else {
                    messager.bonusMsg('完成新人完成20条任务奖励礼包(第五步)', 100, newUserInfo.id);
                }

                res.json({'errorId':0, 'errorMsg':''})
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
        }

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
}

// 用户领取YB
router.post('/userCanGetYB', function(req, res){
    var userId = util.useridInReq(req);
    var actionId = req.body.actionId;

    var userQuery = new AV.Query(User);
    userQuery.get(userId).then(function(newUserInfo){
        var userCanGetYbObject = Object();
        if (actionId == 'newUserOneGetYB' || actionId == 'newUserTwoGetYB' || actionId == 'newUserThreeGetYB'){
            queryUserA(newUserInfo, actionId, res);
        }
        else if (actionId == 'canGet50YB'){
            queryUserMackTaskCount(newUserInfo, userCanGetYbObject, actionId, res);
        }

        else if (actionId == 'canGet100YB'){
            queryUserMackTaskCount(newUserInfo, userCanGetYbObject, actionId, res);
        }

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});

// 任务达人
router.get('/taskExpert', function(req, res){
    var userId = util.useridInReq(req);

    var query = new AV.Query(User);
    query.equalTo('isTaskExpert', true);
    query.get(userId).then(function(userObject){
        var noviceObject = Object();
        // 任务达人
        noviceObject.luxuryUserStep = userObject.get('luxuryUserStep');
        noviceObject.luxuryYCoin = 0;

        var a = noviceObject.luxuryUserStep;

        if (a < 1){
            noviceObject.luxuryUserStep = 1;
            noviceObject.luxuryYCoin = 15;
        }
        else if (a == 1){
            noviceObject.luxuryUserStep = 2;
            noviceObject.luxuryYCoin = 20;
        }
        else if (a == 2){
            noviceObject.luxuryUserStep = 3;
            noviceObject.luxuryYCoin = 25;
        }
        else if (a == 3){
            noviceObject.luxuryUserStep = 4;
            noviceObject.luxuryYCoin = 35;
        }
        else if (a == 4){
            noviceObject.luxuryUserStep = 5;
            noviceObject.luxuryYCoin = 45;
        }
        else if (a == 5){
            noviceObject.luxuryUserStep = 6;
            noviceObject.luxuryYCoin = 65;
        }
        else if (a == 6){
            noviceObject.luxuryUserStep = 7;
            noviceObject.luxuryYCoin = 80;
        }
        else if (a == 7){
            noviceObject.luxuryUserStep = 8;
            noviceObject.luxuryYCoin = 150;
        }
        else if (a == 8){
            noviceObject.luxuryUserStep = 9;
            noviceObject.luxuryYCoin = 180;
        }
        else if (a == 9){
            noviceObject.luxuryUserStep = 10;
            noviceObject.luxuryYCoin = 230;
        }
        else if (a == 10){
            noviceObject.luxuryUserStep = 11;
            noviceObject.luxuryYCoin = 266;
        }

        res.json({'noviceObject': noviceObject, 'errorId':0, 'errorMsg':'', 'isTaskExpert':true})

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code, 'isTaskExpert':false});
    })
});

// 任务达人领取任务
router.post('/receiveYCoin', function(req, res){
    var userId = util.useridInReq(req);

    // 注：固定从16.11.01开始算, 月份需要减1,因为从0开始算的
    var targetTimeDate = new Date(2016, 10, 1);

    var userQuery = new AV.Query(User);
    userQuery.get(userId).then(function(userObject){
        var luxuryDay = userObject.get('luxuryUserStep');
        var awardYCoin = 0;
        var needDoTaskNumber = 0;
        var taskNeed = [2, 5, 8, 12, 22, 35, 55, 90, 150, 250, 350];
        var awardYCoinList = [15, 20, 25, 35, 45, 65, 80, 150, 180, 230, 266];


        if(luxuryDay == 0){
            luxuryDay = 1;
            needDoTaskNumber = taskNeed[0];
            awardYCoin = awardYCoinList[0];
        }
        else if(luxuryDay == 1){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[1];
            awardYCoin = awardYCoinList[1];
        }
        else if(luxuryDay == 2){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[2];
            awardYCoin = awardYCoinList[2];
        }
        else if(luxuryDay == 3){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[3];
            awardYCoin = awardYCoinList[3];
        }
        else if(luxuryDay == 4){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[4];
            awardYCoin = awardYCoinList[4];
        }
        else if(luxuryDay == 5){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[5];
            awardYCoin = awardYCoinList[5];
        }
        else if(luxuryDay == 6){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[6];
            awardYCoin = awardYCoinList[6];
        }
        else if(luxuryDay == 7){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[7];
            awardYCoin = awardYCoinList[7];
        }
        else if(luxuryDay == 8){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[8];
            awardYCoin = awardYCoinList[8];
        }
        else if(luxuryDay == 9){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[9];
            awardYCoin = awardYCoinList[9];
        }
        else if(luxuryDay == 10){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[10];
            awardYCoin = awardYCoinList[10];
        }
        else if(luxuryDay == 11){
            luxuryDay += 1;
            needDoTaskNumber = taskNeed[11];
            awardYCoin = awardYCoinList[11];
        }

        if(needDoTaskNumber > 0){
            var query = new AV.Query(mackTaskInfo);
            query.equalTo('doTaskUser', userObject);
            query.containedIn('taskStatus', ['accepted', 'systemAccepted']);
            query.greaterThanOrEqualTo('createdAt', targetTimeDate);
            //总计
            query.count().then(function(totalDoTaskCount) {
                if(totalDoTaskCount >= needDoTaskNumber){
                    userObject.increment('totalMoney', awardYCoin);
                    userObject.increment('feedingMoney', awardYCoin);
                    userObject.increment('luxuryUserStep', 1);
                    userObject.save().then(function(){
                        messager.bonusMsg('尊贵任务达人第' + luxuryDay + '奖励', awardYCoin, userObject.id);
                        res.json({'errorMsg':'', 'errorId': 0});
                    }, function(error){
                        res.json({'errorMsg':error.message, 'errorId': error.code});
                    });
                }else {
                    res.json({'errorMsg':'还需要完成' + (needDoTaskNumber - totalDoTaskCount) + '条任务方可领取奖励', 'errorId': -1});
                }
            }, function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
        }else {
            userObject.increment('totalMoney', awardYCoin);
            userObject.increment('feedingMoney', awardYCoin);
            userObject.increment('luxuryUserStep', 1);
            userObject.save().then(function(){
                messager.bonusMsg('尊贵任务达人第' + luxuryDay + '奖励', awardYCoin, userObject.id);
                res.json({'errorMsg':'', 'errorId': 0});
            }, function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
        }


    }, function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});

module.exports = router;