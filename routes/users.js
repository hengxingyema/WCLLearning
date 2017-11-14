'use strict';
var express = require('express');
var AV = require('leanengine');
var router = express.Router();
var util = require('./util');
var https = require('https');
//验证码
var Geetest = require('../gt-sdk');

// var leanObjectRedis = require('../utils/leanObjectRedis');

var User = AV.Object.extend('_User');
var messageObject = AV.Object.extend('messageObject');

var releaseTaskObject = AV.Object.extend('releaseTaskObject'); // 发布的库
var receiveTaskObject = AV.Object.extend('receiveTaskObject'); // 领取任务的库
var cashRecordObjectSql = AV.Object.extend('cashRecordObject');
var ASOPlanObjectSql = AV.Object.extend('ASOPlanObject');

var Base64 = require('../public/javascripts/vendor/base64').Base64;

var cookieTimeout = 1000*60*60*24*30;
// var cookieTimeout = 1000*60;

// 验证码
var pcGeetest = new Geetest({
    privateKey: '9889d9c10b5bcc33c12e3bcba6ac8d83',
    publicKey: 'c508c87580bd11dbaab2a40a02430af2'
});

router.get("/pc-geetest/register", function (req, res) {
    // 向极验申请一次验证所需的challenge
    pcGeetest.register(function (data) {
        res.send(JSON.stringify({
            gt: pcGeetest.publicKey,
            challenge: data.challenge,
            success: data.success
        }));
    });
});

// 用户注册
router.post('/getSmsCode', function(req, res) {
    var userphone = req.body.mobile;
    // 对form表单的结果进行验证
    pcGeetest.validate({

        challenge: req.body.geetest_challenge,
        validate: req.body.geetest_validate,
        seccode: req.body.geetest_seccode

    }, function (err, result) {
        if (err || !result) {
            console.error('------ 验证码服务error', err.message);
            res.json({'errorId':-100, 'errorMsg':'验证码服务出现问题'});
        } else {
            var query = new AV.Query(User);
            query.equalTo('username', userphone);
            query.first().then(function(userObject){
                if (userObject == undefined || userObject.length == 0){
                    //验证码正确才会发送短信,防止被攻击
                    AV.Cloud.requestSmsCode(userphone).then(function() {
                        //发送成功
                        res.json({'errorId':0, 'errorMsg':''});
                    }, function(error) {
                        //发送失败
                        res.json({'errorId':error.code, 'errorMsg':error.message});
                    });
                }else {
                    res.json({'errorId':1, 'errorMsg':'手机号码已存在'})
                }
            },function(error){
                res.json({'errorId':error.code, 'errorMsg':error.message});
            })

        }
    });

});

function userRegister(req, res, next){
    var userphone = req.body.mobile;
    var password = req.body.password;
    var smsCode = req.body.smsCode;
    var inviteUserId = util.decodeUserId(req.body.inviteCode);

    var user = new AV.User();
    user.signUpOrlogInWithMobilePhone({
        mobilePhoneNumber: userphone,
        smsCode: smsCode,
        password:password,
        username:userphone,
        feedingMoney:0,
        totalMoney:0,
        freezingMoney:0,
        registerBonus:'register_new',
        passwordEx:password,
        inviteUserId:inviteUserId
    }).then(function(user) {
        var user_id = user.id;
        //注册或者登录成功
        if(inviteUserId != undefined && inviteUserId.length > 0){
            var inviteUserObject = new AV.User();
            inviteUserObject.id = inviteUserId;
            inviteUserObject.increment('inviteCount', 1);
            inviteUserObject.save();
        }

        //encode userid
        var encodeUserId = Base64.encode(user_id);
        res.cookie('username', user.get('username'), { maxAge: cookieTimeout, path:'/'});
        res.cookie('userIdCookie', encodeUserId, { maxAge: cookieTimeout, path:'/'});
        res.json({'errorId':0, 'errorMsg':''});

    }, function(error) {
        // 失败
        res.json({'errorId':error.code, 'errorMsg':error.message});
    });
}

router.post('/register', function(req, res, next) {
    userRegister(req, res, next);
});

router.get('/', function(req, res, next) {
    res.render('userCenter');
});

//个人中心
router.get('/userCenter',function(req, res){
    var userId = util.useridInReq(req);
    var userNickname = req.body.userNickname;
    var userQQ = req.body.userQQ;

    var query = new AV.Query(User);
    query.get(userId).then(function(results){
        var PhoneNumber = results.get('mobilePhoneNumber');
        var userNickname = results.get('userNickname');
        var userQQ = results.get('userQQ');
        var balance = results.get('totalMoney');
        var freezingMoney = results.get('freezingMoney');
        var registerBonus = results.get('registerBonus');
        var inviteCount = results.get('inviteCount');
        var invitesucceedCount = results.get('inviteSucceedCount');
        var inviteSucceedCount = '';
        if (invitesucceedCount == undefined || invitesucceedCount == 0){
            inviteSucceedCount = 0;
        }else {
            inviteSucceedCount = invitesucceedCount
        }
        var freezingYB = '';
        if (freezingMoney == undefined || freezingMoney <= 0){
            freezingYB = 0;
        }else {
            freezingYB = freezingMoney;
        }

        //信誉系统
        var userReputation = results.get('reputation');
        if(userReputation == undefined){
            userReputation = 100;
        }

        var Administrator = results.get('isSellerChannel');

        res.json({'personAPP':PhoneNumber, 'userNickname':userNickname, 'userReputation': userReputation,'Administrator':Administrator,
            'userQQ':userQQ, 'balance': balance, 'userFreezingYB':freezingYB,
            'registerBonus':registerBonus, 'inviteCount':inviteCount, 'inviteSucceedCount':inviteSucceedCount
        });
    }, function(error){
        //失败
        res.json({'errorId':error.code, 'errorMsg':error.message});
    });
});


//个人中心用户保存信息
router.post('/userSaveInfo',function(req, res){
    var userId = util.useridInReq(req);
    var userNickname = req.body.userNickname;
    var userQQ = req.body.userQQ;

    var user = AV.Object.createWithoutData('User', userId);
    user.set('userNickname', userNickname);
    user.set('userQQ',userQQ);
    user.save().then(function(){
        //保存成功

        //cookie 30天有效期
        res.cookie('username', user.get('username'), { maxAge: cookieTimeout, path:'/'});
        if (userNickname != undefined && userNickname != ''){
            res.cookie('username', userNickname, { maxAge: cookieTimeout, path:'/'});
            res.cookie('uploadName', userNickname, { maxAge: cookieTimeout, path:'/'});
            //console.log('service ----- save do task nickname succeed', userNickname);
        }

        res.json({'errorId':0, 'errorMsg':''});
    },function(error){
        res.json({'errorId':-1, 'errorMsg':error.message});
    })

});

function dateCompare(DateA, DateB) {
    var a = new Date(DateA);
    var b = new Date(DateB);
    var msDateA = Date.UTC(a.getFullYear(), a.getMonth()+1, a.getDate());
    var msDateB = Date.UTC(b.getFullYear(), b.getMonth()+1, b.getDate());
    if (parseFloat(msDateA) < parseFloat(msDateB)) {
        if ((a.getDate() - b.getDate()) == -1) {
            return '昨天';
        }
        else {
            return a.getFullYear() + (a.getMonth() + 1) +  a.getDate() + '';
        }
    }// lt
    else if (parseFloat(msDateA) == parseFloat(msDateB)){
        return '今天';}  // eq
    else if (parseFloat(msDateA) > parseFloat(msDateB)){
        return '未来';} // gt
    else{
        return a.getFullYear() + (a.getMonth() + 1) +  a.getDate() + '';
    }
}

//个人中心获取信息
router.post('/userCenter/YCoinFlow/:page', function(req, res){
    var userId = util.useridInReq(req);
    var page = req.params.page;
    var checkType = req.body.checkType;

    var userObject = new AV.User();
    userObject.id = userId;

    var query_user = new AV.Query(messageObject);
    query_user.equalTo('receiverObject', userObject);

    var query_new = new AV.Query(messageObject);
    query_new.equalTo('receiverObjectId', userId);

    var query_message = AV.Query.or(query_user, query_new);
    query_message.descending('createdAt');
    query_message.include('receiverObject');
    query_message.skip(page * 50);
    query_message.limit(50);


    var queryCash = new AV.Query(cashRecordObjectSql);
    queryCash.equalTo('userId', userId);
    queryCash.descending('createdAt');
    queryCash.skip(page * 50);
    queryCash.limit(50);

    var query = new AV.Query(User);
    query.get(userId).then(function(userObject){
        if (checkType == 'Y币流水'){
            query_message.find().then(function(results){
                var YCoinMessages = Array();
                for (var i = 0; i < results.length; i++){
                    var messageObject = results[i];
                    var messageDicObject = Object();

                    messageDicObject.messageText = messageObject.get('messageText');
                    messageDicObject.type = messageObject.get('type');
                    //messageDicObject. = messageObject.get('');

                    messageDicObject.totalMoney = messageObject.get('totalMoney');
                    messageDicObject.freezingMoney = messageObject.get('freezingMoney');
                    messageDicObject.feedingMoney = messageObject.get('feedingMoney');

                    var messageDate = messageObject.createdAt;
                    messageDicObject.messageDateStr =
                        (messageDate.getMonth() + 1) + '-' + messageDate.getDate() + ' ' + messageDate.getHours() + ':' + messageDate.getMinutes();

                    //css
                    if(messageDicObject.type == '赚取'){
                        messageDicObject.rowClass = 'success';
                    }else if(messageDicObject.type == '解冻'){
                        messageDicObject.rowClass = 'info';
                    }else if(messageDicObject.type == '奖励'){
                        messageDicObject.rowClass = '';
                    }else if(messageDicObject.type == '扣罚'){
                        messageDicObject.rowClass = 'danger';
                    }else if(messageDicObject.type == '支付'){
                        messageDicObject.rowClass = 'danger';
                    }else if(messageDicObject.type == '冻结'){
                        messageDicObject.rowClass = 'warning';
                    }else if(messageDicObject.type == '充值'){
                        messageDicObject.rowClass = 'active';
                    }


                    YCoinMessages.push(messageDicObject);
                }

                if(userObject != undefined){
                    res.json({'YCoinMessages': YCoinMessages, 'totalMoney':userObject.get('totalMoney'),
                        'freezingMoney':userObject.get('freezingMoney'), 'feedingMoney':userObject.get('feedingMoney')});
                }else {
                    res.json({'YCoinMessages': YCoinMessages, 'totalMoney':0,
                        'freezingMoney':0, 'feedingMoney':0});
                }

            },function(error){
                res.json({'errorId': error.code, 'errorMsg': error.message});
            })
        }
        else if (checkType == '现金流水'){
            var lock = 0;
            queryCash.find().then(function(cashObject){
                var cashMessages = Array();
                if (cashObject == undefined || cashObject.length == 0){
                    res.json({'cashMessagesArray':cashMessages});
                    return;
                }
                for (var e = 0; e < cashObject.length; e++){
                    var cashMessageDicObject = Object();
                    cashMessageDicObject.type = cashObject[e].get('type');

                    var cashMessageTime = cashObject[e].createdAt;

                    if (cashMessageDicObject.type == '付费'){
                        cashMessageDicObject.planId = cashObject[e].get('planId');
                        cashMessageDicObject.costMoney = cashObject[e].get('costMoney');
                    }
                    else if (cashMessageDicObject.type == '充值'){
                        cashMessageDicObject.costMoney = cashObject[e].get('rechargeMoney');
                        cashMessageDicObject.messageText = '您充值了' + cashMessageDicObject.costMoney + '元';
                        cashMessageDicObject.cashMessageDate =
                            (cashMessageTime.getMonth() + 1) + '-' + cashMessageTime.getDate() + ' ' +
                            cashMessageTime.getHours() + ':' + cashMessageTime.getMinutes();
                    }
                    else if (cashMessageDicObject.type == '退款'){
                        cashMessageDicObject.costMoney = cashObject[e].get('refundMoney');
                        cashMessageDicObject.messageText = cashObject[e].get('refundMessage');
                        cashMessageDicObject.planId = cashObject[e].get('planId')
                    }
                    else if (cashMessageDicObject.type == '积分兑换'){
                        cashMessageDicObject.costMoney = cashObject[e].get('rechargeMoney');
                        cashMessageDicObject.costPointer = cashObject[e].get('costPointer');
                        cashMessageDicObject.messageText = '您花费' + cashMessageDicObject.costPointer + '积分兑换' +
                            cashMessageDicObject.costMoney + '现金券';
                        cashMessageDicObject.cashMessageDate =
                            (cashMessageTime.getMonth() + 1) + '-' + cashMessageTime.getDate() + ' ' +
                            cashMessageTime.getHours() + ':' + cashMessageTime.getMinutes();
                    }

                    (function messageDicObject(tempMessageDicObject){
                        var projectSwingNow = 0;
                        if (tempMessageDicObject.planId == undefined){
                            lock++;
                            cashMessages.push(tempMessageDicObject)
                        }else {
                            var queryASOPlan = new AV.Query(ASOPlanObjectSql);
                            queryASOPlan.include('appObject');
                            queryASOPlan.get(tempMessageDicObject.planId).then(function(ASOPlanInfo){

                                var planName = ASOPlanInfo.get('appObject').get('trackName');
                                var taskCountPerDay = ASOPlanInfo.get('taskCountPerDay');
                                if (tempMessageDicObject.type != '退款')
                                    tempMessageDicObject.messageText = '您投放了计划:' + planName + ',共' + taskCountPerDay + '条';

                                var planStatus = ASOPlanInfo.get('planDeliverStatus');
                                if (planStatus != 'planEnd'){
                                    projectSwingNow ++
                                }

                                var time = ASOPlanInfo.createdAt;
                                tempMessageDicObject.cashMessageDate =
                                    (time.getMonth() + 1) + '-' + time.getDate() + ' ' + time.getHours() + ':' + time.getMinutes();

                                cashMessages.push(tempMessageDicObject);

                                lock++;
                                if (lock == cashObject.length){
                                    res.json({'cashMessagesArray':cashMessages, 'projectSwingNow':projectSwingNow})
                                }

                            },function(error){
                                lock++;
                                if (lock == cashObject.length) {
                                    console.error('cash logger error ', error.message);
                                    res.json({'cashMessagesArray':cashMessages, 'projectSwingNow':projectSwingNow})
                                }
                            })
                        }

                    })(cashMessageDicObject);
                }
            },function(error){
                res.json({'errorId': error.code, 'errorMsg': error.message});
            })
        }
    },function(error){
        res.json({'errorId': error.code, 'errorMsg': error.message});
    });
});

//// 任务历史
//router.get('/taskhistory', function(req, res){
//  var userId = util.useridInReq(req);
//
//  var user = new AV.User();
//  user.id = userId;
//
//  var query = new AV.Query(releaseTaskObject);
//  query.equalTo('userObject', user);
//  query.include('appObject');
//  query.equalTo('completed', 1);
//  query.descending('createdAt');
//  query.find().then(function(results){
//    var promise = results.length;
//    var counter = 0;
//    var retApps = new Array();
//    for (var i = 0; i < results.length; i++){
//      var historyObject = new Object();
//      var appInfo = results[i].get('appObject');
//      historyObject.trackName = appInfo.get('trackName').substr(0,8);
//      historyObject.artworkUrl100 = appInfo.get('artworkUrl100');
//
//      historyObject.totalCount = results[i].get('excCount');
//      historyObject.taskType = results[i].get('taskType');
//      historyObject.date = results[i].get('releaseDate');
//      historyObject.taskid = results[i].id;
//
//      // 谁领取了我的任务
//      (function(whoReceive){
//        whoReceive.receiveTasks = new Array();
//        var todo = AV.Object.createWithoutData('releaseTaskObject', whoReceive.taskid);
//        var query_receive = new AV.Query(receiveTaskObject);
//        query_receive.equalTo('taskObject', todo);
//        query_receive.include('userObject');
//        query_receive.find().then(function(receiveInfo){
//          for (var e = 0; e < receiveInfo.length; e++){
//            var receiveObject = new Object();
//            var userInfo = receiveInfo[e].get('userObject');
//            var user_name = userInfo.get('userNickname');
//            if (user_name == undefined || user_name == ''){
//              receiveObject.userName = userInfo.get('username').substring(0, 7) + '****';
//            }else {
//              receiveObject.userName = user_name;
//            }
//            receiveObject.receiveCount = receiveInfo[e].get('receiveCount');
//            var status = receiveInfo[e].get('completed');
//            if (status == 1){
//              receiveObject.status = '完成'
//            }else {
//              receiveObject.status = '未完成'
//            }
//            whoReceive.receiveTasks.push(receiveObject);
//          }
//          retApps.push(whoReceive);
//          counter++;
//          if (counter == promise){
//            res.json({'errorMsg':'', 'errorId': 0, 'ReleaseTaskHistory':retApps})
//          }
//        }, function(error){
//          counter++;
//          res.json({'errorMsg':error.message, 'errorId': error.code});
//        })
//      })(historyObject)
//    }
//
//      res.json({'errorMsg':'', 'errorId': 0, 'ReleaseTaskHistory':[]})
//  }, function(error){
//    res.json({'errorMsg':error.message, 'errorId': error.code});
//  })
//});

router.get('/register', function(req, res, next) {
    //res.send('user register :' + encodeUserId);
    res.render('register');
});

router.get('/register/:inviteUserId', function(req, res, next) {
    res.render('register');
});

router.get('/login', function(req, res, next) {
    res.render('login');
});

router.post('/login', function(req, res) {
    var userPhone = req.body.mobile;
    var password = req.body.password;

    if (userPhone == undefined || userPhone == '' || password == undefined || password == ''){
        res.json({'errorId':-1, 'errorMsg':'请输入帐号和密码'});
    }else {
        AV.User.logIn(userPhone, password).then(function(user) {
            // 成功了，现在可以做其他事情了
            var user_id = user.id;
            //encode userid
            var encodeUserId = Base64.encode(user_id);
            var userNickname = user.get('userNickname');
            //login succeed,response cookie to browser
            //cookie 30天有效期
            res.cookie('username', user.get('username'), { maxAge: cookieTimeout, path:'/'});
            res.cookie('userIdCookie', encodeUserId, { maxAge: cookieTimeout, path:'/'});
            if (userNickname != undefined && userNickname != ''){
                res.cookie('username', userNickname, { maxAge: cookieTimeout, path:'/'});
            }

            res.json({'errorId':0, 'errorMsg':''});
        }, function(error) {
            // 失败了
            res.json({'errorId':error.code, 'errorMsg':error.message});
        });
    }
});

router.get('/forget', function(req, res, next) {

    //获取cookie的值
    var encodeUserId = req.cookies.userIdCookie;

    //鉴别cookie是否存在
    if ('undefined' == (typeof req.cookies.userIdCookie)){
        res.send('cookie not exist,need relogin');
    }

    var user_id = Base64.decode(encodeUserId);

    //do the case

    res.send('user id =' + user_id);
});

router.get('/forgetSecret', function(req, res, next) {
    res.render('forgetSecret');
});

router.post('/getNewSmsCode', function(req, res, next) {
    var userphone = req.body.mobile;
    AV.User.requestPasswordResetBySmsCode(userphone).then(function() {
        // 密码重置请求已成功发送
        res.json({'errorId':0, 'errorMsg':''});
    }, function(error) {
        // 记录失败信息
        console.error('send new sms error: ' + error.code + ' ' + error.message);
        res.json({'errorId':error.code, 'errorMsg':error.message});
    });

});

// 重置密码
router.post('/forgetSecret', function(req, res, next) {
    var smsCode = req.body.smsCode;
    var newSecret = req.body.newPassword;
    AV.User.resetPasswordBySmsCode(smsCode, newSecret, {
        success: function(success) {
            // 密码被成功更新,debug sucess 返回的是不是用户
            //TODO: passwordEx:password 新密码记录到passwordEx中
            var userObject = new User();
            userObject.id = success.objectId;
            userObject.set('passwordEx', newSecret);
            userObject.save().then(function () {
                res.json({'errorId':0, 'errorMsg':''});
            }, function (error) {
                res.json({'errorId':0, 'errorMsg':''});
            });

        },
        error: function(error) {
            // 记录失败信息
            console.error('Error: ' + error.code + ' ' + error.message);
            res.json({'errorId':error.code, 'errorMsg':error.message});
        }
    });
});

module.exports = router;
