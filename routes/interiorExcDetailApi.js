/**
 * Created by cailong on 16/7/21.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

//防作弊
var requestIp = require('request-ip');
var userAgent = require('express-useragent');


var User = AV.Object.extend('_User');
var releaseTaskObject = AV.Object.extend('releaseTaskObject');
var receiveTaskObject = AV.Object.extend('receiveTaskObject'); // 领取任务的库
var mackTaskInfo = AV.Object.extend('mackTaskInfo');
var revokeTaskSQL = AV.Object.extend('revokeTaskObject');

var File = AV.Object.extend('_File');
var nodemailer = require('nodemailer');

var Base64 = require('../public/javascripts/vendor/base64').Base64;

// create reusable transporter object using the default SMTP transport
var transporter = nodemailer.createTransport("SMTP",{
    service: 'QQ',
    auth: {
        user: "719480449@qq.com", // 账号
        pass: "kabggqckzbuwbdgi" // 密码
    }
});

function submissionNotification(qq){
    if (qq != undefined && qq.length > 0){
        // setup e-mail data with unicode symbols
        var mailOptions = {
            from: '"野马ASO" <719480449@qq.com>', // sender address
            to: qq + '@qq.com', // list of receivers
            subject: '野马任务审核提醒', // Subject line
            html: '<p>尊敬的野马用户,您今日发布的任务已经有人领取并提交了,请快速到' +
            '<a style="color:red" href="http://www.mustangop.com/taskCheck">审核界面</a>审核提交结果.</p>' // html body
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, function(error, info){
            if(error){
                console.error('Mail Message send error: ' + error.message);
            }
            else{
                //console.log('Message sent: ' + info.response);
            }
        });
    }
}

router.get('/:excTaskId', function(req, res){
    res.render('interiorExcDetail')
});


router.get('/interior/:excTaskId', function(req, res){
    var excTaskId = req.params.excTaskId;
    var query = new AV.Query(receiveTaskObject);
    query.include('taskObject');
    query.include('appObject');
    query.include('userObject');
    query.get(excTaskId).then(function(results){
        var retObject = Object();
        var hisappObject = results.get('appObject');
        var taskObject = results.get('taskObject');
        // app详情信息
        retObject.artworkUrl100 = hisappObject.get('artworkUrl100');
        retObject.trackName = hisappObject.get('trackName');
        retObject.sellerName = hisappObject.get('sellerName');
        retObject.appleKind = hisappObject.get('appleKind');
        retObject.appleId = hisappObject.get('appleId');
        retObject.formattedPrice = hisappObject.get('formattedPrice');
        retObject.latestReleaseDate = hisappObject.get('latestReleaseDate');
        retObject.excUniqueCode = hisappObject.get('excUniqueCode');
        retObject.version = hisappObject.get('version');
        retObject.userObjectId = Base64.encode(results.get('userObject').id);

        retObject.totalExcCount = results.get('receiveCount');
        retObject.expiredCount = results.get('expiredCount');
        retObject.excKinds = taskObject.get('taskType');
        retObject.taskObjectId = taskObject.id;

        // 需求截图数据
        retObject.taskType = taskObject.get('taskType');  //任务类型
        retObject.searchKeyword = taskObject.get('searchKeyword');  //搜索关键词
        retObject.ranKing = taskObject.get('ranKing'); // 排名

        retObject.Score = taskObject.get('Score');  // 评分
        retObject.titleKeyword = taskObject.get('titleKeyword'); // 标题关键词
        retObject.commentKeyword = taskObject.get('commentKeyword'); // 评论关键词
        retObject.needGet = taskObject.get('needGet'); // 是否需要获取
        retObject.registerStatus = taskObject.get('registerStatus'); // 第三方登陆
        retObject.needMoreReviewContent = taskObject.get('needMoreReviewContent'); // 评论是否超过50个字

        retObject.reviewMustTitleKey = taskObject.get('reviewMustTitleKey'); // 是否需要标题必选
        retObject.reviewMustContentKey = taskObject.get('reviewMustContentKey'); // 是否需要评论必选
        retObject.taskRemark = taskObject.get('detailRem'); // 备注详情

        if (taskObject.get('ranKing') <= 20){
            retObject.asoRank = 0;
        }
        else if (taskObject.get('ranKing') >= 21 && taskObject.get('ranKing') <= 50){
            retObject.asoRank = (taskObject.get('ranKing') / 10 - 2).toFixed(1);
        }
        else {
            retObject.asoRank = (3 + (taskObject.get('ranKing') - 50) * 0.5).toFixed(1);
        }

        retObject.rateUnitPrice = taskObject.get('rateUnitPrice'); // 汇率后的任务单价

        // 请求已经上交的数据
        var relation = results.relation('mackTask');
        var task_query = relation.query();
        task_query.ascending('createdAt');
        task_query.include('revokeObject');
        task_query.limit(1000);
        task_query.find().then(function(result){
            var mackTaskList = Array();
            for (var i = 0; i < result.length; i++){
                var mackTaskObject = Object();
                mackTaskObject.receiveTaskId = results.id;   //用于申诉
                mackTaskObject.mackTaskId = result[i].id;   //用于申诉
                mackTaskObject.uploadName = result[i].get('uploadName');
                mackTaskObject.taskImages = result[i].get('requirementImgs');
                mackTaskObject.detail = result[i].get('detail');  // 拒绝理由
                mackTaskObject.submitMsg = result[i].get('submitMsg');  // 提交留言

                var revokeObject = result[i].get('revokeObject');
                if(revokeObject != undefined){
                    mackTaskObject.revokeStatus = revokeObject.get('revokeStatus');  // 申诉处理结果
                    mackTaskObject.dealInfo = revokeObject.get('dealInfo');  // 申诉处理结果
                }

                //Error for
                mackTaskObject.status = result[i].get('taskStatus'); // 任务状态
                mackTaskObject.type = 'real';
                mackTaskList.push(mackTaskObject);
            }
            //未提交条目计算, 如果任务已经过期则不再推送假的Object
            retObject.tasksRemain = retObject.totalExcCount - mackTaskList.length - retObject.expiredCount;

            //初始假的Object
            for (var j = 0; j < retObject.tasksRemain; j++){
                var dummyObject = Object();
                dummyObject.type = 'dummy';
                mackTaskList.push(dummyObject);
            }
            res.json({'oneAppInfo':retObject, errorId:0, 'macTasks':mackTaskList})
        },function(error){
            res.json({'errorMsg':error.message, 'errorId': error.code});
        })
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});

// 新增 做内部做任务
router.post('/add/:excTaskId', function(req, res){
    var excTaskId = req.params.excTaskId;
    var requirementImgs = req.body.requirementImgs;
    var userUploadName = req.body.uploadName;

    //IP地址
    var clientIp = requestIp.getClientIp(req);
    //设备信息
    var source = req.headers['user-agent'];
    var ua = userAgent.parse(source);

    if(requirementImgs == undefined || requirementImgs.length == 0){
        res.json({'errorMsg':'上传图片失败', 'errorId': -3});
        return;
    }

    var task_query = new AV.Query(receiveTaskObject);
    task_query.include('taskObject');
    task_query.include('appObject');
    task_query.include('userObject');
    task_query.include('taskObject.userObject');
    task_query.get(excTaskId).then(function(receiveTaskObject){
            var taskObject = receiveTaskObject.get('taskObject');
            var relation = receiveTaskObject.relation('mackTask');
            var receiveCount = receiveTaskObject.get('receiveCount');
            var userObject = receiveTaskObject.get('userObject');
            var expiredCount = receiveTaskObject.get('expiredCount');
            var releaseTaskUserObject = receiveTaskObject.get('taskObject').get('userObject');
            //var qq = releaseTaskUserObject.get('userQQ');
            var query = relation.query();
            query.notEqualTo('taskStatus', 'expired');
            query.include('revokeObject');
            query.find().then(function(results){

                var uploadDoTaskObject = undefined;

                for (var dj = 0; dj < results.length; dj++){
                    var doTaskObject = results[dj];
                    if(doTaskObject.get('uploadName') == userUploadName){
                        uploadDoTaskObject = doTaskObject;
                        break;
                    }
                }

                //这边必须不包含过期条目,因为expiredCount已经包含了
                if((results.length + expiredCount) >= receiveCount && uploadDoTaskObject == undefined){
                    //任务已经做满,不能重新再上传
                    res.json({'errorMsg':'参与任务者已满,若想重新提交截图,请使用之前提交截图用户的昵称', 'uploadName':userUploadName, 'errorId': -200});
                }else {
                    if(uploadDoTaskObject == undefined){
                        //new task
                        //add task imgs
                        var newTaskObject = new mackTaskInfo();
                        newTaskObject.set('uploadName', userUploadName);
                        newTaskObject.set('requirementImgs', requirementImgs);
                        newTaskObject.set('taskStatus', 'uploaded');
                        newTaskObject.set('receiveTaskObject', receiveTaskObject);
                        newTaskObject.set('doTaskUser', userObject);
                        newTaskObject.set('releaseTaskObject', receiveTaskObject.get('taskObject'));
                        newTaskObject.set('releaseTaskUser', releaseTaskUserObject);
                        //new app object
                        var appObject = receiveTaskObject.get('appObject');
                        newTaskObject.set('appObject', receiveTaskObject.get('appObject'));

                        //设备信息
                        newTaskObject.set('IP', clientIp);
                        newTaskObject.set('Browser', ua.browser);
                        newTaskObject.set('OS', ua.os);
                        newTaskObject.set('Platform', ua.platform);
                        newTaskObject.set('Version', ua.version);

                        //ASO记录信息(new)
                        newTaskObject.set('asoKey', taskObject.get('searchKeyword'));
                        newTaskObject.set('appleId', appObject.get('appleId'));

                        newTaskObject.save().then(function(){
                            var relation = receiveTaskObject.relation('mackTask');
                            relation.add(newTaskObject);// 建立针对每一个 Todo 的 Relation
                            receiveTaskObject.increment('receiveRemainCount', -1);
                            receiveTaskObject.save().then(function(){
                                //发送邮件
                                //submissionNotification(qq);

                                //每日任务
                                var myDate = new Date();
                                var taskDate = receiveTaskObject.createdAt;
                                //需要当天的任务才可以
                                if(myDate.getDay() == taskDate.getDay()) {
                                    if (myDate.getHours() < 16 || (myDate.getHours() == 16 && myDate.getMinutes() < 31)) {
                                        util.dayTaskIncrement(userObject.id, 'doTaskY', 1);
                                    }
                                }

                                var needSaveUserObjects = Array();
                                //新做的任务
                                if(userObject.get('registerBonus') == 'register_new'){
                                    userObject.set('registerBonus', 'register_upload_task');
                                    needSaveUserObjects.push(userObject);
                                }

                                if(needSaveUserObjects.length > 0){
                                    AV.Object.saveAll(needSaveUserObjects).then(function(){
                                        res.json({'errorId':0, 'errorMsg':'', 'uploadName':userUploadName, 'requirementImgs':requirementImgs, 'mackTaskId':newTaskObject.id});
                                    }, function(err){
                                        console.error('----- invite add YB failed ', err.message);
                                        res.json({'errorId':0, 'errorMsg':'', 'uploadName':userUploadName, 'requirementImgs':requirementImgs, 'mackTaskId':newTaskObject.id});
                                    });
                                }else {
                                    res.json({'errorId':0, 'errorMsg':'', 'uploadName':userUploadName, 'requirementImgs':requirementImgs, 'mackTaskId':newTaskObject.id});
                                }
                            }, function (error) {
                                //更新任务失败
                                console.error('upload task img failed(save relation):' + taskStatus + ' error:' + error.message);
                                res.json({'errorMsg':error.message, 'uploadName':userUploadName,  'errorId': error.code});
                            });
                        }, function (error) {
                            //更新任务失败
                            console.error('upload task img failed(save task):' + taskStatus + ' error:' + error.message);
                            res.json({'errorMsg':error.message, 'uploadName':userUploadName, 'errorId': error.code});
                        });
                    }else {
                        //该用户已经做过任务,想重新传图
                        var taskStatus = uploadDoTaskObject.get('taskStatus');
                        if (taskStatus == 'accepted' || taskStatus == 'systemAccepted'){
                            //任务已经完成,无需再做
                            res.json({'errorMsg':'任务已经完成喽', 'errorId': -100});
                        }else if (taskStatus == 'refused' && uploadDoTaskObject.get('canRedo') == 0) {
                            res.json({'errorMsg':'任务失败,无法重做了', 'errorId': -101});
                        }else if (taskStatus == 'expired') {
                            res.json({'errorMsg':'任务已经超时过期', 'errorId': -101});
                        }else {
                            //自己重新提交,或者被决绝后重新做任务
                            //销毁以往图片
                            var images = uploadDoTaskObject.get('requirementImgs');
                            var query_file = new AV.Query(File);
                            query_file.containedIn('url', images);
                            query_file.find().then(function(imgResults){
                                for (var e = 0; e < imgResults.length; e++){
                                    imgResults[e].destroy().then(function(){
                                        //remove success
                                    })
                                }
                            });

                            var revokeObject = uploadDoTaskObject.get();
                            if(revokeObject != undefined){
                                revokeObject.set('revokeStatus', 'revokeFailed');
                                revokeObject.save();
                            }
                            uploadDoTaskObject.unset('revokeObject');

                            uploadDoTaskObject.set('requirementImgs', requirementImgs);

                            //设备信息
                            uploadDoTaskObject.set('IP', clientIp);
                            uploadDoTaskObject.set('Browser', ua.browser);
                            uploadDoTaskObject.set('OS', ua.os);
                            uploadDoTaskObject.set('Platform', ua.platform);
                            uploadDoTaskObject.set('Version', ua.version);

                            //区分 自己提交和 拒绝后提交
                            if (taskStatus == 'refused' || taskStatus == 'reUploaded'){
                                uploadDoTaskObject.set('taskStatus', 'reUploaded');
                            }else {
                                uploadDoTaskObject.set('taskStatus', 'uploaded');
                            }
                            uploadDoTaskObject.save().then(function(){
                                //发送邮件
                                //console.log("runned");
                                //submissionNotification(qq);

                                res.cookie('uploadImgName', userUploadName);
                                res.json({'errorId':0, 'errorMsg':'', 'uploadName':userUploadName, 'requirementImgs':requirementImgs});
                            }, function (error) {
                                //更新任务失败
                                console.error('reUpload task img failed(save task):' + taskStatus + ' error:' + error.message);
                                res.json({'errorMsg':error.message, 'uploadName':userUploadName, 'errorId': error.code});
                            });
                        }
                    }
                }

            });
        },
        function (error){
            console.error('upload task img failed(task object error):', error.message);
            res.json({'errorMsg':error.message, 'errorId': error.code, 'uploadName':userUploadName});
        })
});

// 提交留言
router.post('/submitMsg', function(req, res){

    var submitMsg = req.body.submitMsg;
    var mackTaskId = req.body.mackTaskId;

    var mackTaskObject = new mackTaskInfo();
    mackTaskObject.id = mackTaskId;

    mackTaskObject.set('submitMsg', submitMsg);
    mackTaskObject.save().then(function () {
        res.json({'errorMsg':'', 'errorId': 0});
    }, function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});


//申诉相关
router.get('/manager/revoke', function(req, res){
    res.render('revoke');
});

//提交申诉
router.post('/revoke', function(req, res) {
    var userId = util.useridInReq(req);

    if(userId == undefined){
        res.json({'errorMsg':'请先登陆账号', 'errorId': -100});
        return;
    }

    var receiveTaskId = req.body.receiveTaskId;
    var mackTaskId = req.body.mackTaskId;
    var revokeReason = req.body.revokeReason;

    var mackTaskObject = new mackTaskInfo();
    mackTaskObject.id = mackTaskId;

    var revokeQuery = new AV.Query(revokeTaskSQL);
    revokeQuery.equalTo('mackTask', mackTaskObject);
    revokeQuery.equalTo('revokeStatus', 'revokeUploaded');
    revokeQuery.find().then(function(datas){
        if(datas.length == 0){

            var receTaskObject = new receiveTaskObject();
            receTaskObject.id = receiveTaskId;
            var userObject = new User();
            userObject.id = userId;

            var revokeObject = new revokeTaskSQL();
            revokeObject.set('doTaskUser', userObject);
            revokeObject.set('revokeReason', revokeReason);
            revokeObject.set('mackTask', mackTaskObject);
            revokeObject.set('receiveTaskObject', receTaskObject);
            //revokeSucceed
            //revokeFailed
            revokeObject.set('revokeStatus', 'revokeUploaded');

            revokeObject.save().then(function(data){
                //绑定到任务
                //leancloud bug
                mackTaskObject.set('revokeObject', AV.Object.createWithoutData("revokeTaskObject", data.id));
                mackTaskObject.save().then(function(){
                    res.json({'errorMsg':'申诉成功', 'errorId': 0});
                },function(error){
                    res.json({'errorMsg':error.message, 'errorId': error.code});
                });
            }, function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            })
        }else {
            res.json({'errorMsg':'申诉成功', 'errorId': 0});
        }
    }, function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});

//申诉列表接口
router.get('/manager/revokeTaskList', function(req, res) {
    var userId = util.useridInReq(req);

    //var canSeeRevokeUserIds = ['579f13f8128fe1005442bea2', '579db33979bc4400547d6683', '57a81d392e958a0066aacfb4', '57c77ecc7db2a2007879fe31', '57e27a49a0bb9f0058b97544']
    //canSeeRevokeUserIds = canSeeRevokeUserIds.concat(['57e277e0bf22ec00582c9ab6', '57e27ba3a0bb9f0058b9853d', '57e2773c0e3dd90069898320']);
    //
    //if(util.indexInList(userId, canSeeRevokeUserIds) == -1){
    //    res.json({'errorMsg':'请先登陆管理员账号', 'errorId': -100, 'revokeMackList':[]});
    //    return;
    //}

    var query = new AV.Query(User);
    query.get(userId).then(function(userObject){
        if (userObject.get('isSellerChannel') == 'yangyang'){
            var revokeQuery = new AV.Query(revokeTaskSQL);
            revokeQuery.equalTo('revokeStatus', 'revokeUploaded');
            revokeQuery.include('mackTask');
            //revokeQuery.include('receiveTaskObject');
            revokeQuery.include('doTaskUser');
            revokeQuery.descending('createdAt');
            revokeQuery.find().then(function(datas){
                var revokeMackList = [];

                for (var i = 0; i < datas.length; i++){
                    var revokeDic = Object();

                    var revokeObject = datas[i];
                    revokeDic.revokeId = revokeObject.id;
                    var doTaskUser = revokeObject.get('doTaskUser');
                    var receiveTaskObject = revokeObject.get('receiveTaskObject');
                    var mackTask = revokeObject.get('mackTask');

                    //用户(手机号,昵称)
                    revokeDic.doTaskUserPhone = doTaskUser.get('username');
                    revokeDic.doTaskUserName = doTaskUser.get('userNickname');

                    //查看任务详情
                    //http://localhost:3000/interiorExcDetail/57e38780bf22ec00585081e6
                    revokeDic.receiveTaskId = receiveTaskObject.id;

                    //截图
                    revokeDic.mackId  = mackTask.id;
                    revokeDic.taskImgs = mackTask.get('requirementImgs');

                    //拒绝理由
                    revokeDic.refusedReason = mackTask.get('detail');

                    //申诉理由
                    revokeDic.revokeReason = revokeObject.get('revokeReason');
                    revokeDic.revokeStatus = revokeObject.get('revokeStatus');

                    revokeMackList.push(revokeDic);
                }

                res.json({'errorMsg':'', 'errorId': 0, 'revokeMackList':revokeMackList});
            }, function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
        }
        else {
            res.json({'errorMsg':'请先登陆管理员账号', 'errorId': -100});
        }
    }, function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});

//申诉失败
router.post('/manager/revokeFailed', function(req, res) {
    var userId = util.useridInReq(req);
    if(userId == undefined){
        res.json({'errorMsg':'请登陆管理员账号', 'errorId': -100});
        return;
    }

    //var receiveTaskId = req.body.receiveTaskId;
    var revokeId = req.body.revokeId;
    //官方处理意见
    var dealInfo = req.body.dealInfo;

    var revokeQuery = new AV.Query(revokeTaskSQL);
    //revokeQuery.include('mackTask');
    //revokeQuery.include('receiveTaskObject');
    //revokeQuery.include('doTaskUser');
    revokeQuery.get(revokeId).then(function(revokeObject){
        var doTaskUser = revokeObject.get('doTaskUser');
        var receiveTaskObject = revokeObject.get('receiveTaskObject');
        var mackTask = revokeObject.get('mackTask');

        var userObject = new User();
        userObject.id = userId;

        revokeObject.set('dealUser', userObject);
        revokeObject.set('revokeStatus', 'revokeFailed');
        revokeObject.set('dealInfo', dealInfo);

        AV.Object.saveAll([revokeObject]).then(function(){
            res.json({'errorMsg':'', 'errorId': 0});
        }, function(error){
            res.json({'errorMsg':error.message, 'errorId': error.code});
        });

    }, function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });
});

module.exports = router;