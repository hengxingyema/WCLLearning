/**
 * Created by wujiangwei on 2016/11/7.
 */
var app=angular.module('yemaWebApp',[]);
var navIndex = 6;

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

app.controller('asoEffectCtrl', function($scope, $http, $location) {

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

    //App列表
    var appsUrl = '/myapp/angular';
    $http.get(appsUrl).success(function(response){
        $scope.myApps = response.myApps.sort(function(a, b){return a.createdAt >= b.createdAt});
    });

});
