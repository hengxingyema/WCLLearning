/**
 * Created by wujiangwei on 16/5/24.
 */
//设置cookie
function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;

    //debug
    console.log(document.cookie);
}
//获取cookie
function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) != -1) return c.substring(name.length, c.length);
    }
    return "";
}
//清除cookie not debug succeed
function clearCookie(name) {
    setCookie(name, "", -1);
}

function loadNav(){
    var username = decodeURI(getCookie('username'));
    console.log(username);
    var usernameHtml = document.getElementsByClassName('navbar-right')[0];
    console.log(usernameHtml);

    if (username == undefined || username.length == 0){
        console.log('no username');
        //not login home
        usernameHtml.innerHTML =
            '<li><a style="color:white" href="/user/login">登录</a></li>' +
            '<button type="button" class="btn btn-primary btn-sm navbar-btn" onclick="javascript:window.location.href=\'/user/register\'">快速注册</button>';
    }else {
        console.log('has username' + username);
        //other
        var userNameHtmlEle = document.getElementById('nav-username-display');
        if (userNameHtmlEle == undefined){
            console.log('username html exist,userNameHtmlEle = ' + userNameHtmlEle);
            usernameHtml.innerHTML =
                '<li><a id="nav-username-display" href="/user#/" style="color:#3498db"></a></li>';
        }

        document.getElementById('nav-username-display').innerHTML = username;
    }
}




