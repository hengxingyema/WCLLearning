/**
 * Created by cailong on 2016/11/22.
 */

var app=angular.module('yemaWebApp',[]);
var navIndex = 5;

app.controller('keywordsPackageCtrl', function($scope, $http, $location){

    // 获取用户填写信息
    var URL = '/keywordsPackage/getInfo';
    $http.get(URL).success(function(response){
        if (response.errorId == 0){
            $scope.userInfoObject = response.keywordsPackageObject;
        }
    });

    // 用户填写的内容保存到Object
    $scope.userInfoObject = Object();
    $scope.taskCountPerDayBatch = [1, 5, 10, 20, 50, 100];
    $scope.selectedTaskCountPerDay = 0;

    $scope.userInfoObject.appTrackName = $scope.appTrackName;
    $scope.userInfoObject.iTunesURL = $scope.iTunesURL;
    // 用户未选择默认是第一个
    $scope.taskCountPackageCount = $scope.taskCountPerDayBatch[0];

    // 套餐选中后高亮
    $scope.taskCountPerDayAction = function(selectedIndex){
        $scope.selectedTaskCountPerDay = selectedIndex;
        $scope.taskCountPackageCount = $scope.taskCountPerDayBatch[selectedIndex]
    };

    $scope.objectiveRanking = [3, 5, 10];
    $scope.selectedObjectiveRanking = 0;

    // 用户未选择默认是第一个
    $scope.objectiveRankingCount = $scope.objectiveRanking[0];

    // 目标排名选中后高亮
    $scope.objectiveRankingAction = function(index){
        $scope.selectedObjectiveRanking = index;
        $scope.objectiveRankingCount = $scope.objectiveRanking[index];
    };

    $scope.userInfoObject.onTheCycleStart = $scope.onTheCycleStart;
    $scope.userInfoObject.onTheCycleEnd = $scope.onTheCycleEnd;

    $scope.userInfoObject.userQQ = $scope.userQQ;
    $scope.userInfoObject.searchKeyWord = $scope.searchKeyWord;

    $scope.lockLoading = true;
    $scope.submitInfo = function(){

        $scope.userInfoObject.packageCount = $scope.taskCountPackageCount; // 套餐
        $scope.userInfoObject.rankingCount = $scope.objectiveRankingCount; // 目标排名

        $scope.lockLoading = false;
        var url = '/keywordsPackage/saveInfo';
        if ($scope.userInfoObject.appTrackName == undefined){
            $scope.lockLoading = true;
            toastr.error('请填写app的名字');
            return;
        }
        else if ($scope.userInfoObject.userQQ == undefined){
            $scope.lockLoading = true;
            toastr.error('请填写您的QQ号');
            return;
        }
        $http.post(url, {'userInfoObject':$scope.userInfoObject}).success(function(response){
            if (response.errorId == 0){
                $scope.errorId = response.errorId;
                $scope.errorMsg = response.errorMsg;
            }
        })
    }

});