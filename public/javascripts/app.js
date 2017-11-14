/* Autor: Luis Bahamonde */

angular.module('starter',
    ['ionic', 'starter.controllers', 'starter.services', 'jett.ionic.filter.bar', 'ion-gallery',
     'jett.ionic.scroll.sista', 'ngIOS9UIWebViewPatch', 'ion-affix'])

.run(function($ionicPlatform) {

    $ionicPlatform.ready(function() {

        //setTimeout(function () {
        //    navigator.splashscreen.hide();
        //}, 2000);

        if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
            cordova.plugins.Keyboard.disableScroll(true);
        }
        if (window.StatusBar) {
            //StatusBar.styleDefault();
            StatusBar.styleLightContent();
        }

  });
})

    .directive('hideTabs', function($rootScope) {
        return {
            restrict: 'A',
            link: function(scope, element, attributes) {
                scope.$on('$ionicView.beforeEnter', function() {
                    scope.$watch(attributes.hideTabs, function(value){
                        $rootScope.hideTabs = value;
                    });
                });

                scope.$on('$ionicView.beforeLeave', function() {
                    $rootScope.hideTabs = false;
                });
            }
        };
    })

    .directive('rjCloseBackDrop', [function() {
        return {
            scope: false,//共享父scope
            restrict: 'A',
            replace: false,
            link: function(scope, iElm, iAttrs, controller) {
                //要在html上添加点击事件, 试了很久- -!
                var htmlEl = angular.element(document.querySelector('html'));
                htmlEl.on("click", function(event) {
                    if (event.target.nodeName === "HTML" &&
                        scope.popup.optionsPopup &&
                        scope.popup.isPopup) {
                        scope.popup.optionsPopup.close();
                        scope.popup.isPopup = false;
                    }
                });
            }
        };
    }])

    .directive('rjHoldActive', ['$ionicGesture', '$timeout',
        function($ionicGesture, $timeout, $ionicBackdrop) {
            return {
                scope: false,
                restrict: 'A',
                replace: false,
                link: function(scope, iElm, iAttrs, controller) {
                    $ionicGesture.on("hold", function() {
                        iElm.addClass('active');
                        //300ms后恢复
                        $timeout(function() {
                            iElm.removeClass('active');
                        }, 300);
                    }, iElm);
                }
            };
        }
    ])


.config(function($stateProvider, $urlRouterProvider, $ionicFilterBarConfigProvider, $ionicConfigProvider) {

        $ionicFilterBarConfigProvider.theme('light');
        $ionicFilterBarConfigProvider.clear('ion-close');
        $ionicFilterBarConfigProvider.search('ion-search');
        $ionicFilterBarConfigProvider.backdrop(true);
        $ionicFilterBarConfigProvider.transition('vertical');
        $ionicFilterBarConfigProvider.placeholder('Search...');

        $ionicConfigProvider.backButton.previousTitleText(false);
        $ionicConfigProvider.backButton.text('');



    $stateProvider

  .state('tab', {
    url: '/tab/home',
    abstract: false,
    templateUrl: 'templates/tab-home.html',
      controller: 'homeController'
  })
    .state('home-invite', {
        url: '/tab/home/:inviteCode',
        templateUrl: 'templates/tab-home.html',
        controller: 'homeController'
    })

    .state('tab-account',{ // 提现中心
        url:'/account',
        templateUrl: 'templates/tab-account.html',
        controller: 'AccountController'
    })
        .state('tab-QRCode', { // 二维码
            url:'/tab/home/a/qrCode',
            templateUrl:'templates/tab-QRCode.html',
            controller:'homeController'
        })
        .state('taskParticulars', { // 明细
            url:'/tab/home/account/taskParticulars',
            templateUrl:'templates/tab-detail.html',
            controller:'currentAssetDetailController'
        })
        .state('userMaterial', {  // 资料
            url:'/tab/home/account/userMaterial',
            templateUrl:'templates/tab-userMaterial.html',
            controller:'AccountController'
        })
        .state('otherInfo', {  // 其他
            url:'/tab/home/account/otherInfo',
            templateUrl:'templates/tab-otherInfo.html',
            controller:''
        })
            .state('customerServiceCenter', { // 客服中心
                url:'/otherInfo/customerServiceCenter',
                templateUrl:'templates/tab-customerServiceCenter.html'
            })
            .state('businessCooperation', { // 商务中心
                url:'/tab/home/otherInfo/businessCooperation',
                templateUrl:'templates/tab-businessCooperation.html'
            })
        .state('tab-withdrawalOption', { // 提现
            url:'/tab/home/account/withdrawalOption',
            templateUrl:'templates/tab-withdrawalOption.html',
            controller:'withdrawalOptionController'
        })
        .state('tab-PrepaidPhone', { // 手机充值
            url:'/tab/home/account/PrepaidPhone',
            templateUrl:'templates/tab-PrepaidPhone.html',
            controller:'withdrawalOptionController'
        })
        .state('aliPay', { // 支付宝
            url:'/tab/home/account/aliPay',
            templateUrl:'templates/tab-aliPay.html',
            controller:'withdrawalOptionController'
        })
    .state('taskHall', { // 快速任务
        url: '/tab/quickTaskHall',
        templateUrl: 'templates/tab-quickTask.html',
        controller: 'quickTaskController'
    })
        .state('task-quickTaskDetail', { // 快速任务详情
            url: '/quickTaskHall/quick/:taskId',
            templateUrl: 'templates/task-quickTaskDetail.html',
            controller: 'quickTaskDetailController'
        })
    .state('printScreenTask', { // 截图任务
        url: '/tab/printScreenTask',
        templateUrl: 'templates/tab-printScreenTask.html',
        controller: 'screenshotsTaskController'
    })
        .state('task-detail', { // 截图任务详情
            url: '/printScreenTask/:taskId',
            templateUrl: 'templates/task-detail.html',
            controller: 'TaskDetailController'
        })
        .state('task-submitAudit', { // 提交审核
            url: '/tab/submitAudit/:taskId',
            templateUrl: 'templates/task-submitAudit.html',
            controller: 'TaskDetailController'
        })
    .state('himselfApprentice', {  // 收徒任务
        url: '/tab/home/a/himselfApprentice',
        templateUrl: 'templates/tab-himselfApprentice.html',
        controller: 'homeController'
    })
        .state('enlighteningStrategy', { // 查看收徒攻略
            url:'/enlighteningStrategy',
            templateUrl:'templates/tab-enlighteningStrategy.html'
        })
    .state('newTaskHall', { // 新手任务
        url: '/tab/newTaskHall',
        templateUrl: 'templates/tab-newTaskHall.html',
        controller: ''
    })
    .state('theTaskReview', { // 审核中
        url: '/tab/theTaskReview',
        templateUrl: 'templates/tab-myTask.html',
        controller: 'MyTaskController'
    })
        .state('myTask-detail', {
            url: '/myTask/:taskId',
            templateUrl: 'templates/task-detail.html',
            controller: 'TaskDetailController'
        })
    .state('greatNumberTask', { // 高额任务
        url: '/tab/greatNumberTask',
        templateUrl: 'templates/tab-greatNumberTask.html',
        controller: 'highTaskDetailController'
    })
        .state('highTaskDetail', {  // 高额任务详情
            url: '/highTaskDetail',  // /:taskId
            templateUrl: 'templates/ask-highTaskDetail.html',
            controller: 'highTaskDetailController'
        })
        .state('submitAudit', { // 高额任务提交审核
            url: '/submitAudit',
            templateUrl: 'templates/task-submitAudit.html',
            controller: 'highTaskDetailController'
        })
    .state('lottery', { // 必中红包
        url: '/lottery',
        templateUrl: 'templates/tab-lottery.html',
        controller: 'LotteryController'
    })
        .state('lotteryManual', {
            url: '/manual',
            templateUrl: 'templates/tab-lotteryManual.html'
        })
        .state('lotteryResults', {
            url: '/results',
            templateUrl: 'templates/tab-lotteryResults.html',
            controller: 'lotteryResultsController'
        });


  //  .state('tab.home-invite', {
  //      url: '/home/:inviteCode',
  //      views: {
  //          'tab-home': {
  //              templateUrl: 'templates/tab-home.html',
  //              controller: 'homeController'
  //          }
  //      }
  //  })
  //      .state('tab.rmbDetail', {
  //          url: '/rmbDetail',
  //          views: {
  //              'tab-home': {
  //                  templateUrl: 'templates/tab-detail.html',
  //                  controller: 'currentAssetDetailController'
  //              }
  //          }
  //      })
  //.state('tab.taskHall', {
  //    url: '/taskHall',
  //    views: {
  //      'tab-taskHall': {
  //        templateUrl: 'templates/tab-taskHall.html',
  //        controller: 'TaskHallController'
  //      }
  //    }
  //  })
  //  .state('tab.task-detail', {
  //    url: '/task/:taskId',
  //    views: {
  //      'tab-taskHall': {
  //        templateUrl: 'templates/task-detail.html',
  //        controller: 'TaskDetailController'
  //      }
  //    }
  //  })
  //  .state('tab.myTask', {
  //      url: '/myTask',
  //      views: {
  //          'tab-myTask': {
  //              templateUrl: 'templates/tab-myTask.html',
  //              controller: 'MyTaskController'
  //          }
  //      }
  //  })
  //  .state('tab.myTask-detail', {
  //      url: '/myTask/:taskId',
  //      views: {
  //          'tab-myTask': {
  //              templateUrl: 'templates/task-detail.html',
  //              controller: 'TaskDetailController'
  //          }
  //      }
  //  })
  //.state('tab.account', {
  //      url: '/account',
  //      views: {
  //          'tab-account': {
  //              templateUrl: 'templates/tab-account.html',
  //              controller: 'AccountController'
  //          }
  //      }
  //});

  /*Si ninguno de los siguientes estados esta activo reenviar a /tab/agenda */
  $urlRouterProvider.otherwise('/tab/home');

});
