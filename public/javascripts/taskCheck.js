var app=angular.module('yemaWebApp',[]);
var navIndex = 4;

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

app.controller('taskCheckCtrl', function($scope, $http, $location) {

    $('.message .close')
        .on('click', function() {
            $(this)
                .closest('.message')
                .transition('fade')
            ;
        })
    ;

    // var bannerurl = 'taskCheck/banner';
    // $http.get(bannerurl).success(function(response){
    //     $scope.bannerUrl = response.bannerUrl;
    // });

    //******************* 自动轮播 *************************
    // $("#myCarousel").carousel({
    //     interval:3000
    // });

    //*******************初始化 *************************
    $scope.isLoadingMyApp = true;
    $scope.currentTaskId = undefined;
    $scope.noApp = false;
    $scope.myObj = Object();

    $scope.taskTimeList = [];

    $scope.classColor = true;
    $scope.colorClass = false;

    $scope.sendTaskType = function(sendType){
        //App列表
        var appsUrl = '/myapp/angular';
        $http.get(appsUrl).success(function(response){
            $scope.myApps = response.myApps.sort(function(a, b){return a.createdAt >= b.createdAt});
        });

        $scope.loadTaskByApp = function (appleObjectId, selectedMenuIndex) {
            //all is all
            $scope.menuIndex = selectedMenuIndex;
            $scope.selectedAppObjectId = appleObjectId;

            getLeftMenuList($scope.selectedAppObjectId, sendType);
        };

        $scope.loadTaskByApp('all', -1);

        if (sendType == 'now'){
            getLeftMenuList($scope.selectedAppObjectId, sendType);
        }
        else {
            getLeftMenuList($scope.selectedAppObjectId);
        }

    };

    $scope.sendTaskType('now');
    //**************得到左侧控制器条目*******************
    function getLeftMenuList(appleObjectId, sendType) {
        if (sendType == 'now'){
            var taskUrl = '/taskCheck/releaseTaskList/' + appleObjectId;

            $http.get(taskUrl).success(function(response){
                $scope.isLoadingMyApp = false;
                $scope.classColor = true;
                $scope.colorClass = false;

                if (response.errorId == 0){
                    $scope.taskTimeList = response.taskTimeList;

                    if (response.taskTimeList != undefined && response.taskTimeList.length > 0){
                        $scope.selectedDate(0);

                        var preLoadDays = 10;
                        if($scope.selectTimeTask.taskIds.length > 20){
                            preLoadDays = 3;
                            toastr.warning('您的任务很多，加载速度慢，请耐心等待');
                        }else if($scope.selectTimeTask.taskIds.length > 10){
                            preLoadDays = 5;
                        }else if($scope.selectTimeTask.taskIds.length > 5){
                            preLoadDays = 8;
                        }

                        if(preLoadDays >= response.taskTimeList.length){
                            preLoadDays = response.taskTimeList.length;
                        }else {
                            toastr.info('默认显示最近' + preLoadDays + '天需要审核的任务哦');
                        }

                        preLoadTaskOverview(preLoadDays);
                    }
                    else {
                        //如果没有返回值, 需要在前端显示按钮
                        $scope.noApp = true;
                    }
                }
            });
        }
        else {
            var timerTaskUrl = '/taskCheck/timer/' + appleObjectId;

            $http.get(timerTaskUrl).success(function(response){
                $scope.isLoadingMyApp = false;
                $scope.classColor = false;
                $scope.colorClass = true;

                if (response.errorId == 0){
                    $scope.timerList = response.timerList;

                    if (response.timerList != undefined && response.timerList.length > 0){
                        $scope.timerSelectedDate(0);

                        var preLoadDays = 10;
                        if($scope.selectTimeTask.taskIds.length > 20){
                            preLoadDays = 3;
                            toastr.warning('您的任务很多，加载速度慢，请耐心等待');
                        }else if($scope.selectTimeTask.taskIds.length > 10){
                            preLoadDays = 5;
                        }else if($scope.selectTimeTask.taskIds.length > 5){
                            preLoadDays = 8;
                        }

                        if(preLoadDays >= response.timerList.length){
                            preLoadDays = response.timerList.length;
                        }else {
                            toastr.info('默认显示最近' + preLoadDays + '天需要审核的任务哦');
                        }

                        timerTaskOverview(preLoadDays);
                    }
                    else {
                        //如果没有返回值, 需要在前端显示按钮
                        $scope.noApp = true;
                    }
                }
            });
        }
    }

    //任务详情
    function preLoadTaskOverview(preCount) {
        //skip first one
        for (var i = 1; i < preCount; i++){
            var taskOverviewUrl = '/taskCheck/releaseTaskOverview';

            var forPreTimeTask = $scope.taskTimeList[i];

            forPreTimeTask.isLoading = true;
            (function (preTimeTask) {
                $http.post(taskOverviewUrl, {'taskIds' : preTimeTask.taskIds}).success(function(response){
                    preTimeTask.isLoading = false;
                    if (response.errorId == 0){
                        $scope.taskOverviewList = response.taskOverviewList;

                        for (var i = 0; i < $scope.taskOverviewList.length; i++){
                            var netObject = $scope.taskOverviewList[i];
                            for (var j = 0; j < preTimeTask.tasks.length; j++){
                                var dealObject = preTimeTask.tasks[j];

                                //merge data
                                if(dealObject.taskId == netObject.taskId){
                                    dealObject.taskOverview = netObject;

                                    preTimeTask.totalUploaded += dealObject.taskOverview.totalSubmited;
                                }
                            }
                        }

                        //sort
                        // preTimeTask.tasks.sort(function(a, b){return (a.taskOverview.totalSubmited < b.taskOverview.totalSubmited)});
                        preTimeTask.isLoaded = true;
                    }
                });
            })(forPreTimeTask);
        }
    }

    function timerTaskOverview(preCount) {
        //skip first one
        for (var i = 1; i < preCount; i++){
            var taskOverviewUrl = '/taskCheck/timerTask';

            var forPreTimeTask = $scope.timerList[i];

            forPreTimeTask.isLoading = true;
            (function (preTimeTask) {
                $http.post(taskOverviewUrl, {'taskIds' : preTimeTask.taskIds}).success(function(response){
                    preTimeTask.isLoading = false;
                    if (response.errorId == 0){
                        $scope.taskOverviewList = response.timerTaskOverviewList;

                        for (var i = 0; i < $scope.taskOverviewList.length; i++){
                            var netObject = $scope.taskOverviewList[i];
                            for (var j = 0; j < preTimeTask.tasks.length; j++){
                                var dealObject = preTimeTask.tasks[j];

                                //merge data
                                if(dealObject.taskId == netObject.taskId){
                                    dealObject.taskOverview = netObject;
                                }
                            }
                        }

                        preTimeTask.isLoaded = true;
                    }
                });
            })(forPreTimeTask);
        }
    }



    $scope.selectedDate = function (index) {
        $scope.taskIndex = index;
        $scope.selectTimeTask = $scope.taskTimeList[index];

        //请求用户选择的项目的数据
        var taskOverviewUrl = '/taskCheck/releaseTaskOverview';

        if($scope.selectTimeTask.isLoading == true || $scope.selectTimeTask.isLoaded == true){
            //have loaded
            return;
        }

        $scope.selectTimeTask.isLoading = true;
        $http.post(taskOverviewUrl, {'taskIds' : $scope.selectTimeTask.taskIds}).success(function(response){
            $scope.selectTimeTask.isLoading = false;
            if (response.errorId == 0){
                $scope.taskOverviewList = response.taskOverviewList;

                for (var i = 0; i < $scope.taskOverviewList.length; i++){
                    var netObject = $scope.taskOverviewList[i];
                    for (var j = 0; j < $scope.selectTimeTask.tasks.length; j++){
                        var dealObject = $scope.selectTimeTask.tasks[j];

                        //merge data
                        if(dealObject.taskId == netObject.taskId){
                            dealObject.taskOverview = netObject;

                            $scope.selectTimeTask.totalUploaded += dealObject.taskOverview.totalSubmited;
                        }
                    }
                }

                //sort
                // $scope.selectTimeTask.tasks.sort(function(a, b){return (a.taskOverview.totalSubmited < b.taskOverview.totalSubmited)});
                $scope.selectTimeTask.isLoaded = true;
            }
        });

    };

    $scope.timerSelectedDate = function (index) {
        $scope.taskIndex = index;
        $scope.selectTimeTask = $scope.timerList[index];

        //请求用户选择的项目的数据
        var taskOverviewUrl = '/taskCheck/timerTask';

        if($scope.selectTimeTask.isLoading == true || $scope.selectTimeTask.isLoaded == true){
            //have loaded
            return;
        }

        $scope.selectTimeTask.isLoading = true;
        $http.post(taskOverviewUrl, {'taskIds' : $scope.selectTimeTask.taskIds}).success(function(response){
            $scope.selectTimeTask.isLoading = false;
            if (response.errorId == 0){
                $scope.taskOverviewList = response.timerTaskOverviewList;

                for (var i = 0; i < $scope.taskOverviewList.length; i++){
                    var netObject = $scope.taskOverviewList[i];
                    for (var j = 0; j < $scope.selectTimeTask.tasks.length; j++){
                        var dealObject = $scope.selectTimeTask.tasks[j];

                        //merge data
                        if(dealObject.taskId == netObject.taskId){
                            dealObject.taskOverview = netObject;

                        }
                    }
                }

                //sort
                // $scope.selectTimeTask.tasks.sort(function(a, b){return (a.taskOverview.totalSubmited < b.taskOverview.totalSubmited)});
                $scope.selectTimeTask.isLoaded = true;
            }
        });

    };

    // 单条任务关闭
    var oneTaskOffLock = 0;
    $scope.oneTaskOff = function(taskId){
        if(oneTaskOffLock == 1){
            return;
        }
        oneTaskOffLock = 1;
        var oneTaskUrl = '/taskCheck/turnOffOneTask';
        $http.post(oneTaskUrl, {'taskId': taskId}).success(function(response){
            oneTaskOffLock = 0;
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;

            if (response.errorId != 0){
                $scope.errorMsg = response.errorMsg;
                $("#errorMsg").modal("show");
            }else {
                setTimeout(refresh, 100);
            }
            function refresh(){
                location.href = '/taskCheck/'
            }
        })
    };
    //***************撤销任务逻辑************************
    $scope.confirmCancel = function(taskId, sendType){
        if (sendType == 'now'){
            var url = '/taskCheck/cancelTask/' + taskId;
            $http.get(url).success(function(response){
                if (response.errorId == 0){
                    toastr.success('撤销任务成功', {timeOut: 2000});
                    //location.reload();
                }
                else {
                    toastr.error(response.errorMsg);
                }
            })
        }

        if (sendType == 'timer'){
            var undoTimerTaskURL = '/taskCheck/undoTimerTask';
            $http.post(undoTimerTaskURL, {'taskId':taskId}).success(function(response){

                if (response.errorId == 0){
                    toastr.success('撤销任务成功', {timeOut: 2000});
                }
                else {
                    toastr.error(response.errorMsg);
                }
            })
        }

    };

    //$scope.addApp=function(id) {
    //    $('#'+ id).popover("toggle");
    //};

    $scope.lookCheck = function(taskObjectId){
        window.open('/nextTaskCheck/' + taskObjectId);
    };

    $scope.timerLookCheck = function(taskId){
        var taskIDURL = '/taskCheck/oneTimerTask/' + taskId;
        $http.get(taskIDURL).success(function(response){
            if (response.errorId == 0){
                $scope.timerTaskObject = response.timerTaskObject;
            }
        })
    }
});
