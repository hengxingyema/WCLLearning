/**
 * Created by apple on 8/16/16.
 */
var app = angular.module('myApp', []);

app.controller('myCtrl', function($scope, $http, $location){
    $scope.currentTime = new Date();

    //请求所需要的全部数据
    var url = 'webAnalysis/webData';
    $http.post(url, {'currentTime': $scope.currentTime}).success(function(response){
        $scope.errorId = response.errorId;
        $scope.errorMsg = response.errorMsg;
        if ($scope.errorId == 0){
            $scope.totalUsers = response.totalUsers;
            $scope.totalReleaseTaskToday = response.totalReleaseTaskToday;
            $scope.totalReleaseTaskAmountToday = response.totalReleaseTaskAmountToday;
            $scope.releaseTaskUserIds = response.releaseTaskUserIds;

            $scope.totalReceiveTaskToday = response.totalReceiveTaskToday;
            $scope.totalReceiveTaskAmountToday = response.totalReceiveTaskAmountToday;
            $scope.receiveTaskUserIds = response.receiveTaskUserIds;
            $scope.totalReceiveTaskError = response.totalReceiveTaskError;
        }
    });
});