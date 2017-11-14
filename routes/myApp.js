/**
 * Created by wujiangwei on 16/5/11.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');

var util = require('./util');
var https = require('https');

var tryPriceUtil = require('../utils/tryPriceUtil');
var messager = require('../utils/messager');
var asoRankUtil = require('../utils/asoRank');

var leanObjectRedis = require('../utils/leanObjectRedis');

// `AV.Object.extend` 方法一定要放在全局变量，否则会造成堆栈溢出。
// 详见： https://leancloud.cn/docs/js_guide.html#对象
var IOSAppSql = AV.Object.extend('IOSAppInfo');
var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var IOSAppInfoSQL = AV.Object.extend('IOSAppInfo');
var IOSAppExcLogger = AV.Object.extend('IOSAppExcLogger');
var taskDemandSQL = AV.Object.extend('taskDemandObject');
var releaseTaskObject = AV.Object.extend('releaseTaskObject');
var ASOPlanObjectSql = AV.Object.extend('ASOPlanObject');
var User = AV.Object.extend('_User');

// 查询 我的App
router.get('/', function(req, res) {
    res.render('myApp');
});


function dealiTunesAppFailed(retApps, appObject){
    var appInfoObject = Object();

    appInfoObject.trackName = appObject.get('trackName');
    appInfoObject.artworkUrl100 = appObject.get('artworkUrl100');
    appInfoObject.artworkUrl512 = appObject.get('artworkUrl512');
    appInfoObject.appleId = appObject.get('appleId');
    appInfoObject.appleKind = appObject.get('appleKind');
    appInfoObject.formattedPrice = appObject.get('formattedPrice');
    appInfoObject.latestReleaseDate = appObject.get('latestReleaseDate');
    appInfoObject.excUniqueCode = appObject.get('excUniqueCode');
    appInfoObject.sellerName = appObject.get('sellerName');
    appInfoObject.version = appObject.get('version');
    appInfoObject.bundleId = appObject.get('bundleId');
    appInfoObject.appObjectId = appObject.id;
    appInfoObject.createdAt = appObject.createdAt;
    //appInfoObject.userAddAppId = objectId;
    retApps.push(appInfoObject);
}

router.get('/angular', function(req, res) {
    var userId = util.useridInReq(req);

    var user = new AV.User();
    user.id = userId;
    var promiseCount = 0;

    var query = new AV.Query(IOSAppBinder);
    query.equalTo('userObject', user);
    query.notEqualTo('unBind', true);
    query.include('appObject');
    query.include('userObject');
    query.addDescending('updatedAt');
    query.find({
        success: function(results) {
            if (results.length == 0){
                res.json({'myApps': [], 'errorId': 0});
                return;
            }

            //has blinded
            var retApps = Array();

            var userObject = undefined;
            if(results.length > 0){
                userObject = results[0].get('userObject');
            }
            for (var i = 0; i < results.length; i++){

                var appObject = results[i].get('appObject');
                //var objectId = results[i].id;
                if (appObject == undefined){
                    promiseCount++;
                    continue;
                }
                dealiTunesAppFailed(retApps, appObject);
            }
            var userPayMoney = userObject.get('rechargeRMB');
            var inviteCount = userObject.get('inviteSucceedCount');
            var canAddApp = inviteCount + parseInt(userPayMoney / 100);
            if (userPayMoney < 500){
                res.json({'myApps':retApps, 'inviteSucceedCount': canAddApp, 'errorId': 0});
            }else {
                res.json({'myApps':retApps, 'inviteSucceedCount': canAddApp, 'errorId': 0, 'Limit': true});
            }

        },
        error: function(err) {
            console.error('not app');
            res.json({'errorMsg':err.message, 'errorId': err.code, 'myApps':[]});
        }
    });
});

//更新APP信息
router.post('/UpdateApp', function(req, res){
    var userId = util.useridInReq(req);

    //var userObject = new AV.User();
    //userObject.id = userId;

    var appObjectId = req.body.appObjectId;

    //var appObject = new IOSAppInfoSQL();
    //appObject.id = appObjectId;
    //
    //var query = new AV.Query(IOSAppBinder);
    //query.equalTo('userObject', userObject);
    //query.equalTo('appObject', appObject);
    //query.include('appObject');

    leanObjectRedis.fetchLeanObjectFromCache(appObjectId, 'IOSAppInfo').then(function(userAppBinder){

        var retApps = Array();
        //var appObject = userAppBinder.get('appObject');
        var appid = userAppBinder.get('appleId');

        var appInfoUrl = 'https://itunes.apple.com/lookup?id=' + appid + '&country=cn&entity=software';
        https.get(appInfoUrl, function(httpRes) {

            var totalData = '';

            if (httpRes.statusCode != 200){
                //未检测到App的更新信息
                dealiTunesAppFailed(retApps, userAppBinder);
                res.json({'errorId': 0, 'errorMsg':'App检查更新失败'});
            }else {
                httpRes.on('data', function(data) {
                    totalData += data;
                });

                httpRes.on('end', function(){
                    var dataStr = totalData.toString();
                    var dataObject = eval("(" + dataStr + ")");

                    //appid just 1 result
                    var appInfo = dataObject.results[0];

                    var appInfoObject = util.updateIOSAppInfo(appInfo, userAppBinder);
                    userAppBinder.save().then(function() {
                        // 实例已经成功保存.
                        //retApps.push(appInfoObject);
                        if (appInfoObject.isUpdated == false){
                            res.json({'errorId': 0, 'errorMsg': 'App已经是最新版本','newAppObject':appInfoObject});
                        }else {
                            res.json({'newAppObject':appInfoObject, 'errorId': 0, 'errorMsg': 'APP更新成功'});
                        }


                    }, function(error) {
                        // 失败了.
                        dealiTunesAppFailed(retApps, userAppBinder);
                        res.json({'errorId': -1, 'errorMsg': 'APP更新失败'});

                    });
                })
            }
        }).on('error', function(error) {
            dealiTunesAppFailed(retApps, userAppBinder);
            res.json({'errorId': error.code, 'errorMsg': error.message});

        });

    },function(error){
        res.json({'errorId': error.code, 'errorMsg': error.message});
    })
});

function blindAppToUser(res, userId, appObject, appInfoObject){
    //bind app to userid
    //query did it exist
    var user = new AV.User();
    user.id = userId;

    var query = new AV.Query(IOSAppBinder);
    query.equalTo('appObject', appObject);
    // query.equalTo('userObject', user);
    query.include('userObject');
    query.find({
        success: function(results) {
            if (results.length < 1){
                //新App，未被之前用户绑定过
                var appBlindObject = new IOSAppBinder();
                appBlindObject.set('appObject', appObject);
                appBlindObject.set('userObject', user);

                appBlindObject.save().then(function(post) {
                    // 实例已经成功保存.
                    res.json({'newApp':appInfoObject, 'appObjectId':post.id});
                }, function(err) {
                    // 失败了.
                    res.json({'errorMsg':err.message, 'errorId': err.code});
                });
            }else {
                var selfBindAppObject;
                var isAppBeBind = false;
                for (var i = 0; i < results.length; i++){
                    var bindObject = results[i];

                    //该用户曾经有没有绑定过该App
                    var bindUserObject = bindObject.get('userObject');
                    if(bindUserObject.id == userId){
                        selfBindAppObject = bindObject;
                    }

                    //该App有没有被其他人正在绑定
                    var unBind = bindObject.get('unBind');
                    if(unBind == undefined){
                        isAppBeBind = true;
                    }
                }

                //我曾经有没有绑定过这个App
                //1.绑定过
                if(selfBindAppObject != undefined){
                    if(results.length == 1){
                        //  该App必须没有被其他人绑定过，我才可以绑定
                        bindObject.unset('unBind');
                        bindObject.set('unBind', false);
                        bindObject.save();
                        res.json({'newApp':appInfoObject, 'errorId':0, 'errorMsg':''});
                    }else {
                        if(isAppBeBind == false){
                            res.json({'errorId':-1, 'errorMsg':'该App在你解绑期间被其他人绑定过，联系客服解决该问题(出示App所有权证明文件)'});
                        }else {
                            res.json({'errorId':-1, 'errorMsg':'该App已经被其他用户绑定，请联系客服(需出示相关App所有权证明)来获得该App的拥有权'});
                        }
                    }
                }
                //2.未绑定过
                else{
                    if(isAppBeBind == false){
                        //  该App必须没有被其他人正在绑定，我才可以绑定
                        var appBlindObject = new IOSAppBinder();
                        appBlindObject.set('appObject', appObject);
                        appBlindObject.set('userObject', user);

                        appBlindObject.save().then(function(post) {
                            // 实例已经成功保存.
                            res.json({'newApp':appInfoObject, 'appObjectId':post.id});
                        }, function(err) {
                            // 失败了.
                            res.json({'errorMsg':err.message, 'errorId': err.code});
                        });
                    }else {
                        res.json({'errorId':-1, 'errorMsg':'该App已经被绑定，请联系客服(需出示相关App所有权证明)来获得该App的拥有权'});
                    }

                }
            }
        },
        error: function(err) {
            var appBlindObject = new IOSAppBinder();
            appBlindObject.set('appObject', appObject);
            appBlindObject.set('userObject', user);

            appBlindObject.save().then(function(post) {
                // 实例已经成功保存.
                res.json({'newApp':appInfoObject});
            }, function(err) {
                // 失败了.
                res.json({'errorMsg':err.message, 'errorId': err.code});
            });
        }
    });
}

// 新增 我的 App
router.post('/add', function(req, res, next) {
    var appInfo = req.body.appInfo;
    var userId = util.useridInReq(req);

    //query did it exist
    var query = new AV.Query(IOSAppSql);
    query.equalTo('appleId', appInfo.appleId);
    query.descending('updatedAt');
    query.find({
        success: function(results) {
            var appObject = '';
            if (results.length >= 1){
                //update
                appObject = results[0];
            }else {
                appObject = new IOSAppSql();
            }

            appObject.set('trackName', appInfo.trackName);
            appObject.set('artworkUrl100', appInfo.artworkUrl100);
            appObject.set('artworkUrl512', appInfo.artworkUrl512);
            appObject.set('appleId', appInfo.appleId);
            appObject.set('appleKind', appInfo.appleKind);
            appObject.set('formattedPrice', appInfo.formattedPrice);
            appObject.set('latestReleaseDate', appInfo.latestReleaseDate);
            appObject.set('excUniqueCode', appInfo.excUniqueCode);
            appObject.set('sellerName', appInfo.sellerName);
            appObject.set('version', appInfo.version);
            appObject.set('bundleId', appInfo.bundleId);

            appObject.save().then(function() {
                // 实例已经成功保存.
                appInfo.appObjectId = appObject.id;
                blindAppToUser(res, userId, appObject, appInfo);

            }, function(err) {
                // 失败了.
                res.json({'errorMsg':err.message, 'errorId': err.code});
            });
        },
        error: function(err) {
            res.json({'errorMsg':err.message, 'errorId': err.code});
        }
    });
});

// 新增 我的 App
router.post('/shopAddApp', function(req, res, next) {
    var appInfo = req.body.appInfo;

    //query did it exist
    var query = new AV.Query(IOSAppSql);
    query.equalTo('appleId', appInfo.appleId);
    query.descending('updatedAt');
    query.find({
        success: function(results) {
            var appObject = '';
            if (results.length >= 1){
                //update
                appObject = results[0];
            }else {
                appObject = new IOSAppSql();
            }

            appObject.set('trackName', appInfo.trackName);
            appObject.set('artworkUrl100', appInfo.artworkUrl100);
            appObject.set('artworkUrl512', appInfo.artworkUrl512);
            appObject.set('appleId', appInfo.appleId);
            appObject.set('appleKind', appInfo.appleKind);
            appObject.set('formattedPrice', appInfo.formattedPrice);
            appObject.set('latestReleaseDate', appInfo.latestReleaseDate);
            appObject.set('excUniqueCode', appInfo.excUniqueCode);
            appObject.set('sellerName', appInfo.sellerName);
            appObject.set('version', appInfo.version);
            appObject.set('bundleId', appInfo.bundleId);

            appObject.save().then(function(savedAppObject) {
                // 实例已经成功保存.
                appInfo.appObjectId = appObject.id;
                res.json({'message': '', 'errorId': 0, 'appObjectId': savedAppObject.id});
            }, function(err) {
                // 失败了.
                res.json({'errorMsg':err.message, 'errorId': err.code});
            });
        },
        error: function(err) {
            res.json({'errorMsg':err.message, 'errorId': err.code});
        }
    });
});

// 删除 我的 App
router.post('/delete', function(req, res, next) {
    var appid = req.body.appid;
    var userId = util.useridInReq(req);

    //query did it exist
    var query = new AV.Query(IOSAppSql);
    query.equalTo('appleId', appid);
    query.descending('updatedAt');
    query.find({
        success: function(results) {
            var appObject = results[0];

            //bind app to userid
            //query did it exist
            var user = new AV.User();
            user.id = userId;

            var query = new AV.Query(IOSAppBinder);
            query.equalTo('appObject', appObject);
            query.equalTo('userObject', user);

            query.find({
                success: function(results) {
                    //has blinded
                    if (results.length < 1){
                        res.json({'errorMsg':'' , 'errorId': 0});
                    }else {
                        var blindObject = results[0];

                        blindObject.set('unBind', true);
                        blindObject.save().then(function() {
                            // 删除成功
                            res.json({'errorMsg':'' , 'errorId': 0});
                        }, function(err) {
                            // 失败
                            res.json({'errorMsg':err.message , 'errorId': err.code});
                        });
                    }
                },
                error: function(err) {
                    res.json({'errorMsg':err.message , 'errorId': err.code});
                }
            });
        },
        error: function(err) {
            res.json({'errorMsg':'not find appid info' , 'errorId': -1});
        }
    });
});

//// 发布任务
var myRate = 1;

//可发布再进行中任务权限
router.post('/checkSendTask', function(req, res) {
    var userId = util.useridInReq(req);

    var excCount = parseInt(req.body.excCount); // 发布总数量
    var excPrice = parseInt(req.body.excPrice); //单个任务单价

    leanObjectRedis.fetchLeanObjectFromCache(userId, '_User').then(function(userObject){
        var userMoney = userObject.get('totalMoney');
        if (userMoney >= excCount * excPrice){
            var queryMyTask = new AV.Query(releaseTaskObject);
            queryMyTask.notEqualTo('cancelled', true);
            queryMyTask.notEqualTo('close', true);
            queryMyTask.equalTo('userObject', userObject);
            //queryMyTask.doesNotExist('planObject');
            queryMyTask.greaterThan('remainCount', 0);
            queryMyTask.find().then(function(releaseTaskObjects) {

                var unGetAllTaskCount = releaseTaskObjects.length;
                if (userObject.get('rechargeRMB') < 500 && unGetAllTaskCount >= 2 && userObject.get('isSellerChannel') != 'yangyang') {
                    res.json({'errorMsg': '你还有2个任务未被领完哦,等领完再发吧', 'errorId': -1});
                    return;
                }

                var offsetTime;
                if (releaseTaskObjects.length != 0){
                    var firstTaskObject = releaseTaskObjects[0];
                    var createdAtDateTime = firstTaskObject.createdAt.getTime();

                    var nowDateTime = new Date().getTime();

                    // 获取差值，如果指定日期早于现在，则为负数
                    offsetTime = nowDateTime - createdAtDateTime;
                }

                if (offsetTime < 3000){
                    res.json({'errorId': -1, 'errorMsg':'3秒后再发布吧!'});
                    return;
                }

                //TODO 尊贵用户
                res.json({'errorMsg': 'can send task', 'errorId': 0});
            });
        }else {
            //Y币不够
            var firstRecharge = userObject.get('firstRecharge');
            if(firstRecharge != undefined && firstRecharge > 0){
                res.json({'errorMsg': '您的Y币不够哦,去首页参与首充:99元可获得1980Y币', 'errorId': -10});
            }else {
                res.json({'errorMsg': '您的Y币不够哦,现在充值500额外赠送700Y币', 'errorId': -10});
            }
        }
    });
});

// 保存任务需求编辑内容createPlanObject
function saveDemands(createPlanObject, userObject, res){

    var appObject = new IOSAppInfoSQL();
    appObject.id = createPlanObject.appObjectId;

    var query = new AV.Query(taskDemandSQL);
    query.equalTo('userObject', userObject);
    query.equalTo('appObject', appObject);
    query.include('appObject');
    query.include('userObject');
    query.descending('createdAt');

    query.first().then(function(results){
        if (results == undefined){
            //第一次保存需求
            var taskDemandObject = new taskDemandSQL();
            taskDemandObject.set('userObject', userObject);  //和用户表关联
            taskDemandObject.set('appObject', appObject);  //和app表关联

            //use excUniqueCode now,latestReleaseDate just for display
            taskDemandObject.set('latestReleaseDate', appObject.get('latestReleaseDate'));
            taskDemandObject.set('excUniqueCode', appObject.get('excUniqueCode'));

            taskDemandObject.set('taskType', createPlanObject.taskType);  // 任务类型
            taskDemandObject.set('excCount', String(createPlanObject.amountPerDay));  // 任务条数
            taskDemandObject.set('excUnitPrice', createPlanObject.excUnitPrice);  //任务单价

            taskDemandObject.set('searchKeyword', createPlanObject.searchKeyword);  // 搜索关键词
            taskDemandObject.set('ranKing', String(createPlanObject.ranKing));  // 排名
            taskDemandObject.set('needGet', createPlanObject.needGet); // 获取
            taskDemandObject.set('registerStatus', createPlanObject.registerStatus); // 注册方式

            if(createPlanObject.taskType  == '评论'){
                taskDemandObject.set('Score', parseInt(createPlanObject.Score));  // 评分
                taskDemandObject.set('titleKeyword', createPlanObject.titleKeyword); // 标题关键字
                taskDemandObject.set('reviewMustTitleKey', createPlanObject.reviewMustTitleKey); // 标题必选
                taskDemandObject.set('commentKeyword', createPlanObject.commentKeyword); // 评论关键字
                taskDemandObject.set('reviewMustContentKey', createPlanObject.reviewMustContentKey); // 评论必选
                taskDemandObject.set('needMoreReviewContent', createPlanObject.needMoreReviewContent); // 评论必须满足50个字
            }

            if (createPlanObject.taskType == '定制评论'){
                taskDemandObject.set('Score', parseInt(createPlanObject.Score));  // 评分
                taskDemandObject.set('reviewHeaderOptions', createPlanObject.reviewHeaderOptions);  // 备选标题
                taskDemandObject.set('reviewContentOptions', createPlanObject.reviewContentOptions);  // 备选内容
            }

            taskDemandObject.set('detailRem', createPlanObject.detailRem);  // 备注

            taskDemandObject.set('needOfficialAudit', createPlanObject.needOfficialAudit);  // 需要官方审核

            //2个都会保存
            taskDemandObject.save().then(function(){
                res.json({'errorMsg':'', 'errorId': 0});
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
        }
        else {
            results.set('userObject', userObject);  //和用户表关联
            results.set('appObject', appObject);  //和app表关联

            //use excUniqueCode now,latestReleaseDate just for display
            results.set('latestReleaseDate', appObject.get('latestReleaseDate'));
            results.set('excUniqueCode', appObject.get('excUniqueCode'));

            results.set('taskType', createPlanObject.taskType);  // 任务类型
            results.set('excCount', String(createPlanObject.amountPerDay));  // 任务条数
            results.set('excUnitPrice', createPlanObject.excUnitPrice);  //任务单价

            results.set('searchKeyword', createPlanObject.searchKeyword);  // 搜索关键词
            results.set('ranKing', String(createPlanObject.ranKing));  // 排名
            results.set('needGet', createPlanObject.needGet); // 获取
            results.set('registerStatus', createPlanObject.registerStatus); // 注册方式

            if(createPlanObject.taskType  == '评论'){
                results.set('Score', parseInt(createPlanObject.Score));  // 评分
                results.set('titleKeyword', createPlanObject.titleKeyword); // 标题关键字
                results.set('reviewMustTitleKey', createPlanObject.reviewMustTitleKey); // 标题必选
                results.set('commentKeyword', createPlanObject.commentKeyword); // 评论关键字
                results.set('reviewMustContentKey', createPlanObject.reviewMustContentKey); // 评论必选
                results.set('needMoreReviewContent', createPlanObject.needMoreReviewContent); // 评论必须满足50个字
            }

            if (createPlanObject.taskType == '定制评论'){
                results.set('reviewHeaderOptions', createPlanObject.reviewHeaderOptions);  // 备选标题
                results.set('reviewContentOptions', createPlanObject.reviewContentOptions);  // 备选内容
            }

            results.set('detailRem', createPlanObject.detailRem);  // 备注

            results.set('needOfficialAudit', createPlanObject.needOfficialAudit);  // 需要官方审核

            results.save().then(function(){
                res.json({'errorMsg':'', 'errorId': 0});
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
        }
    }, function(error){
        console.error('save app demand when send task error:' + error.message);
    });
}


router.post('/saveTask', function(req, res){
    var userId = util.useridInReq(req);

    var userObject = new User();
    userObject.id = userId;

    var saveTaskObject = req.body.saveTaskObject;

    saveDemands(saveTaskObject, userObject, res);
});

//获取需求编辑信息
router.get('/getNeed/:appObjectId', function(req, res){
    var userId = util.useridInReq(req);
    var appObjectId = req.params.appObjectId;

    var user = new AV.User();
    user.id = userId;

    var appObject = new IOSAppInfoSQL();
    appObject.id = appObjectId;

    var query = new AV.Query(taskDemandSQL);
    query.equalTo('userObject', user);
    query.equalTo('appObject', appObject);
    query.include('appObject');
    query.include('taskDemand');
    query.descending('createdAt');

    query.first().then(function(data){
        var appDemandInfo = Object();
        if (data != undefined){
            var appObject = data.get('appObject');

            appDemandInfo.taskType = data.get('taskType');
            appDemandInfo.amountPerDay = parseInt(data.get('excCount'));

            appDemandInfo.searchKeyword = data.get('searchKeyword');
            appDemandInfo.ranKing = parseInt(data.get('ranKing'));
            var asoRank = data.get('ranKing'); // 排名YCoin
            if (asoRank <= 20){
                appDemandInfo.asoRank = 0;
            }
            else if (asoRank >= 21 && asoRank <= 50){
                appDemandInfo.asoRank = (asoRank / 10 - 2).toFixed(1);
            }
            else {
                appDemandInfo.asoRank = (3 + (asoRank - 50) * 0.5).toFixed(1);
            }

            //兼容老的保存需求
            if(data.get('screenshotCount') != undefined && data.get('screenshotCount') > 0){
                appDemandInfo.screenshotCount = data.get('screenshotCount');
            }

            appDemandInfo.excUnitPrice = data.get('excUnitPrice'); //任务单价YCoin

            appDemandInfo.needGet = data.get('needGet'); // 获取YCoin
            appDemandInfo.registerStatus = data.get('registerStatus'); // 注册方式
            if(appDemandInfo.registerStatus == undefined){
                appDemandInfo.registerStatus = 'noNeed';
            }

            if(data.get('Score') == undefined){
                appDemandInfo.Score = 5;
            }
            else {
                appDemandInfo.Score = data.get('Score'); // 评分
            }

            appDemandInfo.titleKeyword = data.get('titleKeyword');
            appDemandInfo.reviewMustTitleKey = data.get('reviewMustTitleKey'); // 标题必选
            appDemandInfo.commentKeyword = data.get('commentKeyword');
            appDemandInfo.reviewMustContentKey = data.get('reviewMustContentKey'); // 评论必选
            appDemandInfo.needMoreReviewContent = data.get('needMoreReviewContent'); // 评论需满50字
            appDemandInfo.needOfficialAudit = data.get('needOfficialAudit'); // 是否需要官方审核
            appDemandInfo.detailRem = data.get('detailRem');

            if(appDemandInfo.detailRem != undefined && appDemandInfo.detailRem.indexOf('获取') != -1){
                appDemandInfo.needGet = true;
            }

            appDemandInfo.demandTemplateId = data.id;

            res.json({'appDemandInfo':appDemandInfo, 'errorId':0})
        }
        else {
            appDemandInfo.taskType = '评论';
            appDemandInfo.registerStatus = 'noNeed';
            appDemandInfo.Score = 5;
            res.json({'appDemandInfo':appDemandInfo, 'errorId':0})
        }

    }, function (error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});

// 验证钱够不够发布任务
router.get('/verify', function(req, res){
    var userId = util.useridInReq(req);

    var query = new AV.Query(User);
    query.get(userId).then(function(userObject){
        if (userObject == undefined){
            res.render('login');
        }else {
            var usermoney = userObject.get('totalMoney');
            res.json({'usermoney': usermoney, 'isManager': userObject.get('isSellerChannel') == 'yangyang'});
        }
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});

//关键词排名
router.post('/asoRank', function(req, res){
    var userId = util.useridInReq(req);
    leanObjectRedis.fetchLeanObjectFromCache(userId, '_User').then(function(userObject){
        if (userObject == undefined){
            res.json({'errorId': -100, 'errorMsg':'not login'});
        }else {
            var asoWord = req.body.asoWord;
            var appleId = req.body.appleId;
            var maxASOKey = req.body.maxASOKey;

            if(maxASOKey == undefined){
                //默认200名内
                maxASOKey = 200;
            }

            if(asoWord == undefined || asoWord == ''){
                res.json({'errorMsg':'关键词为空', 'errorId': 1});
                return;
            }

            if(appleId == undefined || appleId == ''){
                res.json({'errorMsg':'应用AppleID为空', 'errorId': 1});
                return;
            }

            tryPriceUtil.aso100RankUrl(appleId, asoWord, function (asoKeyRank, errorId, errorMsg) {
                res.json({'errorMsg':errorMsg, 'errorId': errorId, 'asoKeyRank': asoKeyRank, 'rankedAppleId': appleId});
            });
        }
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});

//aso100RankUrl('同城', 1, '979605189', 1);

//appObject can be null
function planObjectToDic(planObject, localAppObject) {
    var nowDate = new Date();
    var asoPlanObject = Object();

    asoPlanObject.planId = planObject.id;
    if(localAppObject != undefined){
        asoPlanObject.appObjectId = localAppObject.appObjectId;
        asoPlanObject.appleId = localAppObject.appleId;
        asoPlanObject.trackName = localAppObject.trackName;
        asoPlanObject.artworkUrl100 = localAppObject.artworkUrl100;
        asoPlanObject.artworkUrl512 = localAppObject.artworkUrl512;
    }else {
        var appObject = planObject.get('appObject');
        if(appObject == undefined){
            //app object be deleted
            return undefined;
        }
        asoPlanObject.appObjectId = appObject.id;
        asoPlanObject.appleId = appObject.get('appleId');
        asoPlanObject.trackName = appObject.get('trackName');
        asoPlanObject.artworkUrl100 = appObject.get('artworkUrl100');
        asoPlanObject.artworkUrl512 = appObject.get('artworkUrl512');
    }

    asoPlanObject.planName = planObject.get('planName');  // 方案名字
    asoPlanObject.asoKey = planObject.get('asoKey');   // 搜索关键词
    asoPlanObject.planStatus = planObject.get('planStatus'); // 投放状态
    asoPlanObject.sendType = planObject.get('sendType'); // 投放状态


    asoPlanObject.deliverSucceedReason = planObject.get('deliverSucceedReason');  // 投放失败原因
    asoPlanObject.deliverErrorReason = planObject.get('deliverErrorReason');  // 投放失败原因

    //时间
    asoPlanObject.taskCountPerDay = planObject.get('taskCountPerDay');
    asoPlanObject.taskLastDay = planObject.get('taskLastDay');
    asoPlanObject.delayTaskDay = planObject.get('delayTaskDay');
    asoPlanObject.taskHour = planObject.get('taskHour');
    asoPlanObject.planDisCount = planObject.get('planDisCount');
    asoPlanObject.ranKing = planObject.get('startRanking');

    // 投放状态
    if(planObject.get('sendType') == 'now' && planObject.get('planDeliverStatus') == 'planEnd'){
        asoPlanObject.deliverDateString = '方案投放成功';
    }else {
        asoPlanObject.createdAtDate = planObject.createdAt;  // 创建时间
        // 对于创建计划时间大于投放时间的，今天投放和明天投放是一个概念
        if(asoPlanObject.delayTaskDay == 0 && asoPlanObject.createdAtDate.getHours() > asoPlanObject.taskHour){
            // 次日才会开始投放
            asoPlanObject.delayTaskDay = 1;
        }
        // 计算投放开始时间 (1天后投放，就是明天投放，以此类推)
        planObject.createdAt.setHours(asoPlanObject.taskHour);
        planObject.createdAt.setMinutes(0);
        planObject.createdAt.setSeconds(0);
        planObject.createdAt.setMilliseconds(0);

        //计算投放 开始时间 和 结束时间
        var dayMiniMi = 24*60*60*1000;
        var firstPlanActiveTime = planObject.createdAt.getTime() + asoPlanObject.delayTaskDay * dayMiniMi;
        var firstPlanActiveDate = new Date(firstPlanActiveTime);
        var endPlanActiveTime = firstPlanActiveTime + (asoPlanObject.taskLastDay - 1)* dayMiniMi;
        var endPlanActiveDate = new Date(endPlanActiveTime);

        asoPlanObject.deliverDateString = util.dateToString(firstPlanActiveDate, true) + ' 至 ' + util.dateToString(endPlanActiveDate, true);
    }

    if(asoPlanObject.sendType == 'timer'){
        //计算天数
        var nowTime = nowDate.getTime();
        if(firstPlanActiveTime > nowTime){
            //未开始
            asoPlanObject.planDes = '准备投放';
            asoPlanObject.planDeliverStatus = 'planWaiting';
        }else if(endPlanActiveTime < nowTime){
            //已经结束
            asoPlanObject.planDes = '投放结束,请在审核任务中查看任务结果';
            asoPlanObject.planDeliverStatus = 'planEnd';
        }else{
            //正在进行
            asoPlanObject.planDes = '投放中,请在审核任务中查看任务结果';
            asoPlanObject.planDeliverStatus = 'planDoing';
        }
    }else {
        asoPlanObject.planDes = '已经投放';
        asoPlanObject.planDeliverStatus = planObject.get('planDeliverStatus');
    }


    //什么任务，每天投放X条，共投放X天
    asoPlanObject.taskType = planObject.get('taskType');  // 评论还是下载
    asoPlanObject.taskCountPerDay = planObject.get('taskCountPerDay');  // 投放量

    //开始投放关键词排名，现在排名

    asoPlanObject.needThird = planObject.get('needThird');  // 是否需要第三方
    asoPlanObject.commentKeys = planObject.get('commentKeys');
    asoPlanObject.commentContentKeys = planObject.get('commentContentKeys');
    asoPlanObject.formalCheck = planObject.get('formalCheck'); // 是否需要官方审核
    asoPlanObject.comment4G = planObject.get('comment4G'); // 是否需要4G
    asoPlanObject.needGet = planObject.get('needGet'); // 是否需要获取

    //报表使用
    // asoPlanObject.startRanking = ASOPlanObjects[i].get('startRanking'); // 排名

    return asoPlanObject;
}

// 创建计划
router.post('/createPlan', function(req, res){
    var userId = util.useridInReq(req);
    var createAsoPlanInfo = req.body.createAsoPlanInfo;

    var userObject = new User();
    userObject.id = userId;

    var appObject = new IOSAppSql();
    appObject.id = createAsoPlanInfo.appObjectId;
    var asoKey = createAsoPlanInfo.searchKeyword;
    var amountPerDay = createAsoPlanInfo.amountPerDay; // 投放每天数量
    var date = '';  // 投放开始日期
    if (createAsoPlanInfo.startDate == undefined){
        date = 0;  // 投放开始日期
    }
    else {
        date = createAsoPlanInfo.startDate;
    }
    var putPeriod = '';  // 投放宗天数

    if (createAsoPlanInfo.putNumberOfDays == undefined){
        putPeriod = 1
    }
    else {
        putPeriod = createAsoPlanInfo.putNumberOfDays;
    }
    var period = '';  // 几点投放
    if (createAsoPlanInfo.period == undefined){
        period = 8
    }else {
        period = createAsoPlanInfo.period;
    }

    //限制排名
    if(createAsoPlanInfo.ranKing > 200){
        res.json({'message':'排名不能大于200', 'errorId': -1});
        return;
    }

    var commentOver50 = '';
    if (createAsoPlanInfo.needMoreReviewContent == 1){
        commentOver50 = true;
    }
    else {
        commentOver50 = false;
    }

    leanObjectRedis.fetchLeanObjectFromCache(userId, '_User').then(function(userObject){
        var userMoney = userObject.get('totalMoney');
        if (userMoney >= amountPerDay * createAsoPlanInfo.excUnitPrice){

            if(createAsoPlanInfo.planId == undefined){
                //新建计划
                createPlanObject = new ASOPlanObjectSql();
                responseMessage = '创建投放方案';

                if(createAsoPlanInfo.sendType == 'now'){
                    responseMessage = 'ASO优化(' +  createAsoPlanInfo.asoKey + ')任务发布';
                }

                //为付费用户记录
                asoRankUtil.recordAppASOKey(createAsoPlanInfo.appleId, createAsoPlanInfo.asoKey, parseInt(createAsoPlanInfo.ranKing), createAsoPlanInfo.appObjectId);

                modifyPlanObject(createPlanObject, responseMessage);
            }
        }
        else {
            res.json({'errorId': 1, 'errorMsg':'账户余额不足'})
        }

        var createPlanObject, responseMessage;

        function modifyPlanObject(createPlanObject, responseMessage) {
            //创建计划/修改
            //App 和 ASO词
            createPlanObject.set('planName', createAsoPlanInfo.planName);
            createPlanObject.set('sendType', createAsoPlanInfo.sendType);
            createPlanObject.set('userObject', userObject);
            createPlanObject.set('appObject', appObject);
            createPlanObject.set('appleId', createAsoPlanInfo.appleId);
            createPlanObject.set('asoKey', asoKey);
            createPlanObject.set('startRanking', parseInt(createAsoPlanInfo.ranKing));
            createPlanObject.set('excUnitPrice', createAsoPlanInfo.excUnitPrice);
            createPlanObject.set('yeMa', 'yeMa');

            //任务类型和额外要求 和 数量
            createPlanObject.set('taskType' , createAsoPlanInfo.taskType);
            createPlanObject.set('taskCountPerDay', parseInt(amountPerDay));
            createPlanObject.set('Score', String(createAsoPlanInfo.score));
            createPlanObject.set('needMoreReviewContent', commentOver50);
            //额外需求
            if(createAsoPlanInfo.formalCheck == undefined){
                createPlanObject.set('formalCheck', '');
            }else {
                createPlanObject.set('formalCheck', createAsoPlanInfo.formalCheck);
            }

            if(createAsoPlanInfo.needGet == true){
                createPlanObject.set('needGet', 'needGet');
            }

            if(createAsoPlanInfo.registerStatus == 'third'){
                createPlanObject.set('needThird', 'needThird');
            }

            if (createAsoPlanInfo.taskType == '定制评论'){
                createPlanObject.set('reviewHeaderOptions', createAsoPlanInfo.reviewHeaderOptions);  // 备选标题
                createPlanObject.set('reviewContentOptions', createAsoPlanInfo.reviewContentOptions);  // 备选内容
            }

            if (createAsoPlanInfo.taskType == '评论'){
                createPlanObject.set('commentKeys', createAsoPlanInfo.titleKeyword);
                createPlanObject.set('reviewMustTitleKey', createPlanObject.reviewMustTitleKey);
                createPlanObject.set('commentContentKeys', createAsoPlanInfo.commentKeyword);
                createPlanObject.set('reviewMustContentKey', createAsoPlanInfo.reviewMustContentKey);
            }

            //投放细节(每天几条，何时，几天，几天后投放)
            if(createAsoPlanInfo.sendType == 'timer'){
                createPlanObject.set('taskLastDay', parseInt(putPeriod));
                createPlanObject.set('taskHour', parseInt(period));
                createPlanObject.set('delayTaskDay', parseInt(date));
            }

            saveDemands(createAsoPlanInfo, userObject, res);
            createPlanObject.save().then(function(date){
                var localAppObject = {};
                localAppObject.appObjectId = createAsoPlanInfo.appObjectId;
                localAppObject.appleId = createAsoPlanInfo.appleId;
                localAppObject.trackName = createAsoPlanInfo.trackName;
                localAppObject.artworkUrl100 = createAsoPlanInfo.artworkUrl100;
                localAppObject.artworkUrl512 = createAsoPlanInfo.artworkUrl512;

                var createdAsoPlan = planObjectToDic(date, localAppObject);

                if(createAsoPlanInfo.sendType == 'now' && createAsoPlanInfo.actionId == undefined){
                    responseMessage = 'ASO优化(' +  createAsoPlanInfo.asoKey + ')任务发布';

                    //查询plan，因为需要用户和App信息
                    var planQuery = new AV.Query(ASOPlanObjectSql);
                    //10天内创建的ASO优化方案
                    //备注:hidden show 都是针对已经被完成的任务的操作
                    planQuery.equalTo('objectId', date.id);
                    planQuery.include('lastReleaseTask');
                    planQuery.include('appObject');
                    planQuery.include('userObject');
                    planQuery.first().then(function(tempPlanObject) {
                        var needToBatchSaveObject = [];
                        //send Task now
                        var ret = tryPriceUtil.planToRelTaskObject(tempPlanObject, parseInt(createAsoPlanInfo.ranKing), needToBatchSaveObject);
                        if(ret == false){
                            res.json({'message': '账户余额不足，发布任务失败', 'errorId': 1});
                            return;
                        }

                        AV.Object.saveAll(needToBatchSaveObject).then(function () {
                            responseMessage = responseMessage + '成功';
                            messager.freezeMsg(tempPlanObject.get('appObject').get('trackName'), tempPlanObject.get('excUnitPrice') * parseInt(amountPerDay), userObject.id);
                            res.json({'errorId':0, 'message':responseMessage})

                        }, function (error) {
                            responseMessage = responseMessage + '失败: ' + error.message;
                            res.json({'message': responseMessage, 'errorId': error.code});
                        })
                    }, function (error) {
                        responseMessage = responseMessage + '失败: ' + error.message;
                        res.json({'message': responseMessage, 'errorId': error.code});
                    });

                }else {
                    userObject.save().then(function(){
                        responseMessage = responseMessage + '成功';
                        res.json({'errorId':0, 'message':responseMessage})
                    });

                }
            },function(error){
                responseMessage = responseMessage + '失败: ' + error.message;
                res.json({'message': responseMessage, 'errorId': error.code});
            })
        }

    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});

module.exports = router;