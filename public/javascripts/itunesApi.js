/**
 * Created by wujiangwei on 16/5/9.
 */


var app = angular.module('yemaWebApp', ['angularFileUpload']);

var navIndex = 2;


app.controller('itunesSearchControl', function($scope, $http,$location, FileUploader) {

    var url = 'myapp/verify';
    $scope.insufficientFund = false;

    $scope.inviteUrl = "http://www.mustangop.com/user/register/" + getCookie("userIdCookie");

    $scope.copyUrl = function () {
        $('#alert-btn').popover('toggle');
        var Url = document.getElementById("inviteUrlcopy");
        Url.select(); // 选择对象
        document.execCommand("Copy"); // 执行浏览器复制命令
    };

    $http.get(url).success(function(response) {
        $scope.isManager = response.isManager;
        $scope.usermoney = response.usermoney;
    });

    $scope.displayDemandTemplate = Object();
    $scope.displayDemandTemplate.excCount = '';
    $scope.displayDemandTemplate.excUnitPrice = '';

    //Y币商城
    var userYCoinGoodsUrl = '/shop/yCoinGoods';
    $scope.userYCoinGoods = [];
    $http.get(userYCoinGoodsUrl).success(function(response){
        if(response.errorId == 0){
            $scope.userYCoinGoods = response.userYCoinGoods;
        }else {
            toastr.error(response.message);
        }
    });


    //************* Helper Function ********************
    var demandList = [];
    function getDemandObject(appObjectId){
        for(var i = 0; i < demandList.length; i++){
            if(demandList[i].appObjectId == appObjectId){
                return demandList[i];
            }
        }

        return undefined;
    }
    //请求每个任务的任务需求, function封装

    function getDemand(){
        if ($scope.selectedApp == undefined){
            return;
        }

        var inlineAppTaskDemand = getDemandObject($scope.selectedApp.appObjectId);

        if(inlineAppTaskDemand != undefined){
            $scope.remarkChange();
            $scope.displayDemandTemplate = inlineAppTaskDemand;

            var appPriceStr = $scope.selectedApp.formattedPrice;
            if(appPriceStr != '免费') {
                toastr.info('付费游戏必须要首次下载');
            }

            $scope.calYCoin();

            //计算新的排名
            $scope.getKeyAsoRank();
            return;
        }

        var getneedUrl = '/myapp/getNeed/' + $scope.selectedApp.appObjectId;
        $http.get(getneedUrl).success(function (response) {

            response.appDemandInfo.appObjectId = $scope.selectedApp.appObjectId;
            demandList.push(response.appDemandInfo);

            $scope.displayDemandTemplate = response.appDemandInfo;
            var appPriceStr = $scope.selectedApp.formattedPrice;
            if(appPriceStr != '免费') {
                toastr.info('付费游戏必须要首次下载');
            }

            $scope.remarkChange();
            $scope.calYCoin();

            //计算新的排名
            //$scope.getKeyAsoRank();

            //获取用户账户余额
            var url = 'myapp/verify';
            $scope.insufficientFund = false;

            $http.get(url).success(function(response) {
                $scope.isManager = response.isManager;
                $scope.usermoney = response.usermoney;

                //核实该条任务Y Coin 够不够
                moneyCheck();
            });
        });
    }

    // 保存需求
    saveAction = function(){
        var btn = $("#saveReportForm");
        btn.button('loading');
        document.taskInfo.action="";
        document.taskInfo.submit();
    };

    //**************页面载入变量初始************************
    $scope.isLoadingMyApp = true;
    $scope.numOfApps = 10;  // > 5 不显示+号
    $scope.selectedApp = undefined;
    $scope.inviteCount = 0;

    function refreshAddBtn(){
        if($scope.inviteCount > $scope.myApps.length - 1){
            $("button.btn_addApp").attr('data-target', '#addApp_modal');
        }
        else {
            $("button.btn_addApp").attr('data-target', '#invite');
        }
    }
    //****************请求绑定的App条目***********************
    var appsUrl = 'myapp/angular';
    $scope.myApps = [];
    $http.get(appsUrl).success(function(response){
        //接收到服务器信息反馈
        $scope.isLoadingMyApp = false;
        $scope.numOfApps = response.myApps.length;
        $scope.inviteCount = response.inviteSucceedCount;
        $scope.Limit = response.Limit;
        if ($scope.numOfApps > 0) {
            //App排序
            $scope.myApps = response.myApps.sort(function(a, b){return a.createdAt > b.createdAt});

            refreshAddBtn();

            //默认选择第一个App
            $scope.selectedApp = $scope.myApps[0];
            $scope.isDisabled = false;
            getDemand();
        }
    });

    //*************************按键颜色切换*************************


    //选择App
    $scope.selectedAppFunc = function(app){
        //保存状态重新初始
        $scope.selectedApp = app;
        $scope.isDisabled = false;
        getDemand();
    };

    $scope.releaseTaskVideo=function(){
        $("#releaseTaskVideo").modal("hide");
        var myVideo=document.getElementById("release");
        myVideo.pause();
    };

    //Y币变动
    $scope.taskNumberChange = function(){
        //核实该条任务Y Coin 够不够
        var userInputNumb = document.getElementById("userInputNum").value;
        if (userInputNumb <= 0){
            $scope.userInputNum = true;
        }
        moneyCheck();
    };

    //*******************判断是下载还是评论****************
    $scope.down = false;

    // 评论需满50字
    $scope.checkBoxChange = function(checkboxId){
        if(document.getElementById(checkboxId).checked){
            $scope.displayDemandTemplate.excUnitPrice += 3;
            $scope.commentYCoin = true;
        }
        else{
            $scope.displayDemandTemplate.excUnitPrice -= 3;
            $scope.commentYCoin = false;
        }

        moneyCheck();
    };

    // 官方人工审核
    //$scope.needOfficalCheck = function(){
    //    if(document.getElementById("inlineCheckbox1").checked){
    //        $scope.displayDemandTemplate.excUnitPrice += 3;
    //        $scope.needOfficaCheckYCoin = true
    //    }
    //    else{
    //        $scope.displayDemandTemplate.excUnitPrice -= 3;
    //        $scope.needOfficaCheckYCoin = false
    //    }
    //
    //    moneyCheck();
    //};

    $scope.payUrl = $location.absUrl().replace(/myapp/, "user#/YRecharge");
    $scope.jumppay = function(){
        window.open($scope.payUrl);
    };

    $scope.homeUrl = $location.absUrl().replace(/myapp/, "home");
    $scope.jumphome = function(){
        window.location.href=$scope.homeUrl;
    };

    //搜索App
    $scope.progressNum = 0;
    var searchLocked = false;
    $scope.searchApp = function(){
        if ($scope.inviteCount < $scope.numOfApps) {
            $scope.invite1 = true;
            $scope.invite2 = false;
        }
        else {

            $scope.isError = 0;

            if ($scope.searchUrl != '' && searchLocked == false) {

                var searchUrl = 'api/itunes/search/' + $scope.searchKey;
                $scope.progressNum = 100;

                console.log('--------- searchApp searchApp');
                searchLocked = true;
                $http.get(searchUrl).success(function (response) {

                    searchLocked = false;
                    console.log('searchApp' + response);

                    $scope.appResults = response.appResults;
                    $scope.progressNum = 0;

                    if (response.errorMsg.length > 0) {
                        $scope.isError = 1;
                        $scope.errorMsg = response.errorMsg;
                    } else {
                        $scope.errorMsg = response.errorMsg;
                        $scope.isError = response.errorId != 0;

                        for (var i = 0; i < $scope.appResults.length; i++) {
                            var appRe = $scope.appResults[i];

                            appRe.isMine = false;
                            for (var j = 0; j < $scope.myApps.length; j++) {
                                var myApp = $scope.myApps[j];
                                if (myApp.appleId === appRe.appleId) {
                                    appRe.isMine = true;
                                    console.log(appRe.appleId + 'isMine');
                                    break;
                                }
                            }
                        }
                    }
                });
            }
        }

    };

    $scope.keySearchApp = function(e){
        var keycode = window.event?e.keyCode:e.which;
        if(keycode==13 ){
            $scope.searchApp();
        }
    };

    //监听popover
    $('body').on('click', function(event) {
        var target = $(event.target); // One jQuery object instead of 3

        // Compare length with an integer rather than with
        if (!target.hasClass('popover')
            && target.parent('.popover-content').length === 0
            && target.parent('.myPopover').length === 0
            && target.parent('.popover-title').length === 0
            && target.parent('.popover').length === 0 && target.attr("id") !== "folder") {
            $('#pupop').popover('hide');
        }
    });



    // 更新APP信息
    $scope.isLoadingApp=true;
    $scope.updateApp = function(appObjectId){
        $scope.isLoadingApp=false;
        $scope.errorMsg="";
        var updateAppURL = '/myapp/UpdateApp';
        $http.post(updateAppURL, {'appObjectId':appObjectId}).success(function(response){
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;
            if (response.errorId == 0){
                $scope.errorMsg = response.errorMsg;
                $scope.isLoadingApp = true;
                toastr.success(response.errorMsg, {timeOut: 2000});

                $scope.selectedApp.version = response.newAppObject.version;
                $scope.selectedApp.latestReleaseDate = response.newAppObject.latestReleaseDate;
                $scope.selectedApp.isUpdated = response.newAppObject.isUpdated;
                $scope.selectedApp.appleId = response.newAppObject.appleId;

            }else {
                toastr.error(response.errorMsg);
            }
        })
    };
    //

    //添加App
    $scope.chooseMyApp = function(appInfo){
        if(appInfo.isBinlding == true){
            //防止重复绑定
            return;
        }

        var searchUrl = 'myapp/add';
        appInfo.isBinlding = true;
        $http.post(searchUrl, {'appInfo':appInfo}).success(function(response){

            appInfo.isBinlding = false;

            if (response.errorId == 0 || response.errorId === undefined){
                appInfo.isMine = true;
                var flag = 0;
                //本地没有App, 初始Array
                if ($scope.myApps == undefined){
                    $scope.myApps = Array();
                }
                //myapp里面有了就不能重复添加
                for (var i = 0; i < $scope.myApps.length; i++){
                    var app = $scope.myApps[i];
                    if (app.appleId == appInfo.appleId){
                        flag = 1;
                        break;
                    }
                }

                if (flag == 0){
                    //默认选择的App是新添加的App
                    $scope.selectedApp = response.newApp;
                    $scope.isDisabled = false;

                    getDemand();
                    $scope.myApps.push(response.newApp);
                    console.log($scope.myApps);
                    $scope.numOfApps ++;

                    refreshAddBtn();
                }

                $scope.searchKey = '';
                $scope.appResults = [];
                $("#addApp_modal").modal('hide');

            }else {
                toastr.error(response.errorMsg);
                $scope.errorMsg = response.errorMsg;
            }
        });
    };

    //释放App
    $scope.releaseBtnClick = function(app){
        $scope.prepareReleaseApp = app;
    };

    $scope.releaseMyApp = function(){
        var searchUrl = 'myapp/delete';
        var appid = $scope.prepareReleaseApp.appleId;
        $http.post(searchUrl, {'appid':appid}).success(function(response){
            if (response.errorId == 0){
                console.log('remove app if');
                for (var i = 0; i < $scope.myApps.length; i++){
                    var app = $scope.myApps[i];
                    if (app.appleId == appid){
                        $scope.myApps.splice(i, 1);
                        refreshAddBtn();
                        break;
                    }
                }
            }else {
                $scope.errorMsg = response.errorMsg;
            }
            $scope.appResults = [];
            $scope.numOfApps --;
            if ($scope.numOfApps == 0){
                $scope.selectedApp = undefined;
                getDemand()
            }
            else {
                //如果删除的是之前选择的App, 默认App为第一个
                if ($scope.prepareReleaseApp == $scope.selectedApp){
                    $scope.selectedApp = $scope.myApps[0];
                    $scope.isDisabled = false;
                    getDemand();
                }
            }
        });
    };

    $scope.buttonCheck = true;

    var index = 3;
    addInput = function(){

        document.getElementById("inputTagsOne").innerHTML+='<div id="div_'+index+'">' +
            '<input name="text" name="text_'+index+'" type="text" value=""  />' +
            '<input type="button" value="删除"  onclick="del('+index+')"/></div>';
        index += 1;


        function del(o){
            document.getElementById("inputTagsOne").removeChild(document.getElementById("div_"+o));
        }
    };


    //radio切换
    $scope.change=false;
    $scope.radio=function(curre){
        if(document.getElementById('optionsRadios1').checked==true){
            $scope.change=true;
        }
        else{
            $scope.change=false;
        }
    };


    // 确认发布之后刷新界面
    $scope.Confirm = function(){
        //location.href="/doTask"
    };

    //验证表单
    $scope.color={
        "color" :"#3498db",
        "font-size":"14px"
    };

    function releaseTask(){
        var excCount = $scope.displayDemandTemplate.excCount;
        var excPrice = $scope.displayDemandTemplate.excUnitPrice;
        var gettaskURL = '/myapp/checkSendTask';
        $scope.errorMsg = "";
        var btn = $("#myButton");
        btn.button('loading');

        if (excCount > 0){
            $http.post(gettaskURL, {'excCount':excCount,'excPrice':excPrice}).success(function (response) {
                btn.button('reset');
                if (response.errorId == 0) {
                    $("#releaseTaskApp1").modal("show");
                }
                else if (response.errorId ==  -10){
                    $scope.errorMsg = response.errorMsg;
                    $("#releaseTaskApp").modal("toggle");
                }
                else {
                    $scope.errorMsg = response.errorMsg;
                    $("#releaseTaskApp2").modal("toggle");
                }

            })
        }else {
            $("#releaseTaskApp1").modal("show");
        }
    }


    $scope.canSendTask = function() {

        if (($scope.displayDemandTemplate.ranKing != undefined && $scope.displayDemandTemplate.ranKing < 200))
        {
            releaseTask()
        }

        else if($scope.displayDemandTemplate.ranKing == undefined || $scope.displayDemandTemplate.ranKing > 200){
            $scope.errorMsg = '排名无效(需在1-200之间,含200)';
            $("#releaseTaskApp2").modal("toggle");
        }


    };

    //提交成功关闭窗口
    closefun =function(response){
        //document.taskInfo.target="_blank";
        if ($scope.displayDemandTemplate.sendType != 'timer'){

        }
        else {
            var btn = $("#myButton");
            document.taskInfo.action="/myapp/task";
            document.taskInfo.submit();
            $('#releaseTaskApp1').modal('hide');
        }
    };

    $scope.needGetCheck = function($event){
        var checkbox = $event.target;

        if($scope.displayDemandTemplate.detailRem.indexOf('获取') != -1){
            $scope.displayDemandTemplate.needGet = true;
            toastr.error('备注中有获取字样,无法取消,请先修改备注');
            checkbox.checked = true;
        }else {

        }

        //$scope.displayDemandTemplate.needGet = (checkbox.checked ? 1: 0);
        $scope.calYCoin();
    };

    $scope.registerMethod = function(registerStyle){
        $scope.displayDemandTemplate.registerStatus = registerStyle;
        $scope.calYCoin();
        moneyCheck();
    };

    $scope.commentOver50 = function($event){
        var checkbox = $event.target;
        //$scope.displayDemandTemplate.needMoreReviewContent = (checkbox.checked ? 1: 0);
        $scope.calYCoin();
    };

    $scope.calYCoin = function(){
        var displayDemandTemplate = $scope.displayDemandTemplate;
        if(displayDemandTemplate == undefined){
            return;
        }

        //任务需求,换评,小马的金额计算
        function screenShotOneElement()
        {
            //rank
            if (displayDemandTemplate.ranKing >= 41 && displayDemandTemplate.ranKing <= 50){
                $scope.displayDemandTemplate.excUnitPrice += 1;
                $scope.rankExtraYCoin = 1;
            }
            else if(displayDemandTemplate.ranKing > 50){
                $scope.rankExtraYCoin = Math.ceil(1 + (displayDemandTemplate.ranKing - 50) * 0.5);
                $scope.displayDemandTemplate.excUnitPrice += $scope.rankExtraYCoin;
            }else {
                $scope.rankExtraYCoin = 0;
            }

            //need get
            if (displayDemandTemplate.needGet == true){
                $scope.displayDemandTemplate.excUnitPrice += 5;
            }
        }

        function screenShotTwoElement()
        {
            if (displayDemandTemplate.registerStatus == 'third'){
                $scope.displayDemandTemplate.excUnitPrice += 2;
            }
        }

        function screenShotThirdElement()
        {
            //评论标题
            if (displayDemandTemplate.reviewMustTitleKey != undefined && displayDemandTemplate.reviewMustTitleKey != ""){
                $scope.displayDemandTemplate.excUnitPrice += 1;
                $scope.mustTitleExtraYB = 1;
            }else {
                $scope.mustTitleExtraYB = 0;
            }

            if (displayDemandTemplate.reviewMustContentKey != undefined && displayDemandTemplate.reviewMustContentKey != ""){
                $scope.displayDemandTemplate.excUnitPrice += 1;
                $scope.mustContentExtraYB = 1;
            }else {
                $scope.mustContentExtraYB = 0;
            }

            if (displayDemandTemplate.needMoreReviewContent == true){
                $scope.displayDemandTemplate.excUnitPrice += 3;
            }
        }

        if (displayDemandTemplate.taskType == '评论' || displayDemandTemplate.taskType == '定制评论'  ){
            $scope.displayDemandTemplate.excUnitPrice = 30;
        }else {
            $scope.displayDemandTemplate.excUnitPrice = 20;
        }

        //App价格
        var appPriceStr = $scope.selectedApp.formattedPrice;
        var appPrice = parseFloat(appPriceStr.substring(1, appPriceStr.length));
        if(appPriceStr != '免费') {
            //付费应用必须要获取
            displayDemandTemplate.needGet = true;
            //广告主付费
            displayDemandTemplate.excUnitPrice += appPrice * 15;
        }

        screenShotOneElement();

        screenShotTwoElement();
        if (displayDemandTemplate.taskType == '评论'){
            screenShotThirdElement();
        }

        moneyCheck();
    };


    function moneyCheck(){
        var excCount = $scope.displayDemandTemplate.excCount;
        if(excCount != undefined && excCount > 0){
            var excUnitPrice = $scope.displayDemandTemplate.excUnitPrice;
            var taskMoney = excCount * excUnitPrice;
            if(taskMoney > $scope.usermoney){
                $scope.insufficientFund = true;
                console.log('money ' + $scope.usermoney + 'not enough, need ' + excUnitPrice + ', total' + taskMoney);
            }
            else{
                $scope.insufficientFund = false;
                console.log('money ' + $scope.usermoney + 'not enough, need ' + excUnitPrice + ', total' + taskMoney);
            }
        }
    }

    $scope.remarkChange = function(){
        if($scope.displayDemandTemplate.detailRem != undefined && $scope.displayDemandTemplate.detailRem.indexOf('获取') != -1){
            $scope.displayDemandTemplate.needGet = true;
            toastr.warning('需求获取(首次下载),+5Y币');
        }

        $scope.calYCoin();
    };

    //是否立投放
    $scope.shopSendTaskType = function(type){
        $scope.displayDemandTemplate.sendType = type;
    };

    // 投放数量
    $scope.amountPerDayCount = function(){
        $scope.displayDemandTemplate.excCount = $scope.displayDemandTemplate.amountPerDay;
        $scope.calYCoin();
        if ($scope.displayDemandTemplate.taskType == '评论' || $scope.displayDemandTemplate.taskType == '定制评论'  ){
            $scope.displayDemandTemplate.excUnitPrice = ($scope.displayDemandTemplate.excUnitPrice - 30) + ($scope.displayDemandTemplate.amountPerDay * 30)
        }else {
            $scope.displayDemandTemplate.excUnitPrice = ($scope.displayDemandTemplate.excUnitPrice - 20) + ($scope.displayDemandTemplate.amountPerDay * 20)
        }
    };

    putPeriodDate = function(){
        $scope.displayDemandTemplate.putumber = document.getElementById('sect').value;
        console.log('--------' + $scope.displayDemandTemplate.period);
    };

    putPeriod = function(){
        $scope.displayDemandTemplate.period = document.getElementById('sect').value;
        console.log('--------' + $scope.displayDemandTemplate.period);
    };

    putDate = function(){
        $scope.displayDemandTemplate.startDate = document.getElementById('date').value;
        console.log('--------' + $scope.displayDemandTemplate.startDate);
    };

    $scope.createAsoPlan = function () {
        if($scope.displayDemandTemplate.planName == undefined || $scope.displayDemandTemplate.planName == ''){
            toastr.error('还没有为你的投放方案取名哦');
        }else if($scope.displayDemandTemplate.taskType == undefined){
            toastr.error('请选择任务类型');
        }else if($scope.displayDemandTemplate.ranKing == undefined || $scope.displayDemandTemplate.ranKing > 500){
            toastr.error('关键词排名获取中，请稍等/或者排名超过了' + $scope.shopASOBuyObject.limitRanking + '名');
        }else if($scope.displayDemandTemplate.sendType != 'timer'){
            toastr.error('未选择投放方式(定时投放)');
        }
        else {

            //评论检查
            if($scope.displayDemandTemplate.taskType == '定制评论') {
                if($scope.displayDemandTemplate.reviewHeaderOptions == undefined || $scope.displayDemandTemplate.reviewHeaderOptions == ''){
                    $scope.createAsoPlanLoading = true;
                    toastr.error('评论标题关键词未填写');
                    return;
                }
            }

            if($scope.displayDemandTemplate.sendType == '评论') {
                if($scope.displayDemandTemplate.reviewMustTitleKey == undefined || $scope.displayDemandTemplate.reviewMustTitleKey == ''){
                    toastr.error('评论标题关键词未填写');
                    return;
                }
                if($scope.displayDemandTemplate.reviewMustContentKey == undefined || $scope.displayDemandTemplate.reviewMustContentKey == ''){
                    toastr.error('评论内容关键词未填写');
                    return;
                }
            }

            var createAsoPlanURL = '/myapp/createPlan';
            $http.post(createAsoPlanURL, {'createAsoPlanInfo': $scope.displayDemandTemplate})
                .success(function(response){
                    if (response.errorId == 0){
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

    $scope.focuskey = function () {
        $scope.getAsoRanking = -1;
    };

    $scope.getAsoRanking = -1;
    $scope.getKeyAsoRank = function(){
        var url = 'myapp/asoRank';
        if($scope.getAsoRanking == 1 || $scope.displayDemandTemplate.searchKeyword == undefined || $scope.displayDemandTemplate.searchKeyword.length == 0){
            return;
        }
        $scope.getAsoRanking = 1;
        $scope.displayDemandTemplate.ranKingErrorMsg = undefined;

        $http.post(url, {'asoWord': $scope.displayDemandTemplate.searchKeyword, 'appleId': $scope.selectedApp.appleId}).success(function(response) {

            if(response.errorId == 0){
                $scope.displayDemandTemplate.ranKing = response.asoKeyRank;
                $scope.displayDemandTemplate.ranKingErrorMsg = undefined;
                $scope.calYCoin();
            }else {
                $scope.displayDemandTemplate.ranKing = 999;
                $scope.displayDemandTemplate.ranKingErrorMsg = response.errorMsg;
                toastr.error(response.errorMsg);
            }
        })
            .error(function () {
                toastr.error('未找到该词');
            })
            .finally(function () {
                $scope.getAsoRanking = 0;
            });
    };

    $scope.addApp = function(id) {
        if (id == 'glyphicon'){
            $('#'+ id).popover("toggle");
        }else {
            $('#'+ id).popover("toggle");
        }
    };

    var heightOfNav = 51;
    var height = $(window).innerHeight() - heightOfNav;
    $scope.shadow = true;
    console.log(height);
    $.fn.smartFloat = function() {
        var position = function(element) {
            $(window).scroll(function() {
                var scrolls = $(window).scrollTop();
                if (scrolls > 330 || scrolls == undefined) {
                    $scope.shadow = false;
                    if (window.XMLHttpRequest) {
                        $scope.shadow = true;
                        element.css({
                            position: "fixed",
                            top: 50,
                            'box-shadow': '0 2px 5px #b2b2b2'
                        });
                    } else {
                        element.css({
                            top: scrolls,
                            'box-shadow': '0 0 0'
                        });
                    }
                }else {
                    element.css({
                        position: "relative",
                        top: 0,
                        'box-shadow': '0 0 0'
                    });
                }
            });
        };
        return $(this).each(function() {
            position($(this));
        });
    };
    $("#float").smartFloat();


    $scope.addModal = function(){
        $('.ui.modal')
            .modal('show')
        ;
    };

    $('.small.test.modal')
        .modal('show')
    ;

    /*
     * 以下逻辑处理自定义标题和评论内容excel表的上传逻辑.excel表内容无法在前段浏览器读取.必须
     * 上传至服务器读取后在进行返回.
     */

    $scope.excelUploaded = false;
    var headerArray;
    var contentArray;
    $scope.jsonLength = 0;

    //upload file
    var uploader = $scope.uploader = new FileUploader({
        url: '/upload/excel',
        queueLimit: 1,
        removeAfterUpload:true
    });

    var fileUrls = Array();

    uploader.onAfterAddingFile = function (fileItem) {

    };

    uploader.onAfterAddingAll = function (addedFileItems) {
        uploader.uploadAll();
    };

    uploader.onProgressAll = function (progress) {
    };
    uploader.onSuccessItem = function (fileItem, response, status, headers) {
        //response包括了parse好的评论表和评论表条数,保存在前段服务器
        $scope.excelUploaded = true;
        headerArray = response.header;
        contentArray = response.content;
        $scope.displayDemandTemplate.reviewHeaderOptions = headerArray.join("|");
        $scope.displayDemandTemplate.reviewContentOptions = contentArray.join("|");
        $scope.jsonLength = response.length;
    };
    uploader.onErrorItem = function (fileItem, response, status, headers) {
        $scope.errorId = 1;
        $scope.errorMsg = '上传excel失败';
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
            $scope.errorMsg = 'excel上传失败,刷新网页重新上传';
        }

    };
    uploader.onCompleteAll = function () {
        console.info('onCompleteAll');
    };

});

