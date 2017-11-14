/**
 * Created by cailong on 16/5/20.
 */

var app = angular.module('yemaWebApp', ['ui.router']);

var navIndex = 7;
app.config(['$stateProvider','$urlRouterProvider',function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state('inform',{
            url:'/',
            templateUrl:'/html/userCenter-infor.html',
            controller:'userCenterCtrl'
        })
        .state('account',{
            url:'/account',
            templateUrl:'/html/userCenter-account.html',
            controller:'userCenterCtrl'
        })
        .state('inforManage',{
            url:'/inforManage',
            templateUrl:'/html/userCenter-inforManage.html',
            controller:'inforManageCtrl'
        })
        // 待开放
        .state('administrator',{
            url:'/administrator',
            templateUrl:'/html/userCenter-administrator.html',
            controller:'userCenterCtrl'
        })
        .state('taskHistory',{
        url:'/taskHistory',
        templateUrl:'/html/userCenter-taskHistory.html',
        controller:'taskHistoryCtrl'
    });


    //$urlRouterProvider.otherwise('/');     //匹配所有不在上面的路由
}]);

app.controller('inforManageCtrl', function($scope, $http){
    //*****helper function*********
    //date comparison
    $scope.userName = true;

    //初始
    $scope.YCoinMessages = [];
    $scope.totalMoney = 0;
    $scope.freezingMoney = 0;
    $scope.feedingMoney = 0;
    $scope.cashMessagesArray = [];

    var getMessageUrl;
    function getMessage(type){
        if (type == 'Y币流水'){
            getMessageUrl = '/user/userCenter/YCoinFlow/' + parseInt($scope.YCoinMessages.length/20);
        }
        else {
            getMessageUrl = '/user/userCenter/YCoinFlow/' + parseInt($scope.cashMessagesArray.length/20);
        }

        $http.post(getMessageUrl, {'checkType':type}).success(function(response){
            $scope.YCoinMessages = $scope.YCoinMessages.concat(response.YCoinMessages);
            $scope.totalMoney = response.totalMoney;
            $scope.freezingMoney = response.freezingMoney;
            $scope.feedingMoney = response.feedingMoney;



            if (type == 'Y币流水'){
                $scope.classColor = true;
                $scope.type = 'Y币流水';
            }
            else {
                $scope.classColor = false;
                $scope.type = '现金流水';
                $scope.cashMessagesArray = $scope.cashMessagesArray.concat(response.cashMessagesArray);
                $scope.projectSwingNow = response.projectSwingNow;
            }
        });
    }
    //
    //getMessage();

    $scope.nextPage = function(){
        getMessage();
    };

    $scope.classColor = true;
    $scope.checkType = function(cashType){
        getMessage(cashType);

    };

    $scope.checkType('Y币流水');
});

app.controller('userCenterCtrl', function($scope, $http,$location){
    //复制链接
    $scope.inviteUrl = "http://www.mustangop.com/user/register/" + getCookie("userIdCookie");

    $scope.copyUrl = function () {
        $('#btn').popover('toggle');
        var Url = document.getElementById("inviteUrlcopy");
        Url.select(); // 选择对象
        document.execCommand("Copy"); // 执行浏览器复制命令
    };

    $scope.addApp = function(id) {
        $('#'+ id).popover("toggle");
    };

    $scope.userName = true;
    $scope.userNickname = getCookie('uploadName');

    var userUrl = '/user/userCenter';
    $http.get(userUrl).success(function(response){
        $scope.PhoneNumber = response.personAPP;
        $scope.userReputation = response.userReputation;
        $scope.userNickname = response.userNickname;
        $scope.userQQ = response.userQQ;
        $scope.balance = response.balance;
        $scope.userFreezingYB = response.userFreezingYB;
        $scope.register_status = response.registerBonus;
        $scope.inviteCount = response.inviteCount;
        $scope.inviteSucceedCount = response.inviteSucceedCount;
        $scope.Administrator = response.Administrator;
    });

    $scope.preserve = function(){
        var userUrl = '/user/userSaveInfo';
        $http.post(userUrl,{'userNickname':$scope.userNickname, 'userQQ':$scope.userQQ}).success(function(response){
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;
            if (response.errorId == 0){
                //return to my App
                //location.href='/user';
            }
        })
    };

    // 跳转关键词套餐
    $scope.keywordsSubmit = function(){
        location.href='/Administrator';
    };

    // 跳转申述后台
    $scope.appealPlay = function(){
        location.href='interiorExcDetail/manager/revoke';
    };

    // 跳转提现后台
    $scope.AdministratorSubmit = function(){
        location.href = 'withdrawDeposit/app/manager';
    }
});

function logout(){
    clearCookie('userIdCookie');
    clearCookie('username');

    location.href='/';
}