/**
 * Created by cailong on 16/7/21.
 */
'use strict';

var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

// var leanObjectRedis = require('../utils/leanObjectRedis');

//防作弊
var requestIp = require('request-ip');
var userAgent = require('express-useragent');

var Base64 = require('../public/javascripts/vendor/base64').Base64;

var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var IOSAppExcLogger = AV.Object.extend('IOSAppExcLogger');
var mackTaskInfo = AV.Object.extend('mackTaskInfo');
var releaseTaskObject = AV.Object.extend('releaseTaskObject');
var receiveTaskObject = AV.Object.extend('receiveTaskObject'); // 领取任务的库
var File = AV.Object.extend('_File');

var nodemailer = require('nodemailer');

// create reusable transporter object using the default SMTP transport
var transporter = nodemailer.createTransport("SMTP",{
    service: 'QQ',
    auth: {
        user: "719480449@qq.com", // 账号
        pass: "kabggqckzbuwbdgi" // 密码
    }
});

function submissionNotification(qq){
    if (qq == undefined){
        return;
    }
    else {
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
                res.json({'errorId': 1});
            }
            else{
                //console.log('Message sent: ' + info.response);
            }
        });
    }
}

router.get('/:userId', function(req, res) {
    res.render('pcAndMobTask');
});

// 内部交换
router.post('/claim/:excTaskId', function(req, res){
    var excTaskId = req.params.excTaskId;
    var uploadUserName = req.body.uploadName;

    var query = new AV.Query(receiveTaskObject);
    query.include('appObject');
    query.include('taskObject');
    query.include('userObject');
    query.get(excTaskId).then(function(resultObject){
        var retObject = Object();
        var hisappObject = resultObject.get('appObject');
        var taskInfo = resultObject.get('taskObject');

        // 获取App信息
        retObject.artworkUrl100 = hisappObject.get('artworkUrl100');
        retObject.trackName = hisappObject.get('trackName');
        retObject.sellerName = hisappObject.get('sellerName');
        retObject.appleKind = hisappObject.get('appleKind');
        retObject.appleId = hisappObject.get('appleId');
        retObject.formattedPrice = hisappObject.get('formattedPrice'); // 应用是否免费
        retObject.latestReleaseDate = hisappObject.get('latestReleaseDate');
        retObject.excUniqueCode = hisappObject.get('excUniqueCode');
        retObject.version = hisappObject.get('version');

        retObject.totalExcCount = resultObject.get('receiveCount');
        retObject.taskObjectId = taskInfo.id;
        retObject.userObjectId = Base64.encode(resultObject.get('userObject').id);

        // 需求截图数据
        retObject.taskType = taskInfo.get('taskType');  //任务类型
        retObject.searchKeyword = taskInfo.get('searchKeyword');  //搜索关键词
        retObject.ranKing = taskInfo.get('ranKing'); // 排名
        retObject.Score = taskInfo.get('Score');  // 评分
        retObject.titleKeyword = taskInfo.get('titleKeyword'); // 标题关键词
        retObject.commentKeyword = taskInfo.get('commentKeyword'); // 评论关键词
        retObject.needGet = taskInfo.get('needGet'); // 是否需要获取
        retObject.registerStatus = taskInfo.get('registerStatus'); // 第三方登陆
        retObject.needMoreReviewContent = taskInfo.get('needMoreReviewContent'); // 评论是否超过50个字

        retObject.reviewMustTitleKey = taskInfo.get('reviewMustTitleKey'); // 是否需要标题必选
        retObject.reviewMustContentKey = taskInfo.get('reviewMustContentKey'); // 是否需要评论必选
        retObject.taskRemark = taskInfo.get('detailRem'); // 备注详情

        if (taskInfo.get('ranKing') <= 20){
            retObject.asoRank = 0;
        }
        else if (taskInfo.get('ranKing') >= 21 && taskInfo.get('ranKing') <= 50){
            retObject.asoRank = (taskInfo.get('ranKing') / 10 - 2).toFixed(1);
        }

        else {
            retObject.asoRank = (3 + (taskInfo.get('ranKing') - 50) * 0.5).toFixed(1);
        }

        retObject.rateUnitPrice = taskInfo.get('rateUnitPrice'); // 汇率后的任务单价

        var relation = resultObject.relation('mackTask');
        var task_query = relation.query();
        task_query.notEqualTo('taskStatus', 'expired');
        task_query.find().then(function(result){
            var mackTaskList = Array();

            //remain 需要计算,并且不能取具体任务里过期的数目,过期的数目统一在 receive的 resultObject的expiredCount取
            retObject.surplusCount = resultObject.get('receiveCount') - resultObject.get('expiredCount') - result.length;

            for (var e = 0; e < result.length; e++){
                var uploadTaskName = result[e].get('uploadName');
                if (uploadTaskName == uploadUserName){
                    retObject.uploadName = uploadTaskName;
                    retObject.detail = result[e].get('detail');
                    var taskImages = result[e].get('requirementImgs');
                    for (var w = 0; w < taskImages.length; w++){
                        var taskImage = taskImages[w];
                        mackTaskList.push(taskImage);
                    }
                }
            }
            res.json({'oneAppInfo':retObject, 'macTask':mackTaskList})
        })
    })
});

// 新增 做内部做任务
router.post('/add/:excTaskId', function(req, res){
    //IP地址
    var clientIp = requestIp.getClientIp(req);
    //设备信息
    var source = req.headers['user-agent'];
    var ua = userAgent.parse(source);

    var excTaskId = req.params.excTaskId;
    var requirementImgs = req.body.requirementImgs;

    var userUploadName = undefined;
    //无cookie则是新用户
    var cookieUserUploadName = req.cookies.uploadImgName;
    var reqUserUploadName = req.body.uploadName;
    if (cookieUserUploadName != undefined && cookieUserUploadName.length > 0){
        userUploadName = cookieUserUploadName;
    }
    //不优先cookie存储
    if(reqUserUploadName != undefined && reqUserUploadName.length > 0) {
        userUploadName = reqUserUploadName;
    }

    if(userUploadName == undefined || userUploadName.length == 0){
        res.json({'errorMsg':'未填写昵称(任务需要知道是谁做的哦)', 'errorId': -2});
        return;
    }

    if(requirementImgs == undefined || requirementImgs.length == 0){
        res.json({'errorMsg':'未上传图片', 'errorId': -3});
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
            var appObject = receiveTaskObject.get('appObject');
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

                        //设备信息
                        newTaskObject.set('IP', clientIp);
                        newTaskObject.set('Browser', ua.browser);
                        newTaskObject.set('OS', ua.os);
                        newTaskObject.set('Platform', ua.platform);
                        newTaskObject.set('Version', ua.version);

                        //ASO记录信息(new)
                        newTaskObject.set('asoKey', taskObject.get('searchKeyword'));
                        newTaskObject.set('appleId', appObject.get('appleId'));

                        //if(qq != undefined){
                        //    newTaskObject.set('doTaskUserQQ', doTaskUserQQ);
                        //}
                        //做任务的人
                        newTaskObject.set('doTaskUser', userObject);
                        //发布任务的人
                        newTaskObject.set('releaseTaskObject', receiveTaskObject.get('taskObject'));
                        newTaskObject.set('releaseTaskUser', releaseTaskUserObject);

                        //new app object
                        newTaskObject.set('appObject', receiveTaskObject.get('appObject'));

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
                                    if (myDate.getHours() < 16 || (myDate.getHours() == 16 && myDate.getMinutes() < 31))
                                    {
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
                                        res.json({'errorId':0, 'errorMsg':'', 'uploadName':userUploadName, 'requirementImgs':requirementImgs});
                                    }, function(err){
                                        console.error('----- invite add YB failed, ', err.message);
                                        res.json({'errorId':0, 'errorMsg':'', 'uploadName':userUploadName, 'requirementImgs':requirementImgs});
                                    });
                                }else {
                                    res.json({'errorId':0, 'errorMsg':'', 'uploadName':userUploadName, 'requirementImgs':requirementImgs});
                                }
                            }, function (error) {
                                //更新任务失败
                                console.error('upload task img failed(save relation):' + taskStatus + 'error:' + error.message);
                                res.json({'errorMsg':error.message, 'uploadName':userUploadName,  'errorId': error.code});
                            });
                        }, function (error) {
                            //更新任务失败
                            console.error('upload task img failed(save task):' + taskStatus + 'error:' + error.message);
                            res.json({'errorMsg':error.message, 'uploadName':userUploadName, 'errorId': error.code});
                        });
                    }else {
                        //该用户已经做过任务,想重新传图
                        var taskStatus = uploadDoTaskObject.get('taskStatus');
                        if (taskStatus == 'accepted' || taskStatus == 'systemAccepted'){
                            //任务已经完成,无需再做
                            res.json({'errorMsg':'任务已经完成喽', 'errorId': -100});
                        }else if (taskStatus == 'expired') {
                            res.json({'errorMsg':'任务已经超时过期', 'errorId': -101});
                        }else if (taskStatus == 'refused' && uploadDoTaskObject.get('canRedo') == 0) {
                            res.json({'message':'任务失败,无法重做了', 'errorId': -101});
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

                            //处理申诉
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
                                //submissionNotification(qq);

                                res.cookie('uploadImgName', userUploadName);
                                res.json({'errorId':0, 'errorMsg':'', 'uploadName':userUploadName, 'requirementImgs':requirementImgs});
                            }, function (error) {
                                //更新任务失败
                                console.error('reUpload task img failed(save task):' + taskStatus + 'error:' + error.message);
                                res.json({'errorMsg':error.message, 'uploadName':userUploadName, 'errorId': error.code});
                            });
                        }
                    }
                }

            });
        },
        function (err){
            console.error('upload task img failed(task object error):' + taskStatus + 'error:' + err.message);
            res.json({'errorMsg':err.message, 'errorId': err.code, 'uploadName':userUploadName});
        })
});

module.exports = router;