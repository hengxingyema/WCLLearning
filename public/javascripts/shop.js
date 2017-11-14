/**
 * Created by wujiangwei on 2016/10/27.
 */
var app=angular.module('yemaWebApp',[]);
var navIndex = 6;

// app.directive('onRepeatFinishedRender', function ($timeout) {
//     return {
//         restrict: 'A',
//         link: function (scope, element, attr) {
//             if (scope.$last === true) {
//                 $timeout(function () {
//                     //这里element, 就是ng-repeat渲染的最后一个元素
//                     scope.$emit('ngRepeatFinished', element);
//                 });
//             }
//         }
//     };
// });

app.filter('startFrom',function(){
    return function(inputArray, start){
        if(inputArray == undefined){
            return [];
        }
        var array = [];
        for(var i = start; i < inputArray.length; i++){
            array.push(inputArray[i]);
        }
        return array;
    }
});

app.controller('shopCtrl', function($scope, $http, $location, $q) {
    $scope.asoPlantTitle = '开始创建你的投放方案';
    $scope.isShowAsoAdvice = false;
    $scope.ASOHelpString = '查看ASO选词/优化建议';
    $scope.lookASOHelp = function () {
        $scope.isShowAsoAdvice = !$scope.isShowAsoAdvice;
        if($scope.isShowAsoAdvice == true){
            $scope.ASOHelpString = '隐藏ASO优化建议';
        }else {
            $scope.ASOHelpString = '查看ASO选词/优化建议';
        }
    };

    //已经计划表
    $scope.ASOPlanArray = [];
    var userPlansUrl = '/shop/getUserPlans';
    $http.get(userPlansUrl).success(function(response){
        if(response.errorId == 0){
            $scope.ASOPlanArray = response.ASOPlanArray;
            $scope.existDiscount = response.existDiscount;
        }else {
            toastr.error(response.message);
        }
    });

    // 保存内容object
    $scope.taskCountPerDayBatch = [10, 50, 100, 200, 500];
    $scope.selectedTaskCountPerDay = 0;

    $scope.shopASOBuyObject = Object();

    function initPlanParams() {
        $scope.shopASOBuyObject.limitRanking = 500;
        //$scope.shopASOBuyObject.needGet = 'needGet';
        $scope.shopASOBuyObject.needThird = 'needThird';
        $scope.shopASOBuyObject.formalCheck = 'formalCheck';
    }
    function resetShopAsoBuy() {
        $scope.shopASOBuyObject = {};
        $scope.selectedTaskCountPerDay = 0;
        $scope.shopASOBuyObject.taskCountPerDay = $scope.taskCountPerDayBatch[0];

        initPlanParams();
    }
    resetShopAsoBuy();


    //方案有没有被锁(自定义方案)
    $scope.isLockPlan = false;
    $scope.buy1111Download = function () {
        $scope.isLockPlan = true;

        $scope.asoPlantTitle = '请先选择你要投放的App';

        $scope.taskCountPerDayBatch = [1111];
        $scope.selectedTaskCountPerDay = 0;
        $scope.shopASOBuyObject.taskCountPerDay = 1111;

        $scope.taskLastDays = [1];
        $scope.shopASOBuyObject.limitRanking = 1111;
        $scope.shopASOBuyObject.taskType = '下载';
        $scope.shopASOBuyObject.needGet = 'needGet';
        $scope.shopASOBuyObject.price = 1888;

        if($scope.shopASOBuyObject.ranKing > $scope.shopASOBuyObject.limitRanking){
            $scope.ranKingErrorMsg = '关键词排名超出方案限制!';
            toastr.error('关键词排名超出方案限制!');
        }else {
            toastr.info('请先选择你要投放的App');
        }

        //额外要求
        $scope.taskExtraDemand('needThird');
        //$scope.taskExtraDemand('formalCheck');
    };

    //充值
    $scope.clickRecharge = 0;
    $scope.prepareRechargeCash = function () {
        $scope.clickRecharge = !$scope.clickRecharge;
    };

    //获取用户积分
    var userPointerUrl = '/shop/userPointer';
    $scope.userPointer = '??';
    $http.get(userPointerUrl).success(function(response){
        if(response.errorId == 0){
            $scope.userPointer = response.userPointer;
            $scope.cashMoney = response.cashMoney;
        }else {
            toastr.error(response.message);
        }
    });
    $scope.pointerItems = [];
    var pointers = [300, 400, 500, 1000];
    for(var i = 0; i < pointers.length; i++){
        var pointerItem = {};
        pointerItem.pointer = pointers[i];

        pointerItem.icon = '/images/shop/' + parseInt(pointerItem.pointer/100) + '.png';
        pointerItem.title = pointerItem.pointer / 10 + '元现金券';
        pointerItem.des = pointerItem.pointer + '积分';
        $scope.pointerItems.push(pointerItem);
    }

    $scope.exchange = function (pointer) {
        //兑换抵用券
        if(pointer > $scope.userPointer){
            toastr.error('积分不足');
            return;
        }

        var userYCoinGoodsUrl = '/shop/pointerBuyer';
        $http.post(userYCoinGoodsUrl, {'consumePointer' : pointer}).success(function(response){
            if(response.errorId != 0){
                toastr.error(response.message);
            }else {
                $scope.cashMoney += response.addCash;
                $scope.userPointer -= pointer;
                toastr.success(response.message);
            }
        });
    };

    //优化商品列表
    var asoRefineGoodUrl = '/shop/asoHistory';
    $scope.shopASOGoods = [];
    $scope.selectedAppASOGoodKeys = [];
    $http.get(asoRefineGoodUrl).success(function(response){
        if(response.errorId != 0){
            toastr.error(response.message);
        }else {
            $scope.shopASOGoods = response.shopASOGoods;
            if(response.shopASOGoods.length > 0){
                $scope.selectMyApp(0);
            }
        }
    });

    $scope.selectMyApp = function (selectedAppIndex) {
        $scope.selectedAppASOGoodKeys = $scope.shopASOGoods[selectedAppIndex].asoKeys;
        var appInfo = $scope.shopASOGoods[selectedAppIndex];

        if($scope.shopASOBuyObject.trackName != undefined && $scope.shopASOBuyObject.trackName != appInfo.trackName){
            //reset old
            resetShopAsoBuy();
        }

        $scope.shopASOBuyObject.appleId = $scope.shopASOGoods[selectedAppIndex].appleId;
        $scope.shopASOBuyObject.trackName = $scope.shopASOGoods[selectedAppIndex].trackName; // APP名字
        $scope.shopASOBuyObject.artworkUrl100 = $scope.shopASOGoods[selectedAppIndex].artworkUrl100; // APP Icon
        $scope.shopASOBuyObject.artworkUrl512 = $scope.shopASOGoods[selectedAppIndex].artworkUrl512; // APP Icon
        $scope.shopASOBuyObject.appObjectId = $scope.shopASOGoods[selectedAppIndex].appObjectId;  // appObjectId
        if($scope.selectedAppASOGoodKeys.length > 0){
            //默认选择第一个优化词
            $scope.shopASOBuyObject.asoKey = $scope.selectedAppASOGoodKeys[0];
            $scope.getKeyAsoRank();
        }
    };


    $scope.selectNewAsoKey = function (keyIndex) {
        $scope.shopASOBuyObject.asoKey = $scope.selectedAppASOGoodKeys[keyIndex];
        $scope.getKeyAsoRank();
    };

    $scope.getAsoRanking = -1;
    $scope.rankedAsoKey = undefined;
    $scope.rankedAppleId = undefined;
    var asoRankCanceler = $q.defer();
    $scope.getKeyAsoRank = function(){

        var url = 'myapp/asoRank';
        if($scope.shopASOBuyObject.asoKey == undefined || $scope.shopASOBuyObject.asoKey.length == 0){
            return;
        }
        //同一个App同一个词不重复请求
        if($scope.rankedAppleId == $scope.shopASOBuyObject.rankedAppleId && $scope.rankedAsoKey == $scope.shopASOBuyObject.asoKey && $scope.shopASOBuyObject.ranKing < 500){
            return;
        }

        if($scope.getAsoRanking == 1){
            //取消之前的aso请求!
            asoRankCanceler.resolve();
        }

        $scope.getAsoRanking = 1;
        $scope.ranKingErrorMsg = undefined;

        $scope.rankedAppleId = $scope.shopASOBuyObject.appleId;
        $scope.rankedAsoKey = $scope.shopASOBuyObject.asoKey;

        $http.post(url, {'asoWord': $scope.shopASOBuyObject.asoKey,
            'appleId': $scope.shopASOBuyObject.appleId,
            'maxASOKey' : $scope.shopASOBuyObject.limitRanking,
            timeout: asoRankCanceler.promise
        }).success(function(response) {

            if(response.errorId == 0){
                if(response.rankedAppleId == $scope.rankedAppleId){
                    $scope.shopASOBuyObject.ranKing = response.asoKeyRank;
                    if($scope.ranKing > $scope.shopASOBuyObject.limitRanking){
                        $scope.ranKingErrorMsg = '关键词排名超出方案限制!';
                    }else {
                        calTaskPerPrice();
                    }
                }
            }else {
                if(response.rankedAppleId == $scope.rankedAppleId) {
                    $scope.shopASOBuyObject.ranKing = 999;
                    $scope.ranKingErrorMsg = response.errorMsg;
                    toastr.error(response.errorMsg);
                }
            }
        })
            .error(function () {
                toastr.error('网络异常');
            })
            .finally(function () {
                $scope.getAsoRanking = 0;
            });
    };

    $scope.addNewAsoKey = function (e) {
        //添加新的词
        var keyCode = window.event ? e.keyCode : e.which;//获取按键编码
        if (keyCode == 13) {
            $scope.selectedAppASOGoodKeys.unshift($scope.newSelectedAppAsoKey);
            $scope.shopASOBuyObject.asoKey = $scope.newSelectedAppAsoKey;
            $scope.newSelectedAppAsoKey = '';
            $scope.getKeyAsoRank();
        }
    };

    //新增App
    $scope.isShopAddApp = false;
    $scope.shopAddApp = function (searchAppIndex) {
        var appInfo = $scope.searchApps[searchAppIndex];

        var shopAddAppUrl = 'myapp/shopAddApp';
        if($scope.isShopAddApp == true){
            toastr.info('稍等,在录入您的App信息');
            return;
        }
        $scope.isShopAddApp = true;

        $http.post(shopAddAppUrl, {'appInfo': appInfo}).success(function(response) {

            if(response.errorId == 0){
                $scope.selectedAppASOGoodKeys = [];

                if($scope.shopASOBuyObject.trackName != undefined && $scope.shopASOBuyObject.trackName != appInfo.trackName){
                    //reset old
                    resetShopAsoBuy();
                }

                $scope.shopASOBuyObject.appleId = appInfo.appleId;
                $scope.shopASOBuyObject.trackName = appInfo.trackName; // APP名字
                $scope.shopASOBuyObject.artworkUrl100 = appInfo.artworkUrl100; // APP Icon
                $scope.shopASOBuyObject.artworkUrl512 = appInfo.artworkUrl512; // APP Icon
                $scope.shopASOBuyObject.appObjectId = response.appObjectId;  // appObjectId
            }else {

                toastr.error(response.message);
            }
        })
            .error(function () {
                toastr.error('网络异常');
            })
            .finally(function () {
                $scope.isShopAddApp = false;
            });
    };

    $scope.isSearchApps = false;
    $scope.searchAppKeyword = undefined;
    $scope.searchNewApps = function (e) {
        var keyCode = window.event ? e.keyCode : e.which;//获取按键编码
        if (keyCode == 13) {

            if($scope.searchAppKeyword == undefined || $scope.searchAppKeyword.length == 0){
                return;
            }
            if($scope.isSearchApps == true){
                toastr.info('正在搜索名为 ' + $scope.searchAppKeyword + ' 的App');
                return;
            }

            $scope.searchApps = [];
            $scope.isSearchApps = true;

            var searchUrl = 'api/itunes/search/' + $scope.searchAppKeyword;
            $scope.progressNum = 100;

            console.log('--------- searchApp searchApp');
            $http.get(searchUrl).success(function (response) {
                console.log('searchApp' + response);

                $scope.searchApps = response.appResults;
                $scope.progressNum = 0;

                if (response.errorMsg.length > 0) {
                    $scope.isError = 1;
                    $scope.errorMsg = response.errorMsg;
                } else {
                    $scope.errorMsg = response.errorMsg;
                    $scope.isError = response.errorId != 0;

                    for (var i = 0; i < response.appResults.length; i++) {
                        var appRe = response.appResults[i];

                        appRe.isMine = false;
                        for (var j = 0; j < $scope.shopASOGoods.length; j++) {
                            var myApp = $scope.shopASOGoods[j];
                            if (myApp.appleId === appRe.appleId) {
                                appRe.isMine = true;
                                break;
                            }
                        }

                        //暂时不支持付费应用
                        if(appRe.formattedPrice != '免费'){
                            appRe.isMine = true;
                        }

                        if(appRe.isMine == false){
                            // $scope.searchApps.push(appRe);
                        }
                    }
                }
            })
                .finally(function () {
                    $scope.isSearchApps = false;
                });
        }
    };

    //$scope.shopASOBuyObject.needGet = 'needGet';
    $scope.shopASOBuyObject.taskCountPerDay = $scope.taskCountPerDayBatch[0];

    ////任务类型选择
    //$scope.shopTaskType = function(type){
    //    $scope.shopASOBuyObject.taskType = type;
    //
    //    calTaskPerPrice();
    //};
    //
    ////是否立投放
    //$scope.shopSendTaskType = function(type){
    //    $scope.shopASOBuyObject.sendType = type;
    //};

    // 投放量
    //$scope.taskCountPerDayAction = function(selectedIndex){
    //    $scope.selectedTaskCountPerDay = selectedIndex;
    //    $scope.shopASOBuyObject.taskCountPerDay = $scope.taskCountPerDayBatch[selectedIndex];
    //
    //    calTaskPerPrice();
    //};

    // 投放量
    $scope.customTaskCountPerDay = function () {
        $scope.shopASOBuyObject.taskCountPerDay = $scope.shopASOBuyObject.customDay;

        calTaskPerPrice();
    };

    // 排名
    $scope.rankingChange = function () {
        calTaskPerPrice();
    };

    //额外的任务要求
    $scope.taskExtraDemand = function (extraDemandId, e) {
        var isCheck = e == undefined ? true : e.currentTarget.checked;
        if (extraDemandId == 'needThird'){
            $scope.shopASOBuyObject.needThird = (isCheck == true) ? extraDemandId : undefined;
        }
        //else if (extraDemandId == 'formalCheck'){
        //    $scope.shopASOBuyObject.formalCheck = (isCheck == true) ? extraDemandId : undefined;
        //}
        //else if (extraDemandId == 'needGet'){
        //    $scope.shopASOBuyObject.needGet = (isCheck == true) ? extraDemandId : undefined;
        //}
        //else if (extraDemandId == 'comment4G'){
        //    $scope.shopASOBuyObject.comment4G = (isCheck == true) ? extraDemandId : undefined;
        //}

        calTaskPerPrice();
    };

    //投放时间
    $scope.selectTaskHour = function (taskHour) {
        $scope.shopASOBuyObject.taskHour = taskHour;
        calTaskPerPrice();
    };
    $scope.shopASOBuyObject.taskHour = 15;

    $scope.taskLastDays = [1, 2, 3];
    $scope.taskTotalDays = $scope.taskLastDays[0];
    $scope.shopASOBuyObject.taskLastDay = '';
    $scope.selectTaskLastDay = function (taskLastDay) {
        $scope.taskTotalDays = taskLastDay;
        calTaskPerPrice();
    };

    $scope.shopASOBuyObject.delayTaskDay = '';

    $scope.delayTaskDay = '今天';

    $scope.selectDelayTaskDay = function (delayTaskDay) {
        if (delayTaskDay == '今天'){
            $scope.shopASOBuyObject.delayTaskDay = 0;
            $scope.delayTaskDay = '今天';
        }
        else if (delayTaskDay == '明天'){
            $scope.shopASOBuyObject.delayTaskDay = 1;
            $scope.delayTaskDay = '明天';
        }
        else if (delayTaskDay == '后天'){
            $scope.shopASOBuyObject.delayTaskDay = 2;
            $scope.delayTaskDay = '后天';
        }
        else {
            $scope.shopASOBuyObject.delayTaskDay = 3;
            $scope.delayTaskDay = '三天后';
        }

    };

    //创建计划
    $scope.createAsoPlanLoading = true;
    $scope.createAsoPlan = function () {
        $scope.shopASOBuyObject.sendType = 'timer';
        $scope.shopASOBuyObject.taskType = '下载';

        $scope.shopASOBuyObject.taskLastDay = $scope.taskTotalDays;

        if ($scope.shopASOBuyObject.delayTaskDay == '' || $scope.shopASOBuyObject.delayTaskDay == undefined){
            $scope.shopASOBuyObject.delayTaskDay = 0;
        }
        $scope.createAsoPlanLoading = false;
        if($scope.shopASOBuyObject.ranKing == undefined || $scope.shopASOBuyObject.ranKing > 500){
            $scope.createAsoPlanLoading = true;
            toastr.error('关键词排名获取中，请稍等/或者排名超过了' + $scope.shopASOBuyObject.limitRanking + '名');
        }else if($scope.shopASOBuyObject.appObjectId == undefined || $scope.shopASOBuyObject.appObjectId == ''){
            $scope.createAsoPlanLoading = true;
            toastr.error('未成功选择App');
        }else if($scope.shopASOBuyObject.taskCountPerDay == undefined){
            $scope.createAsoPlanLoading = true;
            toastr.error('未填写任务条数');
        }
        else {
            //高排名需要的量级
            var tempASORanking = $scope.shopASOBuyObject.ranKing;
            var tempPerDayCount = $scope.shopASOBuyObject.taskCountPerDay;
            if(tempASORanking > 50){
                if(tempPerDayCount < 10){
                    $scope.createAsoPlanLoading = true;
                    toastr.info('关键词排名>50时单次投放量低于10是基本无效的，建议修改量级');
                    return;
                }
            }else if(tempASORanking > 100){
                if(tempPerDayCount < 20){
                    $scope.createAsoPlanLoading = true;
                    toastr.info('关键词排名>100时单次投放量低于20是基本无效的，建议修改量级');
                    return;
                }
            }else if(tempASORanking > 150){
                if(tempPerDayCount < 25){
                    $scope.createAsoPlanLoading = true;
                    toastr.info('关键词排名>150时单次投放量低于25是基本无效的，建议修改量级');
                    return;
                }
            }else if(tempASORanking > 200){
                if(tempPerDayCount < 30){
                    $scope.createAsoPlanLoading = true;
                    toastr.info('关键词排名>200时单次投放量低于30是基本无效的，建议修改量级');
                    return;
                }
            }

            var createAsoPlanURL = '/shop/createPlan';
            $http.post(createAsoPlanURL, {'createAsoPlanInfo': $scope.shopASOBuyObject})
                .success(function(response){
                    if (response.errorId == 0){
                        resetShopAsoBuy();

                        var existIndex = -1;
                        for(var i = 0; i < $scope.ASOPlanArray.length; i++){
                            if($scope.ASOPlanArray[i].planId == response.createdAsoPlan.planId){
                                existIndex = i;
                                break;
                            }
                        }
                        if(existIndex == -1){
                            $scope.ASOPlanArray.push(response.createdAsoPlan);
                        }else {
                            $scope.ASOPlanArray.splice(existIndex, 1);
                            $scope.ASOPlanArray.unshift(response.createdAsoPlan);
                        }

                        $scope.createAsoPlanLoading = true;
                        toastr.success(response.message, {timeOut: 2000});
                    }else {
                        toastr.error(response.message, {timeOut: 3000});
                    }
                })
                .finally(function () {
                    $scope.createAsoPlanLoading = true;
                });

        }
    };

    //计算单价
    function calTaskPerPrice() {
        var taskType = $scope.shopASOBuyObject.taskType;
        $scope.shopASOBuyObject.taskPrice = 2.2;

        //排名
        $scope.shopASOBuyObject.rankPriceString = '';

        var asoKeyRank = parseInt($scope.shopASOBuyObject.ranKing);
        if(asoKeyRank > 100){
            if(asoKeyRank > 100){

                if(asoKeyRank <= 500 && asoKeyRank >= 400 ){
                    //11.1 - 14.6
                    $scope.shopASOBuyObject.taskRankPrice = 0.6 + ($scope.shopASOBuyObject.ranKing - 100) * 0.035;
                    $scope.shopASOBuyObject.taskPrice += $scope.shopASOBuyObject.taskRankPrice;
                    $scope.shopASOBuyObject.rankPriceString = '100-500名:0.6+(0.035元*额外排名)/条';
                }
                else if(asoKeyRank < 400 && asoKeyRank >= 300 ){
                    //7 - 10.2
                    $scope.shopASOBuyObject.taskRankPrice = 0.6 + ($scope.shopASOBuyObject.ranKing - 100) * 0.032;
                    $scope.shopASOBuyObject.taskPrice += $scope.shopASOBuyObject.taskRankPrice;
                    $scope.shopASOBuyObject.rankPriceString = '100-400名:0.6+(0.032元*额外排名)/条';
                }
                else if(asoKeyRank < 300 && asoKeyRank >= 200 ){
                    //3.6 - 6.6
                    $scope.shopASOBuyObject.taskRankPrice = 0.6 + ($scope.shopASOBuyObject.ranKing - 100) * 0.03;
                    $scope.shopASOBuyObject.taskPrice += $scope.shopASOBuyObject.taskRankPrice;
                    $scope.shopASOBuyObject.rankPriceString = '100-300名:0.6+(0.03元*额外排名)/条';
                }else if(asoKeyRank < 200){
                    //0.6 - 2.6
                    $scope.shopASOBuyObject.taskRankPrice = 0.6 + ($scope.shopASOBuyObject.ranKing - 100) * 0.02;
                    $scope.shopASOBuyObject.taskPrice += $scope.shopASOBuyObject.taskRankPrice;
                    $scope.shopASOBuyObject.rankPriceString = '100-200名:0.6+(0.02元*额外排名)/条';
                }else {
                    //BUGBUG
                }
            }
        }else if($scope.shopASOBuyObject.ranKing > 40){
            $scope.shopASOBuyObject.taskRankPrice = ($scope.shopASOBuyObject.ranKing - 40) * 0.01;
            $scope.shopASOBuyObject.taskPrice += $scope.shopASOBuyObject.taskRankPrice;
            $scope.shopASOBuyObject.rankPriceString = '40-100名:+(0.01元*额外排名)/条';
        }

        //额外要求
        if($scope.shopASOBuyObject.needThird == 'needThird'){
            $scope.shopASOBuyObject.taskPrice += 0.2;
        }
        //if($scope.shopASOBuyObject.formalCheck == 'formalCheck'){
        //    $scope.shopASOBuyObject.taskPrice += 0.1;
        //}

        ////首次
        //if($scope.shopASOBuyObject.needGet == 'needGet'){
        //    $scope.shopASOBuyObject.taskPrice += 0.1;
        //}

        //if(taskType == '评论'){
        //    if($scope.shopASOBuyObject.comment4G == 'comment4G'){
        //        $scope.shopASOBuyObject.taskPrice += 0.1;
        //    }
        //}

        ////2016双11特殊活动
        //if($scope.existDiscount != true && $scope.shopASOBuyObject.sendType == 'timer' && $scope.shopASOBuyObject.taskType == '下载' && $scope.shopASOBuyObject.formalCheck == 'formalCheck' &&
        //    $scope.shopASOBuyObject.taskLastDay >= 3 && $scope.shopASOBuyObject.taskCountPerDay >= 30 && $scope.shopASOBuyObject.taskCountPerDay <= 50 &&
        //    $scope.shopASOBuyObject.ranKing >= 100 && $scope.shopASOBuyObject.ranKing <= 200
        //) {
        //    toastr.info('已经满足首次活动6折优惠条件，你看到的价格都已经是6折的价格!');
        //    $scope.shopASOBuyObject.calculateFavNum = 6;
        //    $scope.shopASOBuyObject.taskPrice = $scope.shopASOBuyObject.taskPrice * ($scope.shopASOBuyObject.calculateFavNum/10);
        //}
    }

    //默认官方审核
    $scope.taskExtraDemand('formalCheck');
    calTaskPerPrice();

    $scope.modifyPlan = function (planIndex) {
        //local
        $scope.shopASOBuyObject = $scope.ASOPlanArray[planIndex];

        $scope.shopASOBuyObject.calculateFavNum = $scope.shopASOBuyObject.planDisCount;
        $scope.getKeyAsoRank();

        calTaskPerPrice();
    };
    $scope.actionPlan = function (planIndex, actionId) {
        //hidden, stop, restart
        $scope.ASOPlanArray[planIndex].actionId = actionId;

        var createAsoPlanURL = '/shop/createPlan';
        $http.post(createAsoPlanURL, {'createAsoPlanInfo': $scope.ASOPlanArray[planIndex]})
            .success(function(response){
                if (response.errorId == 0){
                    if(actionId == 'stop' || actionId == 'restart' ){
                        toastr.success(response.message, {timeOut: 2000});
                    }else if(actionId == 'hidden'){
                        //下次不显示
                        toastr.success('下次进入该界面，将不在显示该计划', {timeOut: 2000});
                    }else {
                        toastr.success(response.message, {timeOut: 2000});
                    }
                    $scope.ASOPlanArray[planIndex].planStatus = actionId;

                }else {
                    toastr.error(response.message, {timeOut: 3000});
                }
            })
    };
    $scope.copyPlan = function (planIndex) {
        toastr.info('选择再次投放会重新计算该计划的开始时间');

        //local action
        var selectToCopyPlanObject = $scope.ASOPlanArray[planIndex];
        $scope.shopASOBuyObject = {};
        //copy object
        $.extend($scope.shopASOBuyObject, selectToCopyPlanObject);
        $scope.shopASOBuyObject.limitRanking = 500;
        $scope.shopASOBuyObject.destoryPlanId = $scope.shopASOBuyObject.planId;
        $scope.shopASOBuyObject.planId = undefined;
        initPlanParams();

        dealTaskCountPerDay();
        $scope.getKeyAsoRank();

        calTaskPerPrice();
    };

    // 更新App
    $scope.isLoadingApp = true;
    $scope.updateApp = function(appObjectId){
        $scope.isLoadingApp = false;
        $scope.errorMsg = "";
        var updateAppURL = '/myapp/UpdateApp';
        $http.post(updateAppURL, {'appObjectId':appObjectId}).success(function(response){
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;
            if (response.errorId == 0){
                $scope.errorMsg = response.errorMsg;
                $scope.isLoadingApp = true;
                $scope.appObjectId = appObjectId;
                toastr.success(response.errorMsg, {timeOut: 2000});
            }
            else {
                toastr.error(response.errorMsg);
            }
        })
    }
});