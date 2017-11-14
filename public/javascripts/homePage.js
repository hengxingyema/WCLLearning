/**
 * Created by cailong on 16/8/29.
 */

var app = angular.module('yemaWebApp',[]);
var navIndex = 0;

app.controller('homePageCtrl', function($scope, $http){
    //邀请好友
    //$scope.inviteUrl = "http://yematest.leanapp.cn/user/register/" + getCookie("userIdCookie");
    $scope.inviteUrl = "http://www.mustangop.com/user/register/" + getCookie("userIdCookie");
    $scope.copyUrl = function () {
        $('#output').popover('toggle');
        var Url = document.getElementById("invitecopy");
        Url.select(); // 选择对象
        document.execCommand("Copy"); // 执行浏览器复制命令
    };

    //尊贵客人
    $scope.noviceTaskObject = Object();
    $scope.noviceTaskObject.luxuryUserStep = 0;
    //首次充值
    $scope.noviceTaskObject.hasFirstRecharge = 0;

    // 任务
    var noviceTaskUrl = '/homePage/noviceTask';
    $http.get(noviceTaskUrl).success(function(response){
        $scope.noviceTaskObject = response.noviceTaskObject;
    });

    //******************* 自动轮播 *************************
    $("#myCarousel").carousel({
        interval:5000
    });
    $("#myCarousel1").carousel({
        interval:3000
    });

        // banner
    var bannerurl = '/homePage/banner';
    $http.get(bannerurl).success(function(response){
        $scope.bannerUrl = response.bannerUrl;
    });

    // 签到
    var ischeckinsUrl = '/homePage/ischeckins';
    $scope.isCheckIns = 0;
    $scope.todayYB = 1;
    $scope.continueCheck = 2;
    $scope.latestDays = 0;
    $http.get(ischeckinsUrl).success(function(response){
        if(response.errorId == 0){
            $scope.isCheckIns = response.isCheckIns;
            $scope.todayYB = response.todayYB;
            $scope.continueCheck = response.continueCheck;
            $scope.latestDays = response.latestDays;
        }
    });

    $scope.releaseTaskY = 0;
    $scope.doTaskY = 0;
    $scope.checkTaskY = 0;
    $http.get('/homePage/dayTask').success(function(response){
        if(response.errorId == 0){
            $scope.releaseTaskY = response.releaseTaskY;
            $scope.doTaskY = response.doTaskY;
            $scope.checkTaskY = response.checkTaskY;
        }
    });

    // 发布任务总数 and 有效完成任务数
    var releaseTaskURL = '/webAnalysis/taskCount';
    $http.get(releaseTaskURL).success(function(response){
        $scope.releaseTotalCount = response.releaseTotalCount;
        $scope.receiveTotalCount = response.receiveTotalCount;
        $scope.finishRate = response.finishRate;
        $scope.enterAppCount = response.enterAppCount;
        $scope.onlineTime = response.onlineTime;

        console.log('累计发布任务数' + response.releaseTotalCount);
        console.log('完成有效任务数' + response.receiveTotalCount);
        console.log('完成率' + response.finishRate);
        console.log('入驻App数' + response.enterAppCount);
        console.log('野马上线' + response.onlineTime + '天');
    });

    // 每日任务按钮
    $scope.dayTaskLock = 0;
    $scope.dayTaskBtn = function(actionId){
        if($scope.dayTaskLock == 1){
            return
        }
        $scope.dayTaskLock = 1;
        var dayTaskURL = '/homePage/dayTask';
        $http.post(dayTaskURL, {'actionId':actionId}).success(function(response){
            $scope.dayTaskLock = 0;
            if (response.errorId == 0){
                $scope.releaseTaskY = response.releaseTaskY;
                $scope.doTaskY = response.doTaskY;
                $scope.checkTaskY = response.checkTaskY;
            }
        })
    };

    // 签到按钮
    $scope.checkInLock = 0;
    $scope.butCheckIns = function(){
        if($scope.checkInLock == 1){
            return;
        }
        $scope.checkInLock = 1;
        var checkInsURL = '/homePage/checkIns';
        $http.post(checkInsURL, {}).success(function(response){
            $scope.checkInLock = 0;
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;
            if (response.errorId == 0){
                $scope.errorId = response.errorId;
                $scope.errorMsg = response.errorMsg;
                $scope.isCheckIns = 1;
                $scope.latestDays += 1;
            }
            else {
                toastr.error(response.errorMsg);
            }
        })
    };
    //我发布的任务
     $scope.jump = function(curren){
        window.open('http://aso100.com/app/rank/appid' + '/' + curren.appleId + '/country/cn');
     };
     $scope.jump1 = function(curren){
         window.open('http://aso100.com/app/keyword/appid/'+curren.appleId+'/country/cn');
     };
    $scope.jump2 = function(curren){
        window.open('http://aso100.com/app/comment/appid/'+curren.appleId+'/country/cn');
    };
    $scope.jump3 = function(curren){
        window.open('http://aso100.com/app/download/appid/'+curren.appleId+'/country/cn');
    };

    //用户+拒绝任务相关
    $scope.totalUndoCount = 0;
    $scope.refusedCount = 0;
    var indexUrl = '/index';
    $http.get(indexUrl).success(function(response){
        //未做的
        $scope.totalUndoCount = response.totalUndoCount;
        //被拒绝的
        $scope.totalRefusedCount = response.totalRefusedCount;
    });

    //需要审核的任务条数相关
    var unCheckCountUrl = '/index/unCheckTaskCount';
    $scope.pendingCount = 0;
    $http.get(unCheckCountUrl).success(function(response){
        $scope.pendingCount = response.pendingCount;
    });

    // 我的发布
    var myReleaseTaskUrl = '/homePage/myReleaseTask';
    $scope.noApp = true;
    $http.get(myReleaseTaskUrl).success(function(response){
        $scope.myReleaseTask = response.myReleaseTaskInfo;
        if ($scope.myReleaseTask != undefined && $scope.myReleaseTask.length <= 0){
            $scope.noApp = true;
        }else {
            $scope.noApp = false;
        }
    });

    // 点击领取
    $scope.receInLock = 0;
    clickToReceive = function(button){
        if($scope.receInLock == 1){
            return;
        }
        $scope.receInLock = 1;
        var actionId = button.getAttribute("data-id");
        var userReceiveAwardUrl = '/homePage/userReceiveAward';
        var transferMoney = {'actionId': actionId};

        $http.post(userReceiveAwardUrl, transferMoney).success(function(response){
            $scope.receInLock = 0;
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;
            if (response.errorId == 0){
                $scope.errorId = response.errorId;
                $scope.errorMsg = response.errorMsg;

                if(actionId == 'finishNoviceTask'){
                    $scope.noviceTaskObject.noviceTaskAcceptReward = -1;
                }else  if(actionId == 'uploadHaveReceive'){
                    $scope.noviceTaskObject.noviceReward = -1;
                }else if (actionId == 'inviteUserReward'){
                    $scope.noviceTaskObject.canReceive = 0;
                }else if (actionId == 'guideUserRewardYB'){
                    $scope.noviceTaskObject.successCanReceive = 0;
                }
            }
        })
    };

    // 新人
    var newUserURL = '/homePage/newUser';
    $http.get(newUserURL).success(function(response){
        $scope.userCanGetYbObject = response.userCanGetYbObject;
        if (response.errorId == 0){
            $scope.userCanGetYbObject = response.userCanGetYbObject;
        }
    });

    // 新人领取YB
    $scope.inLock = 0;
    userCanGetYB = function(a){
        if($scope.inLock == 1){
            return;
        }
        $scope.inLock = 1;
        var actionId = a.getAttribute("data-id");
        var userReceiveAwardUrl = '/homePage/userCanGetYB';
        var transferMoney = {'actionId': actionId};

        $http.post(userReceiveAwardUrl, transferMoney).success(function(response){
            $scope.inLock = 0;
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;
            if (response.errorId == 0){
                $scope.errorId = response.errorId;
                $scope.errorMsg = response.errorMsg;

                if(actionId == 'newUserOneGetYB'){
                    $scope.userCanGetYbObject.newUserOneGetYB = 'lala';
                    toastr.success('领取奖励成功,棒棒哒', {timeOut: 2000});

                }
                else if(actionId == 'newUserTwoGetYB'){
                    $scope.userCanGetYbObject.newUserTwoGetYB = 'lala';
                    toastr.success('领取奖励成功,棒棒哒', {timeOut: 2000});

                }
                else if (actionId == 'newUserThreeGetYB'){
                    $scope.userCanGetYbObject.newUserThreeGetYB = 'lala';
                    toastr.success('领取奖励成功,棒棒哒', {timeOut: 2000});

                }
                else if (actionId == 'canGet50YB'){
                    $scope.userCanGetYbObject.canGet50YB = 'lala';
                    toastr.success('领取奖励成功,棒棒哒', {timeOut: 2000});

                }
                else if (actionId == 'canGet100YB'){
                    $scope.userCanGetYbObject.canGet100YB = 'lala';
                    $scope.userCanGetYbObject = '';
                    toastr.success('领取奖励成功,棒棒哒', {timeOut: 2000});

                }
            }else {
                toastr.error(response.errorMsg);
            }
        })
    };

    var taskExpertURL = '/homePage/taskExpert';
    $http.get(taskExpertURL).success(function(response){
        $scope.noviceObject = response.noviceObject;
        if (response.errorId == 0){
            $scope.noviceObject = response.noviceObject;
            $scope.isTaskExpert = true;
        }
        else {
            $scope.isTaskExpert = response.isTaskExpert;
        }
    });

    $scope.receiveYCoin = function(){
        var luxuryURL = '/homePage/receiveYCoin';
        $http.post(luxuryURL, {}).success(function(response){
            $scope.luxuryMessage = response.errorMsg;
            $scope.luxurySucceed = response.errorId;
        })
    };
});