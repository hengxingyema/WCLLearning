/**
 * Created by wujiangwei on 16/9/22.
 */

var app = angular.module('yemaWebApp', ['angularFileUpload']);
var navIndex = 3;

app.controller('revokeControl',function($scope, $http, $location){
    var appurlList = $location.absUrl().split('/');
    var excTaskId = appurlList[appurlList.length - 1];

    $scope.revokeMackList = [];

    var revolkeTaskUrl = 'revokeTaskList';
    $http.get(revolkeTaskUrl).success(function(response){
        if(response.errorId == 0){
            $scope.errorId = response.errorId;
            $scope.revokeMackList = response.revokeMackList;
        }

        if (response.errorId == -100){
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;
        }
    });

    var selectedRevokeItem;
    $scope.selectTask = function (revokeItem) {
        selectedRevokeItem = revokeItem;
    };

    $scope.revokeSucceed = function(revokeReason, $event){
        $event.target.disabled = true;
        var dealRevokeUrl = '/nextTaskCheck/accept/' + selectedRevokeItem.mackId;

        $http.post(dealRevokeUrl, {'revokeReason':revokeReason}).success(function(response){
            if(response.errorId != 0){
                toastr.error('操作失败', response.errorMsg);
            }else {
                selectedRevokeItem.revokeStatus = 'revokeSucceed';
                $("#myModal").modal('hide');
                toastr.success('申诉成功,给予做任务者Y币');
            }
            $event.target.disabled = false;
        });

    };

    $scope.revokeFailed = function(revokeFailure, $event){
        var dealRevokeUrl = 'revokeFailed';
        $event.target.disabled = true;

        $http.post(dealRevokeUrl, {'revokeId': selectedRevokeItem.revokeId, 'dealInfo':revokeFailure}).success(function(response){
            if(response.errorId != 0){
                toastr.error('驳回失败', response.errorMsg);
            }else {
                selectedRevokeItem.revokeStatus = 'revokeFailed';
                $("#myModal1").modal('hide');
                toastr.success('驳回成功');
            }

            $event.target.disabled = false;
        });

    };
});