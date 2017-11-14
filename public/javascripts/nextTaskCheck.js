/**
 * Created by cailong on 2016/10/8.
 */

var app=angular.module('yemaWebApp',[]);
var navIndex = 4;

app.controller('nextTaskCheckCtrl', function($scope, $http, $location) {

    //拒绝理由
    $scope.refusedReasons = [];
    $scope.customRefusedReason == undefined;
    $scope.refusedReasons.push({'des':'任务设备错误 或 为无卡机', 'canRedo':false});
    $scope.refusedReasons.push({'des':'任务截图和他人重复', 'canRedo':false});
    $scope.refusedReasons.push({'des':'下错APP 或 少图 或 传错图片', 'canRedo':true});
    $scope.refusedReasons.push({'des':'同一台手机任务图提交多次任务', 'canRedo':false});
    $scope.refusedReasons.push({'des':'图二 未跳过引导页', 'canRedo':true});
    //$scope.refusedReasons.push({'des':'图一 搜索关键词错误()', 'canRedo':false});

    var refusedEntry;
    $scope.refusedClick = function (entry) {
        refusedEntry = entry;
    };

    var refusedReasonIndex = undefined;
    $scope.checkRefusedReason = function () {
        refusedReasonIndex = parseInt($scope.selectReason);
    };

    $scope.selectRefusedReason = function () {

        if($scope.customRefusedReason != undefined && $scope.customRefusedReason.length > 0){
            $scope.userCustomRefuseReason();
        }else {
            var refusedObject = $scope.refusedReasons[refusedReasonIndex];
            //$scope.refusedReasons.splice(refusedReasonIndex, 1);
            //$scope.refusedReasons.unshift(refusedObject);

            $scope.reject(refusedObject.des, refusedObject.canRedo);
        }
    };

    $scope.userCustomRefuseReason = function () {
        var refusedObject = {};
        refusedObject.des = $scope.customRefusedReason;
        $scope.refusedReasons.unshift(refusedObject);

        $scope.reject($scope.customRefusedReason, refusedObject.canRedo);
    };

    //*******************初始化 *************************
    $scope.isLoadingMyApp = true;
    $scope.currentTaskId = undefined;
    $scope.noApp = false;
    $scope.myObj = Object();

    var appurlList = $location.absUrl().split('/');
    var taskObjectId = appurlList[appurlList.length - 1];

    //**************任务完成详情*******************
    $scope.getTaskImgs = function(taskType) {
        $scope.isLoadingMyApp = true;
        $scope.app = undefined;
        $scope.taskType = taskType;
        var taskUrl = '/nextTaskCheck/taskAudit/' + taskObjectId + '/' + taskType;
        $http.get(taskUrl).success(function(response){
            $scope.isLoadingMyApp = false;
            $scope.app = response.app;

            $scope.refusedReasons.unshift({'des':'图一 搜索关键词错误(应该为:' + $scope.app.searchKeyword + ')', 'canRedo':false});

            if($scope.app.registerStatus == 'third'){
                $scope.refusedReasons.unshift({'des':'图二 未第三方登录', 'canRedo':true});
            }

            if($scope.app.needGet == true){
                $scope.refusedReasons.unshift({'des':'非首次下载App：图一无获取按钮', 'canRedo':false});
            }

            if($scope.app.taskType == '评论'){
                $scope.refusedReasons.push({'des':'没有先打开App试玩, 再评论', 'canRedo':true});
                $scope.refusedReasons.push({'des':'图三 未隐藏键盘', 'canRedo':true});
                $scope.refusedReasons.push({'des':'图三 评星错误', 'canRedo':true});
                $scope.refusedReasons.push({'des':'图三 评论标题或评论内容 字数不足', 'canRedo':true});
                $scope.refusedReasons.push({'des':'图三 领取的是多条任务，但未用流量评论', 'canRedo':true});
            }

            if($scope.app.reviewMustTitleKey != undefined && $scope.app.reviewMustTitleKey.length > 0){
                $scope.refusedReasons.push({'des':'图三 评论标题未含必选词', 'canRedo':true});
            }

            if($scope.app.reviewMustContentKey != undefined && $scope.app.reviewMustContentKey.length > 0){
                $scope.refusedReasons.push({'des':'图三 评论内容未含必选词', 'canRedo':true});
            }

            if($scope.app.statusHistory != undefined && $scope.app.statusHistory.length > 0){
                if($scope.app.statusHistory.indexOf('refused') >= 0){
                    $scope.refusedReasons.push({'des':'屡次被拒绝后重复提交（但未正确的去重做任务）', 'canRedo':false});
                }
            }


            var maxDisplayTask = 20;
            if(taskType == 'uploaded'){
                maxDisplayTask = 100;
            }

            if($scope.app.submissions.length > maxDisplayTask){
                toastr.info('任务过多，最多显示' + maxDisplayTask + '个任务，操作成功后，刷新页面显示剩下的任务(批量下载会下载全部的任务图片');
                $scope.displaySubmissions = $scope.app.submissions.slice(0, maxDisplayTask);
            }else {
                $scope.displaySubmissions = $scope.app.submissions;
            }
        });
    };

    $scope.getTaskImgs('uploaded');

    //*****************确认接收***************************

    var acceptLock = 0;
    $scope.accept = function(entry){
        if(acceptLock == 1){
            return;
        }
        acceptLock = 1;
        var entryId = entry.id;
        var url = '/nextTaskCheck/accept/' + entryId;
        $http.post(url).success(function(response){
            acceptLock = 0;
            if(response.errorId == 0){
                entry.status = 'accepted';
                toastr.success('接受任务成功,棒棒哒', {timeOut: 2000});
            }else {
                toastr.error(response.errorMsg);
            }
            //specTaskCheck($scope.currentTaskId);
        })

    };

    //显示关闭已通过
    $scope.fadeit = true ;
    $scope.showTask=function() {
        $scope.fadeit = false ;
    };


    $scope.showTask1=function() {
        $scope.fadeit = true ;
    };

    //默认弹出闭合

    $scope.checkText = function () {
        if ($scope.myObj.rejectReason.length > 20 && $scope.myObj.userCustom != undefined) {
            $scope.myObj.rejectReason = $scope.myObj.rejectReason.substr(0,20);
        }
    };

    //*****************拒绝接收****************************
    $scope.reject = function(refusedReason, formalRedo){
        var entryId = refusedEntry.id;
        $scope.required = false;
        if(refusedReason.length > 0){

            var url = '/nextTaskCheck/reject/' + entryId;
            var reject_reason = {'refusedReason': refusedReason, 'formalRedo':formalRedo};
            $http.post(url, reject_reason).success(function(response){

                if(response.errorId == 0){
                    $("#rejectReasonModel").modal("hide");
                    $scope.customRefusedReason = "";
                    refusedEntry.status = 'refused';
                    toastr.success('拒绝成功', {timeOut: 2000});
                }else {
                    toastr.error(response.errorMsg);
                }

            });
        }else {
            $scope.required = true;
        }
    };


    $scope.addApp=function(id) {
        $('#'+ id).popover("toggle");
    };


    //下载任务截图

    //Front-end file-zip and download demo using jszip

    //using canvas to convert image files to base64string
    function convertFilesToBase64String(src, name, callback, outputFormat) {
        var img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function() {
            console.log('---- onload ' + ' ' + src);
            var canvas = document.createElement('CANVAS');
            var ctx = canvas.getContext('2d');
            var dataURL;
            canvas.height = this.height;
            canvas.width = this.width;
            ctx.drawImage(this, 0, 0);
            dataURL = canvas.toDataURL(outputFormat);
            callback(name, dataURL);
        };
        if (img.complete || img.complete === undefined) {
            console.log('---- complete ' + ' ' + src);
            img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
            img.src = src;
        }
        img.src = src;
        // console.log('***** ' + src + 'convertFilesToBase64String ');
    }

    var downloadLock = false;

    function createZip(imgArrays) {
        var zip = new JSZip();
        var img = zip.folder("截图");
        for (var i = 0; i < imgArrays.length; i++) {
            var imgObject = imgArrays[i];
            img.file(imgObject.name, imgObject.dataUrl.substr(imgObject.dataUrl.indexOf(',')+1), {base64: true});
        }
        zip.generateAsync({type:"blob"})
            .then(function(content) {
                // see FileSaver.js
                downloadLock = false;
                $scope.downloadProgress = 0;
                saveAs(content, $scope.app.trackName.substring(0, 5) + '_' + $scope.app.searchKeyword + ".zip");
            });
    }

    $scope.downloadProgress = 0;
    $scope.downloadImgs = function(){
        if($scope.taskType != 'accepted' && $scope.taskType != 'uploaded'){
            toastr.error('暂时只提供 已经提交/审核通过 的图片下载');
            return;
        }

        if (downloadLock == true){
            toastr.info('图片下载任务进行中，请耐心等待上一个任务完成');
            return;
        }

        downloadLock = true;

        var base64imgs = [];
        var totalImgs = 0;

        for (var jj = 0; jj < $scope.app.submissions.length; jj++) {
            var submission = $scope.app.submissions[jj];
            for (var kk = 0; kk < submission.entries.length; kk++) {
                var entry = submission.entries[kk];
                var imgs = entry.imgs;
                totalImgs += imgs.length;
            }
        }

        if (totalImgs > 50){
            toastr.info('开始下载' + totalImgs + '图片，大概需要' + parseInt(totalImgs/100*2.5) +'分钟');
        }

        var batchEntries = 50;

        var entriesLength = $scope.app.submissions.length;
        recursionDownloadImgs(0, $scope.app.submissions);

        function recursionDownloadImgs(start, submissions) {
            var batchCount = 0;
            var batchLockCount = 0;

            var qujian = (entriesLength - start > batchEntries ? batchEntries : entriesLength - start);
            for (var i = start; i < start + qujian; i++) {

                var submission = submissions[i];
                for (var j = 0; j < submission.entries.length; j++){
                    var entry = submission.entries[j];
                    var imgs = entry.imgs;
                    batchCount += imgs.length;

                    for (var k = 0; k < imgs.length; k++){
                        console.log('---- ' + k + ' ' + imgs[k]);
                        convertFilesToBase64String(imgs[k], entry.uploadName + '_'+ i + '__' + k, function(name, dataUrl){
                            var base64img = new Object();
                            base64img.dataUrl = dataUrl;
                            base64img.name = name + ".png";
                            base64imgs.push(base64img);

                            batchLockCount++;

                            $scope.downloadProgress = parseFloat(base64imgs.length / totalImgs).toFixed(3);
                            $scope.$apply();

                            console.log($scope.downloadProgress + ' ---- ' + batchLockCount + ' ' + batchCount);
                            if(batchCount == batchLockCount){
                                recursionDownloadImgs(start + qujian, $scope.app.submissions);
                            }

                            console.log('---- ' + base64imgs.length + ' ' + totalImgs);
                            if (base64imgs.length == totalImgs) {
                                toastr.info('图片下载成功，开始压缩图片');
                                createZip(base64imgs);
                            }
                        }, "png")
                    }

                }
            }
        }
    }
});
