/**
 * Created by cailong on 16/7/21.
 */
var app = angular.module('yemaWebApp', ['angularFileUpload']);
var navIndex = 3;

app.controller('MobControl', function($scope, $http, $location, FileUploader) {
    var appurlList = $location.absUrl().split('/');
    var excTaskId = appurlList[appurlList.length - 1];

    var claimUrl = '/newtaskMobile/claim' + '/' + excTaskId;

    if (window.localStorage) {
        $scope.uploadName = localStorage.getItem("uploadName");
    } else {
        $scope.uploadName = getCookie('uploadName');
    }

    //uploadName
    var claimParams = Object();
    if ($scope.uploadName != undefined && $scope.uploadName.length > 0) {
        $scope.normalBtnShow = 0;
        claimParams.uploadName = $scope.uploadName;
    } else {
        $scope.normalBtnShow = 1;
    }

    $http.post(claimUrl, claimParams).success(function (response) {
        $scope.oneAppInfo = response.oneAppInfo;

        $scope.images = response.macTask;

        if($scope.images != undefined && $scope.images.length > 0){
            $scope.uploadImgDes = '重新上传一份任务图片: ' + $scope.uploadName;
        }else {
            if ($scope.uploadName != undefined && $scope.uploadName.length > 0) {
                $scope.uploadImgDes = '上传一份任务图片(2-3张)' + $scope.uploadName;
            } else {
                $scope.uploadImgDes = '上传一份任务图片(2-3张)';
            }
        }
    });


    //upload file
    var uploader = $scope.uploader = new FileUploader({
        url: '/upload/img',
        queueLimit: 3
        //removeAfterUpload:true
    });

    uploader.filters.push({
        name: 'imageFilter',
        fn: function (item /*{File|FileLikeObject}*/, options) {
            var type = '|' + item.type.slice(item.type.lastIndexOf('/') + 1) + '|';
            return '|jpg|png|jpeg|'.indexOf(type) !== -1;
        }
    });

    $scope.deletFile = function () {
        $scope.imgError = 1;
        uploader.clearQueue();
    };

    var fileUrls = new Array();

    uploader.onAfterAddingFile = function (fileItem) {

    };

    uploader.onAfterAddingAll = function (addedFileItems) {
        $scope.errorId = 0;
        $scope.progressNum = 5;

        //递归函数 Fix Safari Bug 分辨率过大时有问题
        //blobToDataURI(addedFileItems, 0);


        uploader.uploadAll();
        console.info('onAfterAddingAll', addedFileItems);
    };

    uploader.onProgressAll = function (progress) {
        $scope.progressNum = progress*0.8 > 10 ? progress*0.8 : 10;
        console.info('onProgressAll', progress);
    };
    uploader.onSuccessItem = function (fileItem, response, status, headers) {
        console.info('onSuccessItem', fileItem, response, status, headers);
    };
    uploader.onErrorItem = function (fileItem, response, status, headers) {
        $scope.errorId = 1;
        $scope.errorMsg = '上传图片失败';
        console.info('onErrorItem', fileItem, response, status, headers);
    };
    uploader.onCancelItem = function (fileItem, response, status, headers) {
        console.info('onCancelItem', fileItem, response, status, headers);
    };

    uploader.onCompleteItem = function (fileItem, response, status, headers) {
        if(response.files != undefined && response.files.length > 0){
            fileUrls.push(response.files[0]);
            console.info('onCompleteItem', fileItem, response, status, headers);
        }else {
            $scope.errorId = -100;
            $scope.errorMsg = '一张或多张图片上传失败,刷新网页重新上传';
        }

    };
    uploader.onCompleteAll = function () {
        console.info('onCompleteAll');
        var Url = '/newtaskMobile/add/' + excTaskId;
        $scope.progressNum = 90;

        $http.post(Url, {
                'uploadName':$scope.uploadName,
                'requirementImgs': fileUrls
            })
            .success(function (response) {
                $scope.errorId = response.errorId;
                $scope.errorMsg = response.errorMsg;
                console.log($scope.errorId);
                console.log($scope.errorMsg);
                if($scope.errorId == 0){
                    $scope.images = response.requirementImgs;
                }

                $scope.oneAppInfo.uploadName = response.uploadName;
                $scope.progressNum = 0;

                uploader.clearQueue();
                fileUrls = Array();
            });
    };

    $scope.saveUploadName = function() {
        if ($scope.uploadName != undefined && $scope.uploadName.length > 0) {
            $scope.uploadNameError = '';
            $scope.normalBtnShow = 0;

            if (window.localStorage) {
                localStorage.setItem("uploadName", $scope.uploadName);
                console.log('save do task nickname succeed in localStorage', $scope.uploadName);
            } else {
                setCookie('uploadName', $scope.uploadName);
                console.log('save do task nickname succeed in cookie', $scope.uploadName);
            }
        }else {
            $scope.uploadNameError = '昵称不能为空';
        }
    };

    $scope.commitConfirm = function(){
        location.href='/myClaim/' + $scope.oneAppInfo.userObjectId;
    }

});