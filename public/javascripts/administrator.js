/**
 * Created by cailong on 2016/11/23.
 */

var app = angular.module('yemaWebApp', ['ui.router']);

app.config(['$stateProvider','$urlRouterProvider',function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state('keyword',{
            url:'/',
            templateUrl:'/html/administrator-keyword.html',
            controller:'administratorCtrl'
        })
        .state('a',{
            url:'/a',
            templateUrl:'/html/administrator-keyword.html',
            controller:'administratorCtrl'
        });

    $urlRouterProvider.otherwise('/');     //匹配所有不在上面的路由
}]);


app.controller('administratorCtrl', function($scope, $http, $location){

    var keywordUrl = '/Administrator/keywordInfo';

    $http.get(keywordUrl).success(function(response){
        $scope.keywordInfoArray = response.keywordInfoArray;
    });

});