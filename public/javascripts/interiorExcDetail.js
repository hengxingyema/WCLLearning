/**
 * Created by cailong on 16/7/21.
 */

var app = angular.module('yemaWebApp', []);
var navIndex = 3;

//angularFileUpload
//FileUploader

app.directive('onRepeatFinishedRender', function ($timeout) {
    return {
        restrict: 'A',
        link: function (scope, element, attr) {
            if (scope.$last === true) {
                $timeout(function () {
                    //这里element, 就是ng-repeat渲染的最后一个元素
                    scope.$emit('ngRepeatFinished', element);
                });
            }
        }
    };
});

app.controller('interorDetailControl', function($scope, $http, $location){
    var appurlList = $location.absUrl().split('/');
    var excTaskId = appurlList[appurlList.length - 1];

    var Url = 'interior' + '/' + excTaskId;
    var existTaskNum = 0;
    $http.get(Url).success(function(response){
        if(response.errorId == 0){
            $scope.oneAppInfo = response.oneAppInfo;

            for (var i = 0; i < response.macTasks.length; i++){
                // 翻译任务的状态
                if (response.macTasks[i].status == 'uploaded' || response.macTasks[i].status == 'reUploaded'){
                    existTaskNum++;
                    response.macTasks[i].status = '待审核';
                }else if (response.macTasks[i].status == 'rejected' || response.macTasks[i].status == "refused"){
                    existTaskNum++;
                    response.macTasks[i].status = '被拒绝';
                }else if (response.macTasks[i].status == 'accepted' || response.macTasks[i].status == 'systemAccepted'){
                    existTaskNum++;
                    response.macTasks[i].status = '已完成';
                }else if (response.macTasks[i].status == 'expired'){
                    //ignore this
                    //response.macTasks[i].status = '已过期';
                }else {
                    response.macTasks[i].status = '';
                }

                $scope.macTasks = response.macTasks;
            }

            //这个信息被用来給电脑批量上传的任务取名.
            $scope.nextTaskNum = ($scope.oneAppInfo.totalExcCount - $scope.oneAppInfo.tasksRemain) + 1;
        }
    });

    //提交申诉
    $scope.prepareRevoke = function (task) {
        $scope.revokedTask = task;
    };

    $scope.userSubmitRevoke = function(task, revokeReason, $event){
        var btn = $event.target;
        btn.disabled = true;

        var url = '/interiorExcDetail/revoke';

        $http.post(url, {
                'receiveTaskId': task.receiveTaskId,
                'mackTaskId': task.mackTaskId,
                'revokeReason':revokeReason
            })
            .success(function (response) {
                if(response.errorId == 0){
                    btn.disabled = false;
                    $("#myModal").modal('hide');
                    task.revokeStatus = 'revokeUploaded';
                    toastr.success('已提交申诉,野马客服会尽快处理', {timeOut: 2000});
                }else {
                    toastr.error('申诉失败,网络异常');
                }
            });
    }


    //*******************上传图片*********************
    //解析上传者姓名并且初始进度条
    $scope.prepareUploadImgs = function(task, reUploadIndex){

        //上传图片变得可用
        $('.fileupload').each(function (index) {
            if(reUploadIndex == index){
                console.log('file reUpload index:', index);
                $(this).fileupload('enable');
            }
        });

        task.isUploading = 0;

        //new design
        //任务状态设置为 可上传图片
        //更新任务状态 —— 拒绝流程
        task.revokeStatus = '';
        task.dealInfo = '';
        task.detail = '';
        //更新任务状态 —— 公共流程
        task.status = '';
        task.taskImages = [];
        //task.files = [];
    };

    $scope.$on("ngRepeatFinished", function (repeatFinishedEvent, element){
        //console.log('ngRepeatFinished on ', element);
        prepareUploadCtrol();

        //加载angular js 代码
        //var nodeHead = document.getElementsByTagName('head')[0];
        //var nodeScript = document.createElement('script');
        //nodeScript.setAttribute('type', 'text/javascript');
        //nodeScript.setAttribute('src', '/javascripts/vendor/jqueryFileUploader/js/jquery.fileupload-angular.js');
        //nodeHead.appendChild(nodeScript);

        $(document).bind('dragover', function (e)
        {
            var dropZone = $('.dropzone'),
                foundDropzone,
                timeout = window.dropZoneTimeout;
            if (!timeout)
            {
                dropZone.addClass('in');
            }
            else
            {
                clearTimeout(timeout);
            }
            var found = false,
                node = e.target;

            do{

                if ($(node).hasClass('dropzone'))
                {
                    found = true;
                    foundDropzone = $(node);
                    break;
                }

                node = node.parentNode;

            }while (node != null);

            dropZone.removeClass('in hover');

            if (found)
            {
                foundDropzone.addClass('hover');
            }

            window.dropZoneTimeout = setTimeout(function ()
            {
                window.dropZoneTimeout = null;
                dropZone.removeClass('in hover');
            }, 100);
        });
    });

    $scope.mackTaskId = undefined;

    $scope.uploadFiles = function (index, $event) {
        // business logic...
        var mackTask = $scope.macTasks[index];
        mackTask.isUploading = 1;
        if(mackTask.files == undefined || mackTask.files.length == 0){
            toastr.warning('请先选择图片');
            return;
        }

        $event.target.disabled = true;
        $event.target.innerText = '上传中';

        //TODO 图片格式检查问题(jpg, png, jpeg)

        $('.fileupload').each(function (fileUploadIndex) {

            if(fileUploadIndex == index){
                console.log('file uploading fileUploadIndex:', fileUploadIndex);
                var jqXHR = $(this).fileupload('send', {files: mackTask.files})
                    .success(function(result, textStatus, jqXHR){
                        var responseObject = $.parseJSON( jqXHR.responseText );
                        console.log('file uploading success:', responseObject);

                        var url = '/interiorExcDetail/add/' + excTaskId;
                        //TODO progress
                        mackTask.uploadProgress = 90;

                        var name = mackTask.uploadName;
                        if (name == undefined || name.length == 0){
                            name = '批量传图' + (existTaskNum + 1);
                        }

                        $http.post(url, {
                                'uploadName': name,
                                'requirementImgs': responseObject.files
                            })
                            .success(function (response) {
                                mackTask.uploadProgress = 100;
                                existTaskNum++;
                                if(response.errorId == 0){
                                    mackTask.status = '待审核';
                                    mackTask.taskImages = responseObject.files;
                                    toastr.success(responseObject.files.length + '张图片上传成功', {timeOut: 2000});

                                    mackTask.localTaskImgs = [];
                                    mackTask.files = [];

                                    $scope.mackTaskId = response.mackTaskId;


                                    $event.target.innerText = '上传成功';
                                }else {
                                    toastr.error('上传图片失败 : ' + response.errorMsg);

                                    $event.target.disabled = false;
                                    $event.target.innerText = '重新上传';
                                }
                            }).error(function(error){
                                toastr.error('上传图片失败 : ' + error.message);

                                $event.target.disabled = false;
                                $event.target.innerText = '重新上传';
                            });
                    })
                    .error(function (jqXHR, textStatus, errorThrown) {
                        mackTask.errorId = -1;
                        toastr.error('上传图片失败 : ' + errorThrown);
                        if (errorThrown === 'abort') {
                            alert('File Upload has been canceled');
                        }

                        $event.target.disabled = false;
                        $event.target.innerText = '重新上传';
                    })
                    .complete(function(result, textStatus, jqXHR){
                        console.log('file uploading complete:', jqXHR);
                        mackTask.isUploading = 0;
                        mackTask.uploadProgress = 0;
                    });

                //无取消上传
                //jqXHR.abort();
            }
        });
    };

    function cleanList(dealList){
        var retList = [];
        for(var i = 0; i < dealList.length; i++){
            if(retList.indexOf(dealList[i]) == -1){
                retList.push(dealList[i]);
            }
        }
        return retList;
    }

    function addFilesToScope(fileIndex, files){

        var maxFileNum;
        if($scope.oneAppInfo.excKinds == '下载'){
            maxFileNum = 3; //姑且是3吧,有人误做成换评
        }else if($scope.oneAppInfo.excKinds == '评论'){
            maxFileNum = 3;
        }else {
            maxFileNum = 5;
        }

        var innerScope = angular.element('.page-wrapper').scope();
        var mackTask = innerScope.macTasks[fileIndex];

        if(mackTask.status != ''){
            toastr.info('请先点击重新上传按钮');
            return;
        }

        if(mackTask.files == undefined){
            mackTask.files = files;
        }else {
            mackTask.files = mackTask.files.concat(files);
        }

        var fileLength = mackTask.files.length;
        if(fileLength > maxFileNum){
            for(var si = 0; si < fileLength - maxFileNum; si++){
                mackTask.files.shift();
            }
        }

        mackTask.localTaskImgs = [];
        for (var i = 0; i < mackTask.files.length; i++){
            var tempFile = mackTask.files[i];
            var reader = new FileReader();
            reader.onload = function (e) {
                if(mackTask.localTaskImgs == undefined){
                    mackTask.localTaskImgs = [];
                }
                mackTask.localTaskImgs.push(e.target.result);
                //console.log('------ remove repeat imgs start ', mackTask.localTaskImgs.length);
                //mackTask.localTaskImgs = cleanList(mackTask.localTaskImgs);
                //console.log('------ remove repeat imgs end ', mackTask.localTaskImgs.length);
                innerScope.$apply();
            };

            reader.readAsDataURL(tempFile);
        }
    }

    function prepareUploadCtrol(){
        //JQuery 上传图片
        //多个上传框

        $('.fileupload').each(function (index) {
            $(this).fileupload(
                {
                    dataType: 'json',
                    //maxFileSize: 999000,
                    //acceptFileTypes: /(\.|\/)(gif|jpe?g|png)$/i,

                    dropZone: $(this),

                    drop: function (e, data) {
                        //console.log('drop file upload sub index:', index);
                        addFilesToScope(index, data.files);
                    },

                    change: function (e, data) {
                        //console.log('select file upload sub index:', index);
                        addFilesToScope(index, data.files);
                    },

                    add: function (e, data) {
                        //console.log('file: ', data.originalFiles);

                        //data.context = $('<button/>').text('Upload')
                        //    .appendTo(document.body)
                        //    .click(function () {
                        //        data.context = $('<p/>').text('Uploading...').replaceAll($(this));
                        //        data.submit();
                        //    });
                    },

                    //显示文件名
                    done: function (e, data) {
                        //console.log((index + ' done fileupload '), e);
                        //console.log((index + ' done data '), data);

                        //$.each(data.result.files, function (subIndex, file) {
                            //$('<p/>').text(file.name).appendTo(document.body);

                            //data.context = $('<p/>').text('Uploading...').appendTo(document.body);
                            //data.submit();
                        //});
                    },

                    //显示进度条
                    progressall: function (e, data) {
                        var innerScope = angular.element('.page-wrapper').scope();
                        var progress = parseInt(data.loaded / data.total * 100, 10) * 0.9;

                        //console.log(index, ' ----******-------- progress index:', progress);
                        var mackTask = innerScope.macTasks[index];
                        mackTask.uploadProgress = progress;
                        innerScope.$apply();
                    }
            }
            );

            if($scope.macTasks[index].status == ''){
                $(this).fileupload('enable');
            }else {
                $(this).fileupload('disable');
            }
        });
    }

    //阻止系统事件
    $(document).bind('drop dragover', function (e) {
        e.preventDefault();
    });



    // 确认提交按钮
    $scope.commitConfirm = function(){
        location.href='/myClaim/' + $scope.oneAppInfo.userObjectId;
    };

    $scope.openNewPage = function(courseid){
        location.href = '/interiorExcDetail/' + courseid;
    };

    //重新填写备注
    $scope.reAssign = function(task){
        task.mode = true;
        console.log("changed");

    };

    // 提交留言
    $scope.submitMsg = function(submitMsg, mackTaskId, task){
        var submitMsgURL = '/interiorExcDetail/submitMsg';
        $scope.mackTaskID = '';
        if (mackTaskId == undefined){
            $scope.mackTaskID = $scope.mackTaskId;
        }else {
            $scope.mackTaskID = mackTaskId;
        }
        $http.post(submitMsgURL, {'submitMsg':submitMsg, 'mackTaskId':$scope.mackTaskID}).success(function(response){
            if (response.errorId == 0){
                toastr.success('留言成功', {timeOut: 2000});
                task.mode = false;
            }
            else {
                toastr.error('留言失败 : ' + response.errorMsg);
            }
        })
    }
});