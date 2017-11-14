/**
 * Created by cailong on 16/5/31.
 */

app.directive("thNav",function(){
    return {
        restrict: 'E',
        templateUrl: '/html/navbar.html',

        controller: function($scope, $element, $http){
            var indexUrl = '/index';

            loadNav();

            $scope.userObjectId = getCookie('userIdCookie');
            $scope.newUpdateTitle = 'ASO自助商城首冲特惠上线,冲3000得3520,价值1600条下载!';
            $scope.newUpdateKey = '2016_11_15';

            $scope.pendingCount = 0;
            $scope.totalNeedDoTask = 0;
            $scope.refusedCount = 0;
            $scope.homeNotice = '';

            if($scope.userObjectId != ''){
                //用户+拒绝任务相关
                $http.get(indexUrl).success(function(response){
                    //未做的
                    $scope.totalNeedDoTask = response.totalUndoCount + response.totalRefusedCount;
                    //被拒绝的
                    $scope.refusedCount = response.refusedCount;
                });

                //需要审核的任务条数相关
                var unCheckCountUrl = '/index/unCheckTaskCount';
                $http.get(unCheckCountUrl).success(function(response){
                    $scope.pendingCount = response.pendingCount;
                });

                var homeUrl = '/index/homeNotice';
                $http.get(homeUrl).success(function(response){
                    if(response.errorId == 0){
                        $scope.homeNotice = response.homeNotice;
                    }
                });
            }

            // $('.ui.accordion')
            //     .accordion()
            // ;

            if($scope.userObjectId != ''){
                $scope.closeNewTag0 = getCookie($scope.newUpdateKey);
            }else {
                $scope.closeNewTag0 = 1;
            }


            if($scope.closeNewTag0 == 1){
                document.getElementById("newFeature").style.display = "none";
            }else {
                $('.message .close')
                    .on('click', function() {
                        setCookie($scope.newUpdateKey, 1);

                        $(this)
                            .closest('.message')
                            .transition('fade')
                        ;
                    })
                ;
            }

            $scope.butdoTask = function(){
                location.reload();
            }
        }
    };
});

app.directive("thFooter",function(){
    return {
        restrict: 'E',
        templateUrl: '/html/footer.html',
        controller:function(){
//*****************************回到顶部****************************************
                var obtn = document.getElementById('btn');
                //获取页面可视区的高度
                var clientHeight=document.documentElement.clientHeight;
                var timer = null;
                var isTop = true;

                window.onscroll=function(){
                    var osTop=document.documentElement.scrollTop||document.body.scrollTop;
                    if (osTop >= clientHeight){
                        obtn.style.display="block"; //显示按钮
                    }else {
                        obtn.style.display="none"; //隐藏按钮
                    }
                    if (!isTop){
                        clearInterval(timer);
                    }
                    isTop = false;
                };
                obtn.onclick = function(){
                    //设置定时器
                    timer = setInterval(function(){
                        var osTop=document.documentElement.scrollTop||document.body.scrollTop;
                        var ispeed = Math.floor(-osTop / 6);
                        //获取滚动条距离顶部的高度
                        document.documentElement.scrollTop=document.body.scrollTop=osTop+ispeed;
                        isTop = true;
                        if(osTop == 0){
                            clearInterval(timer);
                        }
                    },30);
                }

            }
        }

});

app.controller('indexAppCtrl', function($scope, $http, $location){
    $scope.unreadNotice = false;
    $scope.chuxian = false;

    var index = navIndex;
    $scope.navShowIndex = index;
    $scope.myColors = ['white', 'white', 'white', 'white','white','white','white'];
    $scope.myColors[index] = '#3498db';

    $scope.logout = function(){
        clearCookie('userIdCookie');
        clearCookie('username');
        location.href='/';
    };
});

