/**
 * Created by wujiangwei on 2016/10/23.
 */

var AV = require('leanengine');

AV.Cloud.beforeUpdate('mackTaskInfo', function(request, response) {
    // console.log('hook for mackTaskInfo ', request.object.updatedKeys);
    if (request.object.updatedKeys != undefined && request.object.updatedKeys.indexOf('taskStatus') != -1) {
        //任务状态修改，方才进入 hook
        var newTaskStatus = request.object.get('taskStatus');
        // console.log('hook for mackTaskInfo newTaskStatus : ', newTaskStatus);
        // 保存状态变迁历史
        //TODO save status change time
        var statusHistory = request.object.get('statusHistory');
        if(statusHistory == undefined){
            //初始状态只能是这个
            statusHistory = ['uploaded'];
            if(newTaskStatus != 'uploaded' && newTaskStatus != 'accepted' && newTaskStatus != 'systemAccepted'){
                //uploaded -----> accepted : not record
                //uploaded -----> systemAccepted : not record
                // request.object.updatedKeys.push('statusHistory');
                statusHistory.push(newTaskStatus);
                request.object.set('statusHistory', statusHistory);
                // console.log('hook for mackTaskInfo set : ', statusHistory);
                request.object.save().then(function () {
                    // console.log('hook for mackTaskInfo save succeed');
                }, function (error) {
                    console.error('hook for mackTaskInfo save error : ', error.message);
                });
            }
        }else {
            // request.object.updatedKeys.push('statusHistory');
            statusHistory.push(newTaskStatus);
            request.object.set('statusHistory', statusHistory);
            // console.log('hook for mackTaskInfo set : ', statusHistory);
            request.object.save().then(function () {
                // console.log('hook for mackTaskInfo save succeed');
            }, function (error) {
                console.error('hook for mackTaskInfo save error : ', error.message);
            });
        }

        //用户信誉系统
        var yemaDoTaskUserObject = request.object.get('doTaskUser');
        var yemaReleaseTaskUserObject = request.object.get('releaseTaskUser');
        if(yemaDoTaskUserObject != undefined){
            var reputation = yemaDoTaskUserObject.get('reputation');
            // console.log('已经做过任务的用户+++++++' + reputation);
            if(reputation == undefined){
                //User中增加任务信誉（100）
                yemaDoTaskUserObject.set('reputation', 100);
            }
            if(newTaskStatus == 'refused' || newTaskStatus == 'doneRefused'){
                //任务被拒绝 信誉-1
                yemaDoTaskUserObject.increment('reputation', -5);
                // console.log(yemaDoTaskUserObject.id + ' hook for mackTaskInfo set (reputation:任务被拒绝) : ', yemaDoTaskUserObject.get('reputation'));
                yemaDoTaskUserObject.save();
            }else if(newTaskStatus == 'expired'){
                //每成功完成一个任务信誉+1
                yemaDoTaskUserObject.increment('reputation', -5);
                yemaDoTaskUserObject.save();
            }else if(newTaskStatus == 'accepted'){
                //每成功完成一个任务信誉+1
                yemaDoTaskUserObject.increment('reputation', 1);
                yemaDoTaskUserObject.save();
            }
        }

        if(yemaReleaseTaskUserObject != undefined){
            var reputation = yemaReleaseTaskUserObject.get('reputation');
            // console.log('已经做过任务的用户---------' + reputation);
            if(reputation == undefined){
                //User中增加任务信誉（100）
                yemaReleaseTaskUserObject.set('reputation', 100);
                yemaReleaseTaskUserObject.save();
            }else {
                if(newTaskStatus == 'refused' || newTaskStatus == 'doneRefused' || newTaskStatus == 'accepted'){
                    //审核一个任务信誉+1（手动审核）
                    yemaReleaseTaskUserObject.increment('reputation', 1);
                    // console.log(yemaReleaseTaskUserObject.id + ' hook for mackTaskInfo set release task user (reputation:refused/accepted) : ', yemaDoTaskUserObject.get('reputation'));
                    yemaReleaseTaskUserObject.save();
                }
            }

        }
    }

    // 保存到数据库中
    response.success();
});

AV.Cloud.beforeUpdate('_User', function(request, response) {
    //用户信誉系统，最多100信誉
    if (request.object.updatedKeys != undefined && request.object.updatedKeys.indexOf('reputation') != -1) {
        var reputation = request.object.get('reputation');
        // console.log(request.object.id + 'hook for user : ', reputation);
        if (reputation > 100) {
            request.object.set('reputation', 100);
        } else {
            // 不保存数据，并返回错误
            // response.error('No comment!');
        }
    }

    // 保存到数据库中
    response.success();
});