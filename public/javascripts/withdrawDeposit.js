/**
 * Created by cailong on 16/9/27.
 */

var app = angular.module('yemaWebApp', []);


app.controller('withdrawControl', function($scope, $http){

    $scope.classColor = true;
    $scope.colorClass = false;
    $scope.classORcolor = false;
    $scope.userWithdraw = function(withdrawCheckType){
        var url = 'withdrawDetail';
        $http.post(url, {'userWithdraw':withdrawCheckType}).success(function(response){
            $scope.tempUserInfoList = response.tempUserInfoList;
            if (response.errorId == 0){
                $scope.tempUserInfoList = response.tempUserInfoList;

                if (withdrawCheckType == '普通提现用户'){
                    $scope.classColor = true;
                    $scope.colorClass = false;
                    $scope.classORcolor = false;
                }
                else if (withdrawCheckType == '推广大使'){
                    $scope.classColor = false;
                    $scope.colorClass = true;
                    $scope.classORcolor = false;
                }
                else {
                    $scope.classColor = false;
                    $scope.colorClass = false;
                    $scope.classORcolor = true;
                }
            }
        });

    };

    $scope.userWithdraw('普通提现用户');

    $scope.playMoney = function(temp, $event){
        var btn = $event.target;
        btn.disabled = true;

        var playMoneyUrl = 'playMoney';
        var tempObject = {'tempUserId':temp.objectId, 'withdrawMoney':temp.withdrawMoney}
        $http.post(playMoneyUrl, tempObject).success(function(response){
            if (response.errorId == 0){
                btn.disabled = false;
                $scope.errorId = response.errorId;
                $scope.errorMsg = response.errorMsg;
                temp.withdrawMoney = 0;


            }

        })
    };
});

app.controller('withdrawAControl', function($scope, $http){
    $scope.effectiveUserList = [];
    function tempEffectiveUser(pageCount){
        var effectiveUrl = 'effectiveUser/' + pageCount;
        $http.get(effectiveUrl).success(function(response){
            if (response.errorId == 0){
                $scope.effectiveTempUserList = response.effectiveTempUserList;
                $scope.hasMore = response.hasMore;
                $scope.effectiveUserList = $scope.effectiveUserList.concat(response.effectiveTempUserList);
            }
        });
    }

    tempEffectiveUser(0);
    $scope.displayAll = function(){

        if($scope.effectiveUserList == undefined || $scope.effectiveUserList.length == 0){
            tempEffectiveUser(0);

        }else {
            if ($scope.hasMore == 1){
                tempEffectiveUser($scope.effectiveUserList.length);
            }
            else {
                $scope.isLoadingMyApp = false;
                $scope.noApp = false;
            }
        }
    };
});