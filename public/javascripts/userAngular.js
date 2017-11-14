/**
 * Created by cailong on 16/5/12.
 */

var app=angular.module('userAccountApp',[]);

app.controller('userAccountCtrl', function($scope, $http, $location) {
    $scope.displayMsg = function(){
        console.log($scope.errorMsg);
        if ($scope.errorMsg === "Could not find user") $(".alert").text("无法找到用户");
        else if($scope.errorMsg === "The username and password mismatch.") $(".alert").text("用户名与密码不符");
        else $(".alert").text($scope.errorMsg);
    };

    $scope.userRegister = function(){
        var registerUrl = '/user/register';

        //获取邀请ID
        console.log($location.absUrl());
        var registerParams = $location.absUrl().split("/");
        //删除并返回数组最后一个元素
        var inviteCode = registerParams.pop();
        if(inviteCode.length < 15){
            inviteCode = undefined;
        }

        $http.post(registerUrl, {'inviteCode': inviteCode, 'mobile': $scope.userMobile, 'password': $scope.userSecret, 'smsCode':$scope.userSmsCode}).success(function(response){
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;


            $scope.displayMsg();


            if (response.errorId == 0){
                //return to my App
                location.href='/homePage';
            }else {
                $scope.errorMsg = response.errorMsg;
            }
        });
    };

    $scope.userLogin = function(){
        var registerUrl = '/user/login';

        console.log($scope.userSmsCode);

        $http.post(registerUrl, {'mobile': $scope.userMobile, 'password': $scope.userSecret}).success(function(response){
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;
            $scope.displayMsg();

            if (response.errorId == 0){
                //return to my App
                location.href='/homePage';
            }
        });
    };

    $scope.getNewSmsCode = function(){
        // 有攻击隐患
        if ($scope.searchUrl != ''){

            var registerUrl = '/user/getNewSmsCode';

            console.log(registerUrl);

            $("#button1").prop("disabled", true);
            var seconds = 60;
            function countdown(seconds) {
                /* Exit if nothing to do */
                if (seconds === 0) {
                    $("#button1").attr("disabled", false);
                    $("#button1").text("重获验证码");
                    return;
                }

                $("#button1").text(seconds+"s后重试");
                seconds--;
                setTimeout(function () {countdown(seconds);}, 1000);
            }
            countdown(seconds);

            $http.post(registerUrl, {'mobile': $scope.userMobile, 'password': $scope.userSecret}).success(function(response){
                $scope.errorId = response.errorId;
                $scope.errorMsg = response.errorMsg;
                $scope.displayMsg();

            });
        }
    };

    $scope.newSecret = function(){
        var registerUrl = '/user/forgetSecret';
        console.log($scope.userSmsCode);

        $http.post(registerUrl, {'mobile': $scope.userMobile, 'smsCode':$scope.newSmsCode, 'newPassword':$scope.usernewSecret}).success(function(response){
            $scope.errorId = response.errorId;
            $scope.errorMsg = response.errorMsg;
            $scope.displayMsg();
            
            if (response.errorId == 0){
                //return to my App
                location.href='/user/login';
            }
            else {
                $scope.errorMsg = response.errorMsg;
            }
        });
    };
    //验证手机号码是否合法
    function validateMobile(mobile)
    {
        if(mobile.length == 0)
        {
            alert('手机号码未填写！');
            return false;
        }
        if(mobile.length!=11)
        {
            alert('请输入有效的手机号码！');
            return false;
        }

        var myreg = /^(((13[0-9]{1})|(15[0-9]{1})|(14[0-9]{1})|(17[0-9]{1})|(18[0-9]{1}))+\d{8})$/;
        if(!myreg.test(mobile))
        {
            alert('请输入有效的手机号码！');
            return false;
        }

        return true;
    }

    //验证码相关
    var handlerEmbed = function (captchaObj) {

        $("#getSmsBtn").click(function (e) {

            if ($scope.userMobile == undefined || $scope.userSecret == undefined){
                alert('手机号和密码必填哦');
                return;
            }

            //密码只能输入6-20个字母、数字、下划线
            var isMobileValid = validateMobile($scope.userMobile);

            if (isMobileValid == true){
                var patrn = /^(\w){6,20}$/;
                if (!patrn.exec($scope.userSecret)){
                    alert('密码由6-20个字母/数字或下划线组成')
                    return;
                }
            }else {
                return;
            }

            if (isMobileValid == true){
                var validate = captchaObj.getValidate();
                if (!validate) {
                    $("#notice")[0].className = "show";
                    setTimeout(function () {
                        $("#notice")[0].className = "hide";
                    }, 2000);
                }else {
                    //倒计时逻辑
                    $("#getSmsBtn").prop("disabled", true);
                    var seconds = 60;
                    function countdown(seconds) {
                        /* Exit if nothing to do */
                        if (seconds === 0) {
                            $("#getSmsBtn").attr("disabled", false);
                            $("#getSmsBtn").text("获取验证码");
                        }else {
                            $("#getSmsBtn").text(seconds+"s后重试");
                            seconds--;
                            setTimeout(function () {countdown(seconds);}, 1000);
                        }
                    }
                    countdown(seconds);

                    //发送客户端短信验证码校验逻辑
                    var registerUrl = '/user/getSmsCode';
                    var smsParams = {
                        // 传递验证码参数
                        geetest_challenge: validate.geetest_challenge,
                        geetest_validate: validate.geetest_validate,
                        geetest_seccode: validate.geetest_seccode,
                        'mobile': $scope.userMobile,
                        'password': $scope.userSecret
                    };
                    $scope.isError = 0;
                    $http.post(registerUrl, smsParams).success(function(response){

                        $scope.errorId = response.errorId;
                        //$scope.errorMsg = response.errorMsg;
                        if (response.errorMsg.length > 0){
                            $scope.isError = 1;
                            $scope.errorMsg = response.errorMsg;
                        }else {
                            $scope.isError = 0
                        }
                        $scope.displayMsg();
                    });
                }
            }
        });

        // 将验证码加到id为captcha的元素里
        captchaObj.appendTo("#embed-captcha");
        captchaObj.onReady(function () {
            $("#wait")[0].className = "hide";
        });
        // 更多接口参考：http://www.geetest.com/install/sections/idx-client-sdk.html
    };
    $.ajax({
        // 获取id，challenge，success（是否启用failback）
        url: "/user/pc-geetest/register?t=" + (new Date()).getTime(), // 加随机数防止缓存
        type: "get",
        dataType: "json",
        success: function (data) {
            // 使用initGeetest接口
            // 参数1：配置参数
            // 参数2：回调，回调的第一个参数验证码对象，之后可以使用它做appendTo之类的事件
            initGeetest({
                gt: data.gt,
                challenge: data.challenge,
                product: "embed", // 产品形式，包括：float，embed，popup。注意只对PC版验证码有效
                offline: !data.success // 表示用户后台检测极验服务器是否宕机，一般不需要关注
                // 更多配置参数请参见：http://www.geetest.com/install/sections/idx-client-sdk.html#config
            }, handlerEmbed);
        }
    });

});