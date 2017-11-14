
//user code
var gUserCId;
var gUserCode;
var interval = 1000;

var isHelperInstalled = 0;

function getUserCode()
{
    if (window.localStorage) {
        gUserCId = localStorage.getItem("userCId");
        gUserCode = localStorage.getItem("userCode");
    } else {
        gUserCId = getCookie('userCId');
        gUserCode = getCookie("userCode");
    }
}

function saveUserCode(userCId, userCode) {
    if (window.localStorage) {
        try {
            localStorage.setItem("userCId", userCId);
            localStorage.setItem("userCode", userCode);
        }
        catch (e) {
            alert('无痕模式无法正常使用小马哦,点击【Safari工具栏右下角】按钮后,再点【新工具栏击左下角】按钮，从而关闭无痕模式');
            return;
        }
    } else {
        setCookie("userCId", userCId);
        setCookie("userCode", userCode);
    }
    gUserCId = userCId;
    gUserCode = userCode;
}

////小助手URL http://127.0.0.1:8888
function appGetUserInfo(httpModule) {
    isHelperInstalled = getCookie('isHelperInstalled');
    if(isHelperInstalled == 1){
        return;
    }

    var helperTipBox = undefined;
    //跨域访问！！
    var appUserUrl = 'http://127.0.0.1:8888/user?userCId=' + gUserCId + '&userCode=' + gUserCode + '&callback=JSON_CALLBACK';
    httpModule.jsonp(appUserUrl)
        .success(function(response){
            // 小助手取到信息后自动返回
            // 判断是否需要自动打开小助手？
            // 1小时超时
            setCookie('isHelperInstalled', 1, 0.042);
            isHelperInstalled = 1;
            saveUserCode(response.userCId, response.userCode);

            if(helperTipBox != undefined){
                //小助手已经检测到了打开
                TipBox.prototype.destroy();
                helperTipBox.destroy();
                helperTipBox.config.setTime && typeof helperTipBox.config.callBack === "function" && helperTipBox.config.callBack();
            }

        })
        .error(function (error) {

            isHelperInstalled = 0;
            setCookie('isHelperInstalled', 0, 0.042);

            //helperTipBox = new TipBox({type:'assistant', str:'未检测到激活助手，请打开助手', hasBtn:true});

            TipBox.prototype.openAssistant = function(){
                window.location.href = "xiaomaHelper://";
            };

            //离开浏览器
            //window.addEventListener( 'focus', function() {
            //    location.reload();
            //} );
        });
}

angular.module('starter.controllers', ['angularFileUpload'])
.controller('homeController', function($scope, $http, $location, $ionicPopup, $timeout, $ionicLoading) {

    //是否是被邀请的
    var homeUrlList = $location.absUrl().split('/');
    var inviteCode = homeUrlList[homeUrlList.length - 1];

    getUserCode();

    appGetUserInfo($http);

    //banner
    var bannerURL = '/taskUser/banner';
    $http.get(bannerURL).success(function(response){
        $scope.bannerUrl = response.bannerUrl;
    });

    // 用户审核详情数
    var userAuditCountURL = '/taskUser/userAuditCount';
    $http.post(userAuditCountURL, {'gUserCId':gUserCId}).success(function(response){
        if (response.errorId == 0){
            $scope.userAuditCount = response.userAuditCount;
        }
    });

    //设备判定
    $scope.isIOSDevice = 0;
    $scope.isAndroidDevice = 0;
    if(/(iPhone|iPad|iPod|iOS|MacIntel|Macintosh)/i.test(navigator.userAgent)){
        $scope.isIOSDevice = 1;
    }else if(/android/i.test(navigator.userAgent)){
        $scope.isAndroidDevice = 1;
    }

    $scope.isQQBrowser = 0;
    $scope.isWeixinBrowser = 0;
    $scope.isiPhoneSafari = 0;
    if($scope.isAndroid || $scope.isIOSDevice){
        if(/QQ/i.test(navigator.userAgent)){
            $scope.isQQBrowser = 1;
        }else if(/MicroMessenger/i.test(navigator.userAgent)){
            $scope.isWeixinBrowser = 1;
        }else if(/Safari/i.test(navigator.userAgent)){
            $scope.isiPhoneSafari = 1;
        }
    }

    //alert(navigator.platform);
    //alert(navigator.userAgent);
    if($scope.isIOSDevice == 1 && $scope.isiPhoneSafari == 1){

        $ionicLoading.show();

        try{
            localStorage.setItem("testSafariMode", 'xiaomaTest');
        }
        catch(e) {
            $ionicLoading.hide();
            //alert(e);
            alert('无痕模式无法正常使用小马哦,点击右下角后,再点击左下角关闭无痕模式');
            return;
        }

        $scope.refreshHome = function(isRefresh) {
            var userInfoUrl = '/taskUser/' + gUserCId + '/' + inviteCode;
            $http.get(userInfoUrl)
                .success(function (response) {
                    //alert( 'errorId ' + response.errorId + ' userCode ' + response.userCode + ' masterCode ' + response.masterCode);
                    if (response.errorId == 0) {
                        //succeed
                        saveUserCode(response.userInfoObject.userCId, response.userInfoObject.userCode);

                        if(inviteCode != 'home' && inviteCode != 'himselfApprentice' && inviteCode != 'qrCode'){
                            $scope.inviteUrl = $location.absUrl().substring(0, $location.absUrl().length - inviteCode.length - 1) + '/' + response.userInfoObject.userCode;
                        }
                        else if (inviteCode == 'himselfApprentice' || inviteCode == 'qrCode'){
                            $scope.inviteUrl = $location.absUrl().substring(0, $location.absUrl().length - inviteCode.length - 2) + response.userInfoObject.userCode;
                        }
                        else {
                            $scope.inviteUrl = $location.absUrl() + '/' + response.userInfoObject.userCode;
                        }

                        $scope.userInfoObject = response.userInfoObject;
                        $scope.masterConfig = response.masterConfig;

                        if (inviteCode == 'himselfApprentice' || inviteCode == 'qrCode'){
                            $scope.Url = $location.absUrl().substring(0, $location.absUrl().length - inviteCode.length - 2) + response.userInfoObject.userCode;
                        }
                        else {
                            $scope.Url = $location.absUrl().substring(0, $location.absUrl().length - inviteCode.length - 1) + '/' + response.userInfoObject.userCode;
                        }
                        // 二维码生成
                        jQuery('#qrcode').qrcode({width: 80,height: 80,correctLevel:0,text: $scope.Url});

                        jQuery('#qrcodeA').qrcode({width: 100,height: 100,correctLevel:0,text: $scope.Url});
                    } else {
                        $scope.errorId = response.errorId;
                        $scope.message = response.message;
                    }
                })
                .finally(function () {
                    // Stop the ion-refresher from spinning
                    $ionicLoading.hide();
                    if (isRefresh == 1) {
                        $scope.$broadcast('scroll.refreshComplete');
                    }
                });
        };

        $scope.onlod = function(){

        };

        $scope.refreshHome(0);

        //拜师提交不存在弹出窗
        $scope.showAlert = function() {
            var myPopup = $ionicPopup.show({
                title: '师傅的邀请码错误',
            });

            $timeout(function() {
                myPopup.close(); //由于某种原因3秒后关闭弹出
            }, 1000);
        };


        //点击复制
        $scope.copyUrl = function(){
            //var Url2 = document.getElementById("inviteUrlcopy");
            //Url2.select(); // 选择对象

            var div = document.getElementById('my_div_id');
            if (document.selection) {
                // for IE
                var r = document.body.createTextRange();
                r.moveToElementText(div);
                r.moveEnd("character");
                r.select();
            } else {
                // For others
                var s = window.getSelection();
                var d = document.createRange();
                d.selectNode(div);
                s.addRange(d);
                document.execCommand("Copy"); // 执行浏览器复制命令
                alert("已复制好，可贴粘。");
                s.removeAllRanges();
            }
        };

        //拜师(绑定邀请码接口)
        var bindLock =  0;
        $scope.ctrlScope = $scope;
        $scope.bindMaster = function(){
            if(bindLock == 1 || $scope.ctrlScope.inputMasterCode == undefined || $scope.ctrlScope.inputMasterCode.length == 0){
                return;
            }
            var bindUrl = '/taskUser/bindMaster';
            var bindParams = {'userCode' : $scope.userInfoObject.userCode, 'masterCode' : $scope.ctrlScope.inputMasterCode};
            bindLock = 1;
            $ionicLoading.show();
            $http.post(bindUrl, bindParams).success(function(response){
                $ionicLoading.hide();
                bindLock = 0;
                if(response.errorId == 0){
                    $scope.masterCode = $scope.ctrlScope.inputMasterCode;
                }else {
                    $scope.showAlert();
                    //error note
                }
            });
        };

        //推广大使
        $scope.becomeMaketingPeople = function () {
            var bindUrl = '/taskUser/becomeMarketingUser';
            var bindParams = {'userCId' : $scope.userInfoObject.userCId};
            $ionicLoading.show();
            $http.post(bindUrl, bindParams).success(function(response){
                $ionicLoading.hide();
                bindLock = 0;
                if(response.errorId == 0){
                    $scope.errorId = response.errorId;
                    toastr.success('成功成为推广大使');
                }else {
                    toastr.error(response.message);
                    $scope.showAlertError(response.message);
                    //error note
                }
            });
        };

        //test select
        $scope.unselectUrl = function(){
            try {
                //var inviteEle = document.getElementById("inviteEle");
                //alert(inviteEle);
                //inviteEle.select();
                document.execCommand('Unselect');
            }catch (e){
                alert(e);
            }
        };
    }
})

//快速任务
.controller('quickTaskController', function($scope, $rootScope, $http, $location, $ionicFilterBar, $timeout, $ionicLoading) {

    getUserCode();

    appGetUserInfo($http);

    var pageCount = 20;

    $rootScope.commentTasks = [];

    $rootScope.commentloadHasMore = false;

    //isMore 1(load more) 0(refresh) -1(button click)
    $scope.switchTaskType = function (isMore) {
        var tasksUrl;
        if($rootScope.commentTasks.length > 0 && isMore == -1){
            return;
        }
        if(isMore == 0) {
            //refresh
            tasksUrl = '/quickTaskHall/' + gUserCId + '/' + 0;
        }else {
            if($rootScope.commentTasks == undefined || $rootScope.commentTasks.length == 0){
                $ionicLoading.show();
            }
            tasksUrl = '/quickTaskHall/' + gUserCId + '/' + $rootScope.commentTasks.length / pageCount;
            $ionicLoading.hide();
        }
        $rootScope.commentLoading = true;

        if(tasksUrl == undefined){
            console.error('tasksUrl == undefined');
            return;
        }

        $http.get(tasksUrl)
            .success(function (response) {
                if(response.errorId == 0){
                    //succeed
                    if(response.quickTaskArray.length > 0){
                        if(response.quickTaskArray.length == pageCount) {
                            $rootScope.commentHasMore = true;
                        }else {
                            $rootScope.commentHasMore = false;
                        }
                        if(isMore == 0){
                            //refresh
                            $rootScope.commentTasks = [];
                        }
                        $rootScope.commentTasks = $rootScope.commentTasks.concat(response.quickTaskArray);
                    }else {
                        $rootScope.commentHasMore = false;
                    }
                }else {
                    $scope.errorId = response.errorId;
                    $scope.message = response.message;
                }
            })
            .finally(function() {
                $ionicLoading.hide();
                // Stop the ion-refresher from spinning

                if(isMore == 1){
                    $scope.$broadcast('scroll.infiniteScrollComplete');
                }
                if(isMore == 0){
                    $scope.$broadcast('scroll.refreshComplete');
                }

                $timeout(function() {
                    if($rootScope.commentTasks.length > 0 && $rootScope.commentTasks.length % pageCount == 0){
                        $rootScope.commentloadHasMore = true;
                    }else {
                        $rootScope.commentloadHasMore = false;
                    }
                }, 1000);
            });
    };

    $scope.switchTaskType(-1);

    // 今日已经完成和进行中的任务
    var completeTaskUrl = '/quickTaskHall/' + gUserCId;
    $http.get(completeTaskUrl).success(function(response){
        if (response.errorId == 0){
            $rootScope.completeTasks = response.completeTasks;
            $rootScope.ongoingTaskArray = response.ongoingTaskArray;
        }
    });

    $scope.getTheTask = function(clickTask){
        if ($rootScope.ongoingTaskArray.length > 0){
            alert('不能同时抢多个任务哦!请先完成进行中的任务')
        }
        else {
            window.location.href = '#/quickTaskHall/quick/' + clickTask;
        }
    };

    // 即将开始的任务
    var aboutToStartUrl = '/quickTaskHall/aboutToStart';
    $http.post(aboutToStartUrl).success(function(response){
        if (response.errorId == 0){
            $scope.aboutToStartTaskArray = response.aboutToStartTaskObjectArray;
            $scope.predictGetMoney = response.predictGetMoney;
        }
    });

    $scope.aboutToStartTask = function(){
        new TipBox({type:'await',str:'亲,别急',string:'该任务还没开始哦!', setTime:1500, hasBtn:true});
    }

})

// 快速任务详情
.controller('quickTaskDetailController', function($rootScope, $scope, $ionicActionSheet,$http, $location, FileUploader,
                                                  $ionicPopup, $interval, $timeout, $ionicLoading,$ionicModal){
    getUserCode();

    appGetUserInfo($http);

    $scope.lockTaskId = undefined;

    var taskDetailTimer;

    var appurlList = $location.absUrl().split('/');
    var taskId = appurlList[appurlList.length - 1];

    // 任务详情
    var quickTaskUrl = '/quickTaskHall/quick/' + gUserCId + '/' + taskId;
    $scope.loading = true;
    //$ionicLoading.show();
    $http.get(quickTaskUrl).success(function(response){
        $scope.loading = false;
        $scope.taskDetail = response.taskDetail;
        if (response.errorId == 0){
            $scope.taskDetail = response.taskDetail;

            $scope.lockTaskId = response.taskDetail.lockTaskId;
            $scope.dataStatus = 1;

            $scope.tempTaskMaxTime = response.taskDetail.tempTaskMaxTime;

            if($scope.lockTaskId != undefined){
                taskDetailTimer = $interval(function(){
                    var now = new Date();
                    var taskTimerStr = $scope.taskDetail.doTaskCreatedAt.replace(/-/g,"/");
                    var taskDate = new Date(taskTimerStr);

                    var leftTime;
                    leftTime = $scope.tempTaskMaxTime - (now.getTime() - taskDate.getTime());

                    if(leftTime < 0){
                        if(taskDetailTimer != undefined){
                            $interval.cancel(taskDetailTimer);
                            taskDetailTimer = undefined;
                        }
                        return;
                    }

                    var leftSecond = parseInt(leftTime / 1000);
                    //var day = Math.floor(leftSecond / daySeconds);
                    leftSecond = leftSecond % (60 * 60 * 24);
                    var hour = Math.floor(leftSecond / 3600);
                    leftSecond = leftSecond % 3600;
                    var minute = Math.floor(leftSecond / 60);
                    leftSecond = leftSecond % 60;
                    var second = leftSecond;

                    $scope.countDownStr = (hour > 0 ? (hour + ":") : '') + (minute > 0 ? (minute + ":") : '')  + second;


                }, interval);
            }
            else {
                getTheTask();
            }
        }
    });

    // 放弃任务弹框
    $("#tip").click(function(){
        new TipBox({type:'tip',str:'确认要放弃任务吗?',hasBtn:true});
    });

    // 放弃任务
    TipBox.prototype.giveUpTask = function(){
        giveUpTheTask();
        TipBox.prototype.destroy();
        this.destroy();
        this.config.setTime && typeof this.config.callBack === "function" && this.config.callBack();
    };

    var unlocklock = 0;
    function giveUpTheTask(){
        if(unlocklock == 1 || $scope.lockTaskId == undefined){
            return;
        }
        unlocklock = 1;
        $ionicLoading.show();
        var lockTaskUrl = '/quickTaskHall/unlockTask';
        var lockParam = {'userCId' : gUserCId, 'lockTaskId' : $scope.lockTaskId};
        $http.post(lockTaskUrl, lockParam).success(function(response){
                unlocklock = 0;
                if(taskDetailTimer != undefined){
                    $interval.cancel(taskDetailTimer);
                    taskDetailTimer = undefined;
                }

                if(response.errorId == 0){
                    $scope.lockTaskId = undefined;
                    javascript:history.go(-1);
                }
            })
            .finally(function(){
                $ionicLoading.hide();
            });
    }

    // KJDKD
    var locklock = 0;
    function getTheTask(){
        if(locklock == 1){
            return;
        }
        locklock = 1;
        $ionicLoading.show();
        var lockTaskUrl = '/quickTaskHall/lockTask';
        var lockParam = {'userCId' : gUserCId, 'taskId' : taskId};
        $http.post(lockTaskUrl, lockParam).success(function(response){
            locklock = 0;
            if(response.errorId == 0){
                $scope.lockTaskId = response.lockTaskId;
                $scope.doTaskCreatedAt = response.doTaskCreatedAt;
                $scope.progressNum = 0;

                //倒计时
                if(taskDetailTimer != undefined){
                    $interval.cancel(taskDetailTimer);
                    //taskDetailTimer = undefined;
                }

                taskDetailTimer = $interval(function(){
                    var now = new Date();
                    var taskTimerStr = $scope.doTaskCreatedAt.replace(/-/g,"/");
                    var taskDate = new Date(taskTimerStr);
                    var leftTime = $scope.tempTaskMaxTime - (now.getTime() - taskDate.getTime());

                    if(leftTime < 0){
                        if(taskDetailTimer != undefined){
                            $interval.cancel(taskDetailTimer);
                            taskDetailTimer = undefined;
                        }
                        return;
                    }

                    var leftSecond = parseInt(leftTime / 1000);
                    //var day = Math.floor(leftSecond / daySeconds);
                    leftSecond = leftSecond % (60 * 60 * 24);
                    var hour = Math.floor(leftSecond / 3600);
                    leftSecond = leftSecond % 3600;
                    var minute = Math.floor(leftSecond / 60);
                    leftSecond = leftSecond % 60;
                    var second = leftSecond;

                    $scope.countDownStr = (hour > 0 ? (hour + ":") : '') +
                        (minute > 0 ? (minute + ":") : '')  + second;

                }, interval);
                //倒计时结束
            }else {

                if (response.errorId <= -100){
                    var myPopup = $ionicPopup.show({
                        title: response.message,
                        buttons: [
                            {text: '确定'}
                        ]
                    });
                }else {
                    var myPopup = $ionicPopup.show({
                        title: response.message,
                    });

                    $timeout(function() {
                        myPopup.close(); //由于某种原因3秒后关闭弹出
                    }, 1500);
                }
            }
        }).finally(function(){
            $ionicLoading.hide();
        });
    }

    // 跳转App Store
    $scope.goAppStore = function(){
        location.href = 'https://itunes.apple.com/cn/search?mt=8#'
    };

    $scope.openAppObject = Object();

    // 打开应用
    $scope.openedApp = function(openedAppId){
        var openAppUrl = 'http://127.0.0.1:8888/checkAndOpenApp?openBundleId=' + openedAppId + '&callback=JSON_CALLBACK';
        $http.jsonp(openAppUrl)
            .success(function(response){
                if(response.isOpened == true){
                    //TODO 应用成功打开
                }else {
                    //TODO 应用未安装/打开成功
                }
            })
            .error(function (error) {
                //always error
            });
        window.location.href = "xiaomaHelper://";
    };

    // 领取奖励
    //TODO 自己去服务器检查存在否
    $scope.getTheRewards = function(taskObject){
        console.log('taskId:' + $scope.openAppObject.taskId);
        var getRewardsUrl = '/jifenqiangApi/getJifenqiangMoney';
        $http.post(getRewardsUrl, {'userCId':gUserCId, 'taskId':$scope.openAppObject.taskId, 'taskObject':taskObject}).success(function(response){
            if (response.errorId == 0){
                new TipBox({type:'confirm',str:'恭喜! 任务完成!',string:'完成任务《' + taskObject.searchKeyword + '》',
                    price:taskObject.temUserUnitPrice + '元',setTime:18000000,hasBtn:true});

                TipBox.prototype.continueToMakeMoney = function(){
                    javascript:history.go(-1);
                    TipBox.prototype.destroy();
                    this.destroy();
                    this.config.setTime && typeof this.config.callBack === "function" && this.config.callBack();
                }

            }
            else {
                new TipBox({type:'error',str:response.errorMsg,setTime:10000500,hasBtn:true});

                // 打开App
                TipBox.prototype.reopenApp = function(){
                    $scope.openedApp(taskObject.taskId);
                    TipBox.prototype.destroy();
                    this.destroy();
                    this.config.setTime && typeof this.config.callBack === "function" && this.config.callBack();
                };
            }
        })
    }

})

// 截图任务详情
.controller('TaskDetailController', function($rootScope, $scope, $ionicActionSheet,$http, $location, FileUploader,
                                             $ionicPopup, $interval, $timeout, $ionicLoading,$ionicModal) {
    getUserCode();

    var appurlList = $location.absUrl().split('/');
    var taskId = appurlList[appurlList.length - 1];

    $scope.lockTaskId = undefined;
    $scope.dataStatus = 0;

    var taskDetailTimer;

    //例图
    $scope.showAle = function() {
        $scope.bigImage = true;
    };
    $scope.bigImage = false;    //初始默认大图是隐藏的
    $scope.hideBigImage = function () {
        $scope.bigImage = false;
    };


    $scope.showAle1 = function() {
        $scope.bigImage1 = true;
    };
    $scope.bigImage1 = false;    //初始默认大图是隐藏的
    $scope.hideBigImage1 = function () {
        $scope.bigImage1 = false;
    };

    $scope.showAle3=function(index){
        $scope.imgshow=true;
        $scope.img_index=index;
    };
    $scope.imgshow=false;
    $scope.imghidden=function(){
        $scope.imgshow=false;
    };

    $scope.showAle2 = function() {
        $scope.bigImage2 = true;
    };
    $scope.bigImage2 = false;    //初始默认大图是隐藏的
    $scope.hideBigImage2 = function () {
        $scope.bigImage2 = false;
    };
    //excise

    //下载和评论的图片宽度不一样
    $scope.setwidth=function(taskType){
        var widthnew ;
        if(taskType =='下载'){
            widthnew = 45+'%';

        }
        else if(taskType =='评论' || taskType == '定制评论'){
            widthnew = 30+'%';
        }
        return{"width":widthnew};
    };

    $scope.setwidth1=function(){
        var length=$scope.taskDetail.doTaskImgs.length;
        var widthnew1;
        if(length==2){
            widthnew1=45+'%';

        }
        else if(length==3){
            widthnew1=30+'%';
        }
        return{"width":widthnew1};
    };
    //任务操作
    //newTaskStatus  增加任务,做完任务,放弃任务
    //未完成

    $rootScope.statusDes = '';
    function refreshMyTaskStatus(newTaskStatus){

        if($rootScope.retList != undefined){
            //未进入过 我的任务界面,无需修改
            var pointerMyTask;
            var pointerIndex;
            for (var i = 0; i < $rootScope.retList.length; i++){
                var myTask = $rootScope.retList[i];
                if(myTask.taskId == taskId){
                    pointerMyTask = myTask;
                    pointerIndex = i;
                }
            }

            //放弃任务
            if(newTaskStatus == '放弃任务' && pointerIndex != undefined){
                $rootScope.retList.splice(pointerIndex, 1);
            }
            //做完了任务
            //领取任务
            else{
                if(pointerMyTask == undefined){
                    var myTaskObject = Object();
                    myTaskObject.appIcon = $scope.taskDetail.appIcon;
                    myTaskObject.appName = $scope.taskDetail.appName;
                    myTaskObject.doTaskPrice = $scope.taskDetail.doTaskPrice;
                    myTaskObject.remainCount = $scope.taskDetail.remainCount;
                    myTaskObject.taskId = taskId;

                    myTaskObject.statusDes = newTaskStatus;
                    myTaskObject.createdAt = $scope.doTaskCreatedAt;
                    $rootScope.retList.unshift(myTaskObject);
                }else {
                    pointerMyTask.statusDes = newTaskStatus;
                }
            }
        }

        if($rootScope.ongoingScreenTaskArray != undefined){
            var pointerMyTaskA;
            var pointerIndexA;
            for (var e = 0; e < $rootScope.ongoingScreenTaskArray.length; e++){
                var myTaskA = $rootScope.ongoingScreenTaskArray[e];
                if(myTaskA.taskId == taskId){
                    pointerMyTaskA = myTaskA;
                    pointerIndexA = e;
                }
            }

            //放弃任务
            if(newTaskStatus == '放弃任务' && pointerIndexA != undefined){
                $rootScope.ongoingScreenTaskArray.splice(pointerIndexA, 1);
            }
            //做完了任务
            //领取任务
            else{
                if(pointerMyTask == undefined){
                    var myTaskObjects = Object();
                    myTaskObjects.appIcon = $scope.taskDetail.appIcon;
                    myTaskObjects.appName = $scope.taskDetail.appName;
                    myTaskObjects.doTaskPrice = $scope.taskDetail.doTaskPrice;
                    myTaskObjects.remainCount = $scope.taskDetail.remainCount;
                    myTaskObjects.searchKeyword = $scope.taskDetail.screenShotOne.searchKeyword;
                    myTaskObjects.taskId = taskId;

                    myTaskObjects.statusDes = newTaskStatus;
                    myTaskObjects.createdAt = $scope.doTaskCreatedAt;
                    $rootScope.ongoingScreenTaskArray.unshift(myTaskObjects);
                    $rootScope.commentScreenTasks.splice(pointerIndexA, 1);
                }else {
                    pointerMyTask.statusDes = newTaskStatus;
                }
            }
        }
    }

    //获取任务详情
    var tasksUrl = '/taskHall/' + gUserCId + '/' + taskId;
    $scope.loading = true;
    $ionicLoading.show();
    $scope.userSpecialNeeds = '';
    $http.get(tasksUrl).success(function (response) {
        $scope.loading = false;
        if(response.errorId == 0){
            //succeed
            $scope.taskDetail = response.taskDetail;
            $scope.lockTaskId = response.taskDetail.lockTaskId;
            $scope.dataStatus = 1;

            $scope.tempTaskMaxTime = response.taskDetail.tempTaskMaxTime;

            var toastTask = '';

            if(response.taskDetail.specialNeeds != undefined){
                for (var i= 0; i < response.taskDetail.specialNeeds.length; i++){
                    $scope.userSpecialNeeds = response.taskDetail.specialNeeds[i]
                }
            }

            if($scope.taskDetail.screenShotOne.needGet == true){
                toastTask += '该任务需要首次下载' + '<br>';
            }
            if($scope.taskDetail.screenShotTwo.registerStatus == 'third'){
                toastTask += '该任务需要第三方登陆' + '<br>';
            }
            if($scope.taskDetail.screenShotThird.needMoreReviewContent == true){
                toastTask += '该任务需要超长评论' + '<br>';
            }
            if ($scope.userSpecialNeeds.AppleID == 'on'){
                toastTask += '该任务需要填写Apple ID' + '<br>';
            }
            if ($scope.userSpecialNeeds.userNickName == 'on'){
                toastTask += '该任务需要填写用户昵称' + '<br>';
            }
            if ($scope.userSpecialNeeds.weChat == 'on'){
                toastTask += '该任务需要填写微信号' + '<br>';
            }

            if(toastTask.length > 1){
                $ionicPopup.confirm({
                    title: '特殊任务要求提示',
                    template: toastTask
                });
            }


            if($scope.lockTaskId != undefined){
                //任务已经领取
                if(taskDetailTimer != undefined){
                    $interval.cancel(taskDetailTimer);
                    taskDetailTimer = undefined;
                }
                if($scope.taskDetail.doTaskStatus != 'uploaded'){
                    //做任务倒计时
                    taskDetailTimer = $interval(function(){
                        var now = new Date();
                        var taskTimerStr = $scope.taskDetail.doTaskCreatedAt.replace(/-/g,"/");
                        var taskDate = new Date(taskTimerStr);
                        //TODO 被拒绝任务的倒计时应该是第二天10点前
                        var leftTime;
                        if($scope.taskDetail.doTaskStatus == 'refused'){
                            var nextDay = new Date(now.getTime() + 24*60*60*1000);
                            nextDay.setHours(9);    //10点
                            nextDay.setMinutes(0);
                            nextDay.setSeconds(0);
                            nextDay.setMilliseconds(0);
                            leftTime = nextDay.getTime() - now.getTime();
                        }else {
                            leftTime = $scope.tempTaskMaxTime - (now.getTime() - taskDate.getTime());
                        }

                        if(leftTime < 0){
                            if(taskDetailTimer != undefined){
                                $interval.cancel(taskDetailTimer);
                                taskDetailTimer = undefined;
                            }
                            return;
                        }

                        if($scope.taskDetail.doTaskStatus == ''){
                            if(taskDetailTimer != undefined){
                                $interval.cancel(taskDetailTimer);
                                taskDetailTimer = undefined;
                            }
                            return;
                        }

                        var leftSecond = parseInt(leftTime / 1000);
                        //var day = Math.floor(leftSecond / daySeconds);
                        leftSecond = leftSecond % (60 * 60 * 24);
                        var hour = Math.floor(leftSecond / 3600);
                        leftSecond = leftSecond % 3600;
                        var minute = Math.floor(leftSecond / 60);
                        leftSecond = leftSecond % 60;
                        var second = leftSecond;

                        $scope.countDownStr = (hour > 0 ? (hour + ":") : '') +
                            (minute > 0 ? (minute + ":") : '')  + second;
                        if($scope.taskDetail.doTaskStatus == 'uploaded' || $scope.taskDetail.doTaskStatus == 'reUploaded' || $scope.taskDetail.doTaskStatus == 'refused'){
                            $scope.uploadButtonTitle = '重新上传' + $scope.taskPicCount + '张任务截图  ';
                        }else {
                            $scope.uploadButtonTitle = '上传' + $scope.taskPicCount + '张任务截图  ';
                        }

                    }, interval);
                }

                //倒计时结束

                $scope.taskPicCount = response.taskDetail.taskPicCount;
                $scope.progressNum = 0;

                if($scope.taskDetail.doTaskStatus == 'uploaded' || $scope.taskDetail.doTaskStatus == 'reUploaded' || $scope.taskDetail.doTaskStatus == 'refused'){
                    $scope.uploadButtonTitle = '重新上传' + $scope.taskPicCount + '张任务截图';
                }else {
                    $scope.uploadButtonTitle = '上传' + $scope.taskPicCount + '张任务截图';
                }

                if(response.taskDetail.doTaskStatus == 'refused'){
                    $scope.errorId = -1;
                    $scope.errorMsg = response.taskDetail.refusedReason;
                }
            }
            else {
                getTheTask();
            }
        }else {
            $scope.errorId = response.errorId;
            $scope.message = response.message;
        }
    })
    .finally(function(){
        $ionicLoading.hide();
    });

    // 领取任务
    var locklock = 0;
    function getTheTask(){
        if(locklock == 1){
            return;
        }
        locklock = 1;
        $ionicLoading.show();
        var lockTaskUrl = '/taskHall/lockTask';
        var lockParam = {'userCId' : gUserCId, 'taskId' : taskId};
        $http.post(lockTaskUrl, lockParam).success(function(response){
            locklock = 0;
            if(response.errorId == 0){
                $scope.lockTaskId = response.lockTaskId;
                $scope.doTaskCreatedAt = response.doTaskCreatedAt;
                $scope.taskPicCount = response.taskPicCount;
                $scope.taskDetail = response.taskDetail;
                $scope.uploadButtonTitle = '上传' + $scope.taskPicCount + '张任务截图' ;
                $scope.progressNum = 0;

                refreshMyTaskStatus('未完成');

                //倒计时
                if(taskDetailTimer != undefined){
                    $interval.cancel(taskDetailTimer);
                    //taskDetailTimer = undefined;
                }

                taskDetailTimer = $interval(function(){
                    var now = new Date();
                    var taskTimerStr = $scope.doTaskCreatedAt.replace(/-/g,"/");
                    var taskDate = new Date(taskTimerStr);
                    var leftTime = $scope.tempTaskMaxTime - (now.getTime() - taskDate.getTime());

                    if(leftTime < 0){
                        if(taskDetailTimer != undefined){
                            $interval.cancel(taskDetailTimer);
                            taskDetailTimer = undefined;
                        }
                        return;
                    }

                    var leftSecond = parseInt(leftTime / 1000);
                    //var day = Math.floor(leftSecond / daySeconds);
                    leftSecond = leftSecond % (60 * 60 * 24);
                    var hour = Math.floor(leftSecond / 3600);
                    leftSecond = leftSecond % 3600;
                    var minute = Math.floor(leftSecond / 60);
                    leftSecond = leftSecond % 60;
                    var second = leftSecond;

                    $scope.countDownStr = (hour > 0 ? (hour + ":") : '') +
                        (minute > 0 ? (minute + ":") : '')  + second;

                    if($scope.taskDetail.doTaskStatus == 'uploaded' || $scope.taskDetail.doTaskStatus == 'reUploaded' || $scope.taskDetail.doTaskStatus == 'refused'){
                        $scope.uploadButtonTitle = '重新上传' + $scope.taskPicCount + '张任务截图 ';
                    }else {
                        $scope.uploadButtonTitle = '上传' + $scope.taskPicCount + '张任务截图 ';
                    }

                }, interval);
                //倒计时结束
            }else {

                if (response.errorId <= -100){
                    var myPopup = $ionicPopup.show({
                        title: response.message,
                        buttons: [
                            {text: '确定'}
                        ]
                    });
                }else {
                    var myPopup = $ionicPopup.show({
                        title: response.message,
                    });

                    $timeout(function() {
                        myPopup.close(); //由于某种原因3秒后关闭弹出
                    }, 1500);
                }
            }
        }).finally(function(){
            $ionicLoading.hide();
        });
    }

    var homeUrlList = $location.absUrl().split('/');
    var judgeType = homeUrlList[homeUrlList.length - 2];

    // 放弃任务弹框
    $("#tip").click(function(){
        if (judgeType == 'printScreenTask' || (judgeType == 'myTask' && $scope.taskDetail.doTaskStatus == undefined)){
            new TipBox({type:'tip',str:'确认要放弃任务吗?',setTime:10000500,hasBtn:true});
        }
        else {
            javascript:history.go(-1);
        }
    });

    // 放弃任务
    TipBox.prototype.giveUpTask = function(){
        giveUpTheTask();
        TipBox.prototype.destroy();
        this.destroy();
        this.config.setTime && typeof this.config.callBack === "function" && this.config.callBack();
    };

    var unlocklock = 0;
    function giveUpTheTask(){
        if(unlocklock == 1 || $scope.lockTaskId == undefined){
            return;
        }
        unlocklock = 1;
        $ionicLoading.show();
        var lockTaskUrl = '/taskHall/unlockTask';
        var lockParam = {'userCId' : gUserCId, 'lockTaskId' : $scope.lockTaskId};
        $http.post(lockTaskUrl, lockParam).success(function(response){
            unlocklock = 0;
            if(taskDetailTimer != undefined){
                $interval.cancel(taskDetailTimer);
                taskDetailTimer = undefined;
            }

            if(response.errorId == 0){
                $scope.lockTaskId = undefined;
                refreshMyTaskStatus('放弃任务');
                javascript:history.go(-1);
            }
        })
            .finally(function(){
                $ionicLoading.hide();
            });
    }

    //点击复制标题
    $scope.copyTitleKeyword = function(type){
        if (type == 'A'){
            var div = document.getElementById('titleKeywordA');
            if (document.selection) {
                // for IE
                var r = document.body.createTextRange();
                r.moveToElementText(div);
                r.moveEnd("character");
                r.select();
            } else {
                // For others
                var s = window.getSelection();
                var d = document.createRange();
                d.selectNode(div);
                s.addRange(d);
                document.execCommand("Copy"); // 执行浏览器复制命令
                alert("已复制好，可贴粘。");
                s.removeAllRanges()
            }
        }
        else {
            var divA = document.getElementById('commentKeywordA');
            if (document.selection) {
                // for IE
                var e = document.body.createTextRange();
                e.moveToElementText(divA);
                e.moveEnd("character");
                e.select();
            } else {
                // For others
                var f = window.getSelection();
                var i = document.createRange();
                i.selectNode(divA);
                f.addRange(i);
                document.execCommand("Copy"); // 执行浏览器复制命令
                alert("已复制好，可贴粘。");
                f.removeAllRanges()
            }
        }

    };

    //var posklock = 0;
    //$scope.postTask = function(){
    //    if(posklock == 1){
    //        return;
    //    }
    //    posklock = 1;
    //
    //    var uploadTaskUrl = '/taskHall/tempUserDoTask';
    //    var lockParam = {'userCId' : gUserCId, 'taskId' : $scope.taskDetail.id};
    //    $http.post(uploadTaskUrl, lockParam).success(function(response){
    //        posklock = 0;
    //    });
    //};

    $scope.preUploadFile = function () {
        $scope.imgError = 1;
        uploader.clearQueue();
    };

    $scope.ert = $scope;
    $scope.clickImg = function(){
        var input;
        if ($scope.userSpecialNeeds.AppleID == 'on'){
            input = 'Apple ID:<input type="text" ng-model="ert.appleId">'
        }
        if ($scope.userSpecialNeeds.userNickName == 'on'){
            input = '用户昵称:<input type="text" ng-model="ert.userNickName">'
        }
        if ($scope.userSpecialNeeds.weChat == 'on'){
            input = '填写微信:<input type="text" ng-model="ert.userWeChat">'
        }

        if ($scope.userSpecialNeeds.AppleID == 'on' && $scope.userSpecialNeeds.userNickName == 'on'){
            input = 'Apple ID:<input type="text" ng-model="ert.appleId">' + '<br>' + '用户昵称:<input type="text" ng-model="ert.userNickName">'
        }

        if ($scope.userSpecialNeeds.userNickName == 'on' && $scope.userSpecialNeeds.weChat == 'on'){
            input = '用户昵称:<input type="text" ng-model="ert.userNickName">' + '<br>' + '填写微信:<input type="text" ng-model="ert.userWeChat">'
        }

        if ($scope.userSpecialNeeds.AppleID == 'on' && $scope.userSpecialNeeds.weChat == 'on'){
            input = 'Apple ID:<input type="text" ng-model="ert.appleId">' + '<br>' + '填写微信:<input type="text" ng-model="ert.userWeChat">'
        }

        if ($scope.userSpecialNeeds.AppleID == 'on' && $scope.userSpecialNeeds.userNickName == 'on' &&
            $scope.userSpecialNeeds.weChat == 'on'){
            input = 'Apple ID:<input type="text" ng-model="ert.appleId">' + '<br>' + '用户昵称:<input type="text" ng-model="ert.userNickName">' + '<br>'
                + '填写微信:<input type="text" ng-model="ert.userWeChat">'
        }

        $ionicPopup.show({
            template: input,
            title: '用户输入内容',
            scope: $scope,
            buttons: [
                {text: '取消'},
                {
                    text: '<b>确认</b>',
                    type: 'button-positive',
                    onTap: function () {
                        $scope.userInputDetail();
                    }

                }

            ]
        });
    };

    var userInputArray = Array();
    $scope.userInputDetail = function(){
        var ertObject = Object();
        if ($scope.ert.appleId != '' || $scope.ert.appleId != undefined){
            ertObject.appleID = $scope.ert.appleId;
        }
        if ($scope.ert.userNickName != '' || $scope.ert.userNickName != undefined){
            ertObject.userNickName = $scope.ert.userNickName;
        }
        if ($scope.ert.weChat != '' || $scope.ert.weChat != undefined){
            ertObject.weChat = $scope.ert.weChat;
        }

        userInputArray.push(ertObject);

    };



    //上传图片的代码
    if (window.localStorage) {
        $scope.userCode = localStorage.getItem("userCode");
    } else {
        $scope.userCode = getCookie('userCode');
    }

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

    //$scope.deletFile = function () {
    //    $scope.imgError = 1;
    //    uploader.clearQueue();
    //};

    var fileUrls = Array();

    uploader.onAfterAddingFile = function (fileItem) {
        //
    };

    uploader.onAfterAddingAll = function (addedFileItems) {
        $scope.errorId = 0;
        $scope.progressNum = 5;

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

    function showAlertError(errorMsg){
        var myPopup = $ionicPopup.show({
            title: errorMsg
        });

        $timeout(function() {
            myPopup.close();
        }, 2000);
    }

    uploader.onCompleteAll = function () {
        console.info('onCompleteAll');
        var Url = '/taskHall/tempUserDoTask';
        $scope.progressNum = 90;

        if(fileUrls.length < $scope.taskPicCount){
            showAlertError('图片个数不对,需要' + $scope.taskPicCount + '张图片');
            $scope.progressNum = 0;
            uploader.clearQueue();
            fileUrls = Array();
            return;
        }

        if (($scope.ert.appleId == '' || $scope.ert.appleId == undefined) && $scope.userSpecialNeeds.AppleID == 'on'){
            showAlertError('AppleID未填');
            $scope.progressNum = 0;
            uploader.clearQueue();
            fileUrls = Array();
            return;
        }
        if (($scope.ert.userNickName == '' || $scope.ert.userNickName == undefined) && $scope.userSpecialNeeds.userNickName == 'on'){
            showAlertError('用户昵称未填');
            $scope.progressNum = 0;
            uploader.clearQueue();
            fileUrls = Array();
            return;
        }
        if (($scope.ert.weChat == '' || $scope.ert.weChat == undefined) && $scope.userSpecialNeeds.weChat == 'on'){
            showAlertError('微信未填');
            $scope.progressNum = 0;
            uploader.clearQueue();
            fileUrls = Array();
            return;
        }

        if (userInputArray.length == 0 && $scope.userSpecialNeeds.length > 0){
            showAlertError('必填项未填');
            $scope.progressNum = 0;
            uploader.clearQueue();
            fileUrls = Array();
            return;
        }


        $http.post(Url, {
                'userCId':gUserCId,
                'taskId':$scope.lockTaskId,
                'uploadName':$scope.userCode,
                'requirementImgs': fileUrls,
                'userInputArray':userInputArray
            })
            .success(function (response) {
                $scope.errorId = response.errorId;
                $scope.errorMsg = response.errorMsg;
                console.log($scope.errorId);
                console.log($scope.errorMsg);
                if($scope.errorId == 0){
                    if(taskDetailTimer != undefined){
                        $interval.cancel(taskDetailTimer);
                        taskDetailTimer = undefined;
                    }
                    $scope.downloadTasks = 'uploaded';
                    $scope.doTaskImgs = response.requirementImgs;
                    $scope.uploadButtonTitle = '确认提交任务';

                    $scope.nowUpladedImgs = 1;

                    refreshMyTaskStatus('审核中');

                    if(response.message.length > 10){
                        //未绑定手机号

                        //绑定手机号
                        $rootScope.showPhoneConfirm(response.message);
                    }

                    //$("#up").attr("disabled", true);
                }else {
                    $scope.errorId = response.errorId;
                    $scope.errorMsg = response.message;
                }

                $scope.progressNum = 0;

                uploader.clearQueue();
                fileUrls = Array();
            });
    };
    $scope.backlastpage = function(){
        if($scope.uploadButtonTitle == '确认提交任务'){
            window.history.back();
        }
    };
    $scope.endTask = function(){
        //location.href='/myClaim/' + $scope.oneAppInfo.userObjectId;
    }
})

// 我的任务/审核
.controller('MyTaskController', function($rootScope, $scope, $http, $interval, $timeout, $ionicLoading) {
    getUserCode();

    //倒计时代码
    var myTaskTimer;

    //click
    $scope.taskClick = function(clickTask){
        ///app#/tab/task/57eb3f645bbb50005d759375
        window.location.href = '#/myTask/' + clickTask.taskId;
    };

    $scope.refreshMyTask = function(refreshTag){
        $http.post(tasksUrl, {'userCId': gUserCId}).success(function (response) {
                $ionicLoading.hide();
                $scope.loading = false;
                if(response.errorId == 0){
                    //succeed
                    $scope.masterConfig = response.masterConfig;
                    $rootScope.retList = response.retList;
                    $scope.undoTask = response.undoTask;
                    $scope.willGetRmb = response.willGetRmb;
                    $scope.tempTaskMaxTime = response.tempTaskMaxTime;

                    //*******************************开始倒计时
                    if(myTaskTimer != undefined){
                        $interval.cancel(myTaskTimer);
                        myTaskTimer = undefined;
                    }
                    myTaskTimer = $interval(function(){
                        var now = new Date();
                        for (var i = 0; i < $scope.retList.length; i++){
                            var myTaskObject = $scope.retList[i];
                            if(myTaskObject.createdAt != undefined){
                                var taskTimerStr = myTaskObject.createdAt.replace(/-/g,"/");
                                var taskDate = new Date(taskTimerStr);
                                var leftTime = $scope.tempTaskMaxTime - (now.getTime() - taskDate.getTime());

                                if(leftTime < 0){
                                    myTaskObject.createdAt == undefined;
                                    myTaskObject.statusDes = '已超时';

                                    if(myTaskTimer != undefined){
                                        $interval.cancel(myTaskTimer);
                                        myTaskTimer = undefined;
                                    }
                                    return;
                                }

                                var leftSecond = parseInt(leftTime / 1000);
                                //var day = Math.floor(leftSecond / daySeconds);
                                leftSecond = leftSecond % (60 * 60 * 24);
                                var hour = Math.floor(leftSecond / 3600);
                                leftSecond = leftSecond % 3600;
                                var minute = Math.floor(leftSecond / 60);
                                leftSecond = leftSecond % 60;
                                var second = leftSecond;

                                myTaskObject.downcountDisplay = (hour > 0 ? (hour + "时") : '') +
                                    (minute > 0 ? (minute + "分") : '')  + second + "秒";
                            }
                        }
                    }, interval);
                }else {
                    $scope.errorId = response.errorId;
                    $scope.message = response.message;
                }
            })
            .finally(function() {
                // Stop the ion-refresher from spinning
                $scope.$broadcast('scroll.refreshComplete');
            });
    };

    var tasksUrl = '/taskHall/myTask';
    $ionicLoading.show();
    $scope.refreshMyTask(-1);
})

    // 提现界面
.controller('AccountController', function($rootScope, $scope, $http, $timeout, $ionicLoading, $ionicPopup, FileUploader) {
    getUserCode();
    $scope.settings = {
        enviarNotificaciones: true
    };

    $scope.ctrlScope = $scope;

    // 获取提现界面信息
    $scope.refreshTaskAccount = function(refreshTask){
        var accountUser = '/taskUser/withdrawDeposit';
        $http.post(accountUser, {'userCId':gUserCId})
            .success(function(response){
                $ionicLoading.hide();
                $scope.temUserInfo = response.temUserInfo;
                $scope.canWithdrawMoney = response.temUserInfo.canWithdrawMoney;
            })
            .finally(function () {
                // Stop the ion-refresher from spinning
                $ionicLoading.hide();
                if (refreshTask == 1) {
                    $scope.$broadcast('scroll.refreshComplete');
                }
            });
    };

    $scope.refreshTaskAccount(1);

    //推广大师
    var tempUserCode;
    if (window.localStorage) {
        tempUserCode = localStorage.getItem("userCode");
    } else {
        tempUserCode = getCookie('userCode');
    }

    var accountUser = '/taskUser/marketingApprenticeCount';
    $http.post(accountUser, {'userCId':gUserCId, 'userCode':tempUserCode})
        .success(function(response){
            $scope.rewardMessages = response.rewardMessages;
            console.log($scope.canWithdrawMoney)
        })
        .finally(function () {
            // Stop the ion-refresher from spinning
        });

    $scope.getMarketingReward = function () {
        $ionicLoading.show();
        var accountUser = '/taskUser/getMarketingApprenticeReward';

        $http.post(accountUser, {'userCId':gUserCId, 'userCode':tempUserCode})
            .success(function(response){
                $ionicLoading.hide();
                if(response.errorId == 0){
                    $scope.temUserIncanWithdrawMoney = response.temUserInfo.canWithdrawMoney;
                    toastr.success(response.message);
                }else {
                    toastr.error(response.message);
                }

            })
            .finally(function () {
                // Stop the ion-refresher from spinning
                $ionicLoading.hide();
            });
    };

    function showAlertError(errorMsg){
        var myPopup = $ionicPopup.show({
            title: errorMsg
        });

        $timeout(function() {
            myPopup.close();
        }, 2000);
    }


    //绑定接口
    var bindLock = 0;
    $rootScope.bindpay = function(type){
        if(bindLock == 1){
            return;
        }
        var bindpay;
        var binditem;
        if(type == 'aliAccount'){
            if($scope.ctrlScope.inputaliAccount == undefined && $scope.ctrlScope.inputaliAccount.length == 0){
                return;
            }
            binditem = {'userCId' : gUserCId, 'aliAccount' : $scope.ctrlScope.inputaliAccount, 'aliPayUserName' : $scope.ctrlScope.aliPayUserName};
            bindpay = '/taskUser/bindAliPay';
        }else if(type == 'requestSms'){
            if($scope.ctrlScope.phoneNumber == undefined && $scope.ctrlScope.phoneNumber.length == 0){
                return;
            }
            binditem = {'userCId' : gUserCId, 'phoneNumber' : $scope.ctrlScope.phoneNumber};
            bindpay = '/taskUser/requestSms';

        }else if(type == 'bindPhone'){
            if($scope.ctrlScope.smsCode == undefined && $scope.ctrlScope.smsCode.length == 0){
                return;
            }
            binditem = {'userCId' : gUserCId, 'phoneNumber' : $scope.ctrlScope.phoneNumber , 'smsCode': $scope.ctrlScope.smsCode};
            bindpay = '/taskUser/bindPhone';
        }
        else if(type == 'aliPayUserName'){
            if($scope.ctrlScope.aliPayUserName == undefined && $scope.ctrlScope.aliPayUserName.length == 0){
                return;
            }
            binditem = {'userCId' : gUserCId, 'aliPayUserName' : $scope.ctrlScope.aliPayUserName};
            bindpay = '/taskUser/aliPayName';
        }
        else {
            return;
        }

        bindLock = 1;
        $ionicLoading.show();

        $http.post(bindpay, binditem).success(function(response){
            $ionicLoading.hide();
            bindLock = 0;
            if(response.errorId == 0){
                if(type == 'requestSms'){
                    $rootScope.binderPhoneNumber();
                }
                else if (type == 'aliAccount'){
                    $scope.temUserInfo.aliAccount = $scope.ctrlScope.inputaliAccount;
                    alert('赞！绑定支付宝成功');
                }
                else if (type == 'aliPayUserName'){
                    alert('赞！绑定姓名成功');
                    $scope.temUserInfo.aliPayUserName = response.aliPayUserName;
                }
                else if (type == 'aliAccount'){
                    alert('支付宝绑定成功,如需修改支付宝,请联系管理员');
                    $scope.temUserInfo = response.temUserInfo;
                }
                else {
                    //refresh cookie
                    if (window.localStorage) {
                        try {
                            localStorage.setItem("userCId", response.temUserInfo.userCId);
                            localStorage.setItem("userCode", response.temUserInfo.userCode);
                        }
                        catch (e) {
                            //alert(e);
                            alert('无痕模式无法正常使用小马哦,点击右下角后,再点击左下角关闭无痕模式');
                            return;
                        }
                    } else {
                        setCookie("userCId", response.temUserInfo.userCId);
                        setCookie("userCode", response.temUserInfo.userCode);
                        alert('set cookie succeed');
                    }

                    getUserCode();
                    $scope.temUserInfo = response.temUserInfo;

                    if(type == 'bindPhone'){
                        alert('赞！绑定手机号成功,小马会在每天下午2-3点放出大量任务');
                    }

                }
            }else {
                //error note
                showAlertError(response.message);

            }
        });
    };

    //申请提现
    var askForWithdrawLock = 0;
    $scope.askForWithdraw = function(){
        if(askForWithdrawLock == 1){
            return;
        }
        var withdrawUrl = '/taskUser/withDraw';
        var params = {'userCId' : gUserCId};
        askForWithdrawLock = 1;
        $ionicLoading.show();
        $http.post(withdrawUrl, params).success(function(response){
            $ionicLoading.hide();
            askForWithdrawLock = 0;
            if(response.errorId == 0){
                alert("提现成功");
                $scope.temUserInfo = response.temUserInfo;
            }else {
                //error note
                showAlertError(response.message);
            }
        });
    };

    //绑定手机号
    $rootScope.binderPhoneNumber = function() {
        $ionicPopup.show({
            template: '<input type="text" placeholder="验证码" ng-model="ctrlScope.smsCode">',
            title: '输入你的验证码',
            scope: $scope,
            buttons: [
                {text: '取消'},
                {
                    text: '<b>绑定</b>',
                    type: 'button-positive',
                    onTap: function () {
                        $rootScope.bindpay('bindPhone');
                    }
                }

            ]
        });
    };

    //发送验证码
    $rootScope.showPhoneConfirm = function(popTitle) {
        $ionicPopup.show({
            template: '<input type="text" placeholder="手机号" ng-model="ctrlScope.phoneNumber">',
            title: popTitle,
            scope: $scope,
            buttons: [
                {text: '取消'},
                {
                    text: '<b>获取验证码</b>',
                    type: 'button-positive',
                    onTap: function () {
                        $rootScope.bindpay('requestSms');
                    }
                }
            ]
        });
    };

    //绑定支付宝账号
    $scope.showConfirm = function() {
        $ionicPopup.show({
            template: '<input type="text" ng-model="ctrlScope.inputaliAccount">',
            title: '绑定你的支付宝',
            scope: $scope,
            buttons: [
                {text: '取消'},
                {
                    text: '<b>绑定</b>',
                    type: 'button-positive',
                    onTap: function () {
                        $rootScope.bindpay('aliAccount');
                    }
                }

            ]
        });
    };

    // 绑定支付宝帐号的真实姓名
    $rootScope.showaliPayUserNameConfirm = function() {
        $ionicPopup.show({
            template: '<input type="text" placeholder="绑定支付宝账号的真实姓名" ng-model="ctrlScope.aliPayUserName">',
            title: '绑定支付宝姓名',
            scope: $scope,
            buttons: [
                {text: '取消'},
                {
                    text: '<b>确定</b>',
                    type: 'button-positive',
                    onTap: function () {
                        $rootScope.bindpay('aliPayUserName');
                    }
                }
            ]
        });
    };


    $scope.submitMaterial = function(){
        var myPopup = $ionicPopup.show({
            title: '保存成功'
        });

        $timeout(function() {
            myPopup.close();
        }, 2000);
        //window.location.reload();
    };

    //申请提现
    $scope.Withdraw = function(){
        if($scope.canWithdrawMoney < $scope.temUserInfo.minUserWithDrawRMB && ($scope.temUserInfo.isMarketingApprentice == undefined
            || $scope.temUserInfo.isMarketingApprentice == false)){
            var alertPopup = $ionicPopup.alert({
                title: '满' + $scope.temUserInfo.minUserWithDrawRMB + '元方可提现',
                subTitle: '每次提现金额为' + $scope.temUserInfo.minUserWithDrawRMB + '的整数倍',
            });

            $timeout(function() {
                alertPopup.close(); //由于某种原因3秒后关闭弹出
            }, 2000);
        }

        else if ($scope.canWithdrawMoney < $scope.temUserInfo.apprenticeUserWithDrawRMB && $scope.temUserInfo.isMarketingApprentice == true){

            var alerPopup = $ionicPopup.alert({
                title: '满' + $scope.temUserInfo.apprenticeUserWithDrawRMB + '元方可提现',
                subTitle: '每次提现金额为' + $scope.temUserInfo.apprenticeUserWithDrawRMB + '的整数倍',
            });

            $timeout(function() {
                alerPopup.close(); //由于某种原因3秒后关闭弹出
            }, 2000);
        }
        else{
            $scope.askForWithdraw();
        }
    };

    // 用户修改头像

})

    // 明细
.controller('currentAssetDetailController', function($scope, $http, $ionicLoading, $timeout){
    getUserCode();
    var pageCount = 20;

    //默认下载
    $scope.downloadTasks = [];
    $scope.commentTasks = [];
    $scope.apprenticeInfo = [];
    $scope.withdrawDeposits = [];

    $scope.downloadHasMore = false;
    $scope.commentLoadHasMore = false;
    $scope.apprenticeInfoLoadHasMore = false;
    $scope.withdrawDepositsLoadHasMore = false;

    //isMore 1(load more) 0(refresh) -1(button click)
    $scope.switchQueryType = function (taskType, isnMore) {
        $scope.taskType = taskType;
        var currentAssURL;
        if(taskType == 1){
            if($scope.downloadTasks.length > 0 && isnMore == -1){
                return;
            }
            if(isnMore == 0){
                //refresh
                currentAssURL = '/taskUserDetails/currentAsset/' + taskType + '/' + gUserCId + '/' + 0;
            }else {
                if($scope.downloadTasks == undefined || $scope.downloadTasks.length == 0){
                    $ionicLoading.show();
                }
                currentAssURL = '/taskUserDetails/currentAsset/' + taskType + '/' + gUserCId + '/' + $scope.downloadTasks.length/pageCount;
            }

        }
        else if(taskType == 2){
            if($scope.commentTasks.length > 0 && isnMore == -1){
                return;
            }
            if(isnMore == 0) {
                //refresh
                currentAssURL = '/taskUserDetails/currentAsset/' + taskType + '/' + gUserCId + '/' + 0;
            }else {
                if($scope.commentTasks == undefined || $scope.commentTasks.length == 0){
                    $ionicLoading.show();
                }
                currentAssURL = '/taskUserDetails/currentAsset/' + taskType + '/' + gUserCId + '/' + $scope.commentTasks.length / pageCount;
            }

        }
        else if (taskType == 3){
            if($scope.apprenticeInfo.length > 0 && isnMore == -1){
                return;
            }
            if(isnMore == 0) {
                //refresh
                currentAssURL = '/taskUserDetails/currentAsset/' + taskType + '/' + gUserCId + '/' + 0;
            }else {
                if($scope.apprenticeInfo == undefined || $scope.apprenticeInfo.length == 0){
                    $ionicLoading.show();
                }
                currentAssURL = '/taskUserDetails/currentAsset/' + taskType + '/' + gUserCId + '/' + $scope.apprenticeInfo.length / pageCount;
            }

        }
        else if (taskType == 4){
            if($scope.withdrawDeposits.length > 0 && isnMore == -1){
                return;
            }
            if(isnMore == 0) {
                //refresh
                currentAssURL = '/taskUserDetails/currentAsset/' + taskType + '/' + gUserCId + '/' + 0;
            }else {
                if($scope.withdrawDeposits == undefined || $scope.withdrawDeposits.length == 0){
                    $ionicLoading.show();
                }
                currentAssURL = '/taskUserDetails/currentAsset/' + taskType + '/' + gUserCId + '/' + $scope.withdrawDeposits.length / pageCount;
            }

        }


        $http.get(currentAssURL)
            .success(function (response) {
                if(response.errorId == 0){
                    if(taskType == 1){
                        if(response.retApps.length > 0){
                            if(isnMore == 0){
                                //refresh
                                $scope.downloadTasks = [];
                            }
                            $scope.downloadTasks = $scope.downloadTasks.concat(response.retApps);
                        }
                    }
                    else if(taskType == 2){
                        if(response.retApps.length > 0){
                            if(isnMore == 0){
                                //refresh
                                $scope.commentTasks = [];
                            }
                            $scope.commentTasks = $scope.commentTasks.concat(response.retApps);

                        }
                    }
                    else if (taskType == 3){
                        if(response.discipleArray.length > 0){
                            if(isnMore == 0){
                                //refresh
                                $scope.apprenticeInfo = [];
                            }
                            $scope.apprenticeInfo = $scope.apprenticeInfo.concat(response.discipleArray);

                        }
                    }
                    else if (taskType == 4){
                        if(response.depositsList.length > 0){
                            if(isnMore == 0){
                                //refresh
                                $scope.withdrawDeposits = [];
                            }
                            $scope.withdrawDeposits = $scope.withdrawDeposits.concat(response.depositsList);

                        }
                    }

                }else {
                    $scope.errorId = response.errorId;
                    $scope.message = response.message;
                }
            })
                .finally(function() {
                    $ionicLoading.hide();
                    // Stop the ion-refresher from spinning
                    if(isnMore == 1){
                        $scope.$broadcast('scroll.infiniteScrollComplete');
                    }
                    if(isnMore == 0){
                        $scope.$broadcast('scroll.refreshComplete');
                    }

                    $timeout(function() {
                        if ($scope.taskType == 1){
                            if($scope.downloadTasks.length > 0 && $scope.downloadTasks.length % pageCount == 0){
                                $scope.downloadHasMore = true;
                            }
                            else {
                                $scope.downloadHasMore = false;
                            }
                        }
                        else if ($scope.taskType == 2){
                            if ($scope.commentTasks.length > 0 && $scope.commentTasks.length % pageCount == 0){
                                $scope.commentLoadHasMore = true;
                            }
                            else {
                                $scope.commentLoadHasMore = false;
                            }

                        }
                        else if ($scope.taskType == 3){
                            if ($scope.apprenticeInfo.length > 0 && $scope.apprenticeInfo.length % pageCount == 0){
                                $scope.apprenticeInfoLoadHasMore = true;
                            }
                            else {
                                $scope.apprenticeInfoLoadHasMore = false;
                            }
                        }
                        else {
                            if ($scope.withdrawDeposits.length > 0 && $scope.withdrawDeposits.length % pageCount == 0){
                                $scope.withdrawDepositsLoadHasMore = true;
                            }
                            else {
                                $scope.withdrawDepositsLoadHasMore = false;
                            }
                        }
                    }, 1000);
                });
    };

    $scope.switchQueryType(1, -1);

    $scope.loadMore = function(){
        if($scope.downloadHasMore == true){
            $scope.switchQueryType(1, 1);
        }
        else if ($scope.commentLoadHasMore == true){
            $scope.switchQueryType(2, 1);
        }
        else if ($scope.apprenticeInfoLoadHasMore == true){
            $scope.switchQueryType(3, 1);
        }
        else if ($scope.withdrawDepositsLoadHasMore == true){
            $scope.switchQueryType(4, 1);
        }
    };

})

.controller('withdrawalOptionController', function($scope, $http, $ionicLoading, $timeout, $ionicPopup, $ionicModal){

    getUserCode();

    $scope.items=[10, 30, 50, 100];
    $scope.ret = {choice:10};

    // 手机充值
    $scope.clientSideList = [
        { text: "30元", value: "30" },
        { text: "50元", value: "50" },
        { text: "100元", value: "100" }
    ];

    $scope.topUp = {
        clientSide: '30'
    };

    // 支付宝提现
    $scope.aliPaySideList = [
        { text: "10元", value: "10.5" },
        { text: "30元", value: "30.5" },
        { text: "50元", value: "50.5" },
        { text: "100元", value: "100.5" }
    ];

    $scope.aliPayTopUp = {
        clientSide: '10.5'
    };

    // 一个提示对话框
    $scope.showAlert = function(titleInfo) {
        if (titleInfo.length > 6){
            var alertPopup = $ionicPopup.alert({
                cssClass:'clt-right',
                title: titleInfo,
                buttons:[]
            });
            $timeout(function() {
                alertPopup.close(); //由于某种原因2秒后关闭弹出
            }, 2000);
        }
        else {
            var alertPopupA = $ionicPopup.alert({
                cssClass:'cl-right',
                title: titleInfo,
                buttons:[]
            });
            $timeout(function() {
                alertPopupA.close(); //由于某种原因2秒后关闭弹出
            }, 2000);
        }
    };

    $scope.aliPaySubmit = function(aliPayObject, currentMoney){
        if (aliPayObject.aliPayNumber == undefined || aliPayObject.aliPayNumber == ''){
            $scope.showAlert('帐号未填写');
            return;
        }

        if (aliPayObject.aliPayName == undefined || aliPayObject.aliPayName == ''){
            $scope.showAlert('姓名未填写');
            return;
        }

        if (currentMoney > aliPayObject.currentMoney){
            $scope.showAlert('余额不足');
            return;
        }

        var userCurrentURL = '/withdrawalRelated/isNoMoney';
        var aliPay = {  'userId':gUserCId,
            'needMoney':currentMoney,
            'type':'支付宝提现',
            'aliPayNumber':aliPayObject.aliPayNumber,
            'aliPayName':aliPayObject.aliPayName
        };

        $http.post(userCurrentURL, aliPay).success(function(response){
            if (response.errorId == -1){
                $scope.showAlert(response.errorMsg);
            }
            else {
                $scope.showAlert(response.errorMsg);
                $scope.userInfoObject.currentMoney = response.successInfo
            }
        })
    };


    var userInfoUrl = '/withdrawalRelated/phone/' + gUserCId;
    $http.get(userInfoUrl).success(function(response){
        $scope.userInfoObject = response.userInfoObject
    });

    // 手机充值
    $scope.phonePay = function(){
        if ($scope.userInfoObject.mobilePhone == undefined || $scope.userInfoObject.mobilePhone == '' || $scope.userInfoObject.mobilePhone.length < 11
            || $scope.userInfoObject.mobilePhone.length > 11){
            var alertPopup = $ionicPopup.alert({
                title: '请正确填写手机号码'
            });

            $timeout(function() {
                alertPopup.close(); //由于某种原因3秒后关闭弹出
            }, 2000);
            return;
        }

        var validationMoneyUrl = '/withdrawalRelated/isNoMoney';
        var canshu = {  'userId':gUserCId,
                        'needMoney':$scope.topUp.clientSide,
                        'type':'手机充值',
                        'mobilePhone':$scope.userInfoObject.mobilePhone
        };
        $http.post(validationMoneyUrl, canshu).success(function(response){
            if (response.errorId == -1){
                var alertPopup = $ionicPopup.alert({
                    title: response.errorMsg
                });

                $timeout(function() {
                    alertPopup.close(); //由于某种原因3秒后关闭弹出
                }, 2000);
            }

            if (response.errorId == 0) {
                // 手机充值支付确认弹框
                new TipBox({type:'topUp',str:$scope.userInfoObject.mobilePhone, string:$scope.topUp.clientSide,
                    hasBtn:true});
            }
        });

        //todo 未写完
        // 点击确认跳转去充值话费
        TipBox.prototype.confirmPay = function(){
            var confirmPayUrl = '/taskUser/phonePay';
            var phoneInfo = {   'phoneNumber':$scope.userInfoObject.mobilePhone,
                                'topUpAmount':$scope.topUp.clientSide,
                                'gUserCId':gUserCId
            };

            $http.post(confirmPayUrl, phoneInfo).success(function(response){
                if (response.errorId == 0){
                    $scope.status = response.status;
                    alert(response.errorMsg);
                }
                else {
                    $scope.errorMsg = response.errorMsg;
                    alert(response.errorMsg);
                }
            });

            TipBox.prototype.destroy();
            this.destroy();
            this.config.setTime && typeof this.config.callBack === "function" && this.config.callBack();
        };
    };

    //var orderStatusQueryUrl = '/withdrawalRelated/orderStatusQuery/' + gUserCId;
    //$http.get(orderStatusQueryUrl).success(function(response){
    //    if (response.errorId == 0){
    //        $scope.status = response.status;
    //        $scope.errorMsg = response.errorMsg;
    //    }
    //    else {
    //        $scope.errorMsg = response.errorMsg;
    //    }
    //});

    // 支付宝提现



})


.controller('userMaterialController', function($scope, $http, $ionicLoading, $timeout){

})

    // 高额任务
.controller('highTaskDetailController', function($rootScope, $scope, $ionicActionSheet,$http, $location, FileUploader,
                                                 $ionicPopup, $interval, $timeout, $ionicLoading,$ionicModal){
    $scope.showBigImage = function () {
        $scope.bigImage = true;
    };

    $scope.bigImage = false;    //初始默认大图是隐藏的
    $scope.hideBigImage = function () {
        $scope.bigImage = false;
    };

    $scope.popup = {
        isPopup: false,
        index: 0
    };

    // 开始任务导航
    $scope.startNavigation = function() {
        $scope.Ali = false;
        $scope.phone = false;
        var type =document.getElementsByClassName("input-detail-C");
        if (type != '' || type != undefined){
            $scope.popup.optionsPopup = $ionicPopup.show({
                cssClass:'et-popup',
                templateUrl: "templates/popub-model.html",
                scope: $scope
            });
        }

        $scope.popup.isPopup = true;

    };
})

// 截图任务
.controller('screenshotsTaskController', function($scope, $http, $ionicLoading, $timeout,$rootScope){

    getUserCode();
    var pageCount = 20;

    $rootScope.commentScreenTasks = [];

    $scope.commentloadHasMore = false;

    //isMore 1(load more) 0(refresh) -1(button click)
    $scope.switchTaskType = function (isMore) {
        var tasksUrl;
        if($rootScope.commentScreenTasks.length > 0 && isMore == -1){
            return;
        }
        if(isMore == 0) {
            //refresh
            tasksUrl = '/printScreenTask/' + gUserCId + '/' + 0;
        }else {
            if($rootScope.commentScreenTasks == undefined || $rootScope.commentScreenTasks.length == 0){
                $ionicLoading.show();
            }
            tasksUrl = '/printScreenTask/' + gUserCId + '/' + $rootScope.commentScreenTasks.length / pageCount;
            $ionicLoading.hide();
        }
        $scope.commentLoading = true;

        if(tasksUrl == undefined){
            console.error('tasksUrl == undefined');
            return;
        }

        $http.get(tasksUrl)
            .success(function (response) {
                if(response.errorId == 0){
                    $scope.masterConfig = response.masterConfig;

                    //succeed
                    if(response.tasks.length > 0){
                        if(response.tasks.length == pageCount) {
                            $scope.commentHasMore = true;
                        }else {
                            $scope.commentHasMore = false;
                        }
                        if(isMore == 0){
                            //refresh
                            $scope.commentTasks = [];
                        }
                        $rootScope.commentScreenTasks = $scope.commentScreenTasks.concat(response.tasks);
                    }else {
                        $scope.commentHasMore = false;
                    }
                }else {
                    $scope.errorId = response.errorId;
                    $scope.message = response.message;
                }
            })
            .finally(function() {
                $ionicLoading.hide();
                // Stop the ion-refresher from spinning

                if(isMore == 1){
                    $scope.$broadcast('scroll.infiniteScrollComplete');
                }
                if(isMore == 0){
                    $scope.$broadcast('scroll.refreshComplete');
                }

                $timeout(function() {
                    if($rootScope.commentScreenTasks.length > 0 && $rootScope.commentScreenTasks.length % pageCount == 0){
                        $scope.commentloadHasMore = true;
                    }else {
                        $scope.commentloadHasMore = false;
                    }
                }, 1000);
            });
    };

    $scope.switchTaskType(-1);

    $scope.refreshTaskHall = function(){
        $scope.switchTaskType(0);
    };

    $scope.loadMore = function(){
        if($scope.commentloadHasMore == true){
            $scope.switchTaskType(1);
        }
    };

    // 今日已经完成和进行中的任务
    var completeTaskUrl = '/printScreenTask/' + gUserCId;
    $http.get(completeTaskUrl).success(function(response){
        if (response.errorId == 0){
            $rootScope.completeScreenTasks = response.completeTasks;
            $rootScope.ongoingScreenTaskArray = response.ongoingTaskArray;
        }
    });

    $scope.getTheTask = function(clickTask){
        if ($rootScope.ongoingScreenTaskArray.length > 0){
            alert('不能同时抢多个任务哦!请先完成进行中的任务')
        }
        else {
            window.location.href = '#/printScreenTask/' + clickTask;
        }
    };
})

.controller('LotteryController', function($rootScope, $scope, $http, $timeout, $ionicPopup) {
    getUserCode();
    $scope.currentBidDic = {};
    function getLotteryInfo(userCId)
    {
        var url = '/lottery/' + userCId;
        $http.get(url).success(function(response) {
            for (var i = 1;i <= 9; i++) {
                $scope.currentBidDic[i] = response.currentBidArray[i];
                $scope.pool = response.pool;
                $rootScope.accountBalance = response.accountBalance;
            }
        })
    }

    getLotteryInfo(gUserCId);

    $scope.bidConfirm = function(money, index) {
        if (money < 1) {
            var alertPopup = $ionicPopup.alert({
                title: '下注失败',
                template: '你的余额不足'
            });
            alertPopup.then(function(res) {
            });
        }
        else {
            var confirmPopup = $ionicPopup.confirm({
                title: '下注确认',
                template: '你确定要消费1元,购买一注数字' + index + '吗?',
                cancelText: '取消', // String (默认: 'Cancel')。一个取消按钮的文字。
                okText: '确认' // String (默认: 'OK')。OK按钮的文字。
            });
            confirmPopup.then(function(res) {
                if(res) {
                    var biddingUrl = '/lottery/' + gUserCId + '/' + index;
                    $http.get(biddingUrl).success(function (response) {
                        if (response.errorId == 0){
                            var alertPopup = $ionicPopup.alert({
                                title: '下注成功',
                                template: '已成功下注数字' + index + '一注'
                            });

                            alertPopup.then(function(res) {
                            });
                            getLotteryInfo(gUserCId);
                            console.log('确认购买');
                            $rootScope.accountBalance = response.accountBalance;
                        }
                        else {
                            var alertPopup = $ionicPopup.alert({
                                title: '下注失败',
                                template: response.message
                            });
                            alertPopup.then(function(res) {
                            });
                            console.log(response.message);
                        }

                    });
                        //.catch(function(response){
                        //    var alertPopup = $ionicPopup.alert({
                        //        title: '下注失败',
                        //        template: response.message
                        //    });
                        //    alertPopup.then(function(res) {
                        //    });
                        //    console.log(response.message);
                        //});
                } else {
                    console.log('取消购买');
                }
            });
        }
    };
})

.controller('lotteryManualController', function($rootScope, $scope, $http) {

})
.controller('lotteryResultsController', function($rootScope, $scope, $http) {
    var url = '/lotteryResults';
    $http.get(url).success(function(response) {
        $scope.pools = response.pools;
        console.log($scope.pools);
    })
});
