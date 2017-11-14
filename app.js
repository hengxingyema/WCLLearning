'use strict';
var domain = require('domain');
var express = require('express');
var timeout = require('connect-timeout');
var path = require('path');
var ejs = require('ejs');
var fs= require('fs');
var _ = require('underscore');

//监控服务器异常
//require('newrelic');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var busboy = require('connect-busboy');
var cloud = require('./cloud');

var hook = require('./utils/hook');

var customUtil = require('./routes/util');
// 挂载子路由
var api = require('./routes/api');//for html js api request
var users = require('./routes/users');//user account and info center
var userApps = require('./routes/myApp');//user app related center

var loadHtml = require('./routes/loadHtml');//load static html
var index = require('./routes/index');
var doTask = require('./routes/doTask');
var taskCheck = require('./routes/taskCheck');
var taskInfor = require('./routes/taskInfor');
var alipay = require('./routes/pay');
var myClaim = require('./routes/myClaimApi');
var newtaskMobile = require('./routes/newtaskMobApi');
var interiorExcDetail = require('./routes/interiorExcDetailApi');
var userProtocol = require('./routes/userProtocol');
var handBook = require('./routes/handBook');
var contactUs = require('./routes/contactUs');
var guide = require('./routes/guide');
var webAnalysis = require('./routes/webAnalysis');
var homePage = require('./routes/homePageApi');
var nextTaskCheck = require('./routes/nextTaskCheckApi');
var shop = require('./routes/shop');
var asoEffect = require('./routes/asoEffect');
var keywordsPackage = require('./routes/keywordsPackageApi');
var jifenqiangApi = require('./routes/jifenqiangApi');
var quickTaskHall = require('./routes/quickTaskApi');

var Administrator = require('./routes/administratorApi');

//申请提现后台
var withdrawDeposit = require('./routes/withdrawDepositApi');

//小马试客
var taskUsers = require('./routes/taskUsers');
var taskHall = require('./routes/taskHall');
var taskUserDetails = require('./routes/currentAssetDetail');

var printScreenTask = require('./routes/screenshotTaskApi');
var withdrawalRelated = require('./routes/withdrawalRelatedApi');

var lottery = require('./routes/lottery');
var lotteryResults = require('./routes/lotteryResults');

var app = express();

// 设置 view 引擎
app.set('views', path.join(__dirname, 'views'));
app.engine('.html', ejs.__express);
app.set('view engine', 'html');
app.use(express.static('public'));
app.use(express.static('lib'));

app.use(express.static('bower_components'));
app.use(require('leanengine-apm').express());


//接口强制超时
app.use(timeout('45s'));
// 加载云代码方法
require('./utils/hook');
// 加载hook函数
require('./cloud');

// 使用 LeanEngine 中间件
// （如果没有加载云代码方法请使用此方法，否则会导致部署失败，详细请阅读 LeanEngine 文档。）
var AV = require('leanengine');
app.use(AV.express());

app.use(busboy());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

function getClientIp(req) {
    return req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;
}

// 未处理异常捕获 middleware
app.use(function(req, res, next) {
    var d = null;
    if (process.domain) {
        d = process.domain;
    } else {
        d = domain.create();
    }
    d.add(req);
    d.add(res);
    d.on('error', function(err) {
        console.error('---------- uncaughtException originalUrl=%s, param=%s, body=%s, msg=%s, IP=%s', req.originalUrl, JSON.stringify(req.params), JSON.stringify(req.body), err.stack || err.message || err, getClientIp(req));
        if(!res.finished) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=UTF-8');
            res.end('uncaughtException');
        }
    });
    d.run(next);
});

function routeHasPrefix(originalUrl, judgeArray){
    for (var i = 0; i < judgeArray.length; i++){
        var judgeStr = judgeArray[i];
        if (originalUrl.length >= judgeStr.length) {
            var judgePre = originalUrl.substr(0, judgeStr.length);
            if (judgePre == judgeStr) {
                return true;
            }
        }
    }

    return false;
}

var blackIPAddress = [];

// 没有挂载路径的中间件，应用的每个请求都会执行该中间件
app.use(function (req, res, next) {

    if(_.indexOf(blackIPAddress, getClientIp(req)) >= 0){
        res.json({'errorMsg':'访问过于频繁，请确认是妹子在访问', 'errorId': 9999});
        return;
    }

    var loginWhiteList  =  Array();
    loginWhiteList.push("/home");
    loginWhiteList.push("/user");
    loginWhiteList.push("/upload");
    loginWhiteList.push("/pay");
    loginWhiteList.push("/html");

    loginWhiteList.push("/myClaim");
    loginWhiteList.push("/newtaskMobile");
    loginWhiteList.push("/interiorExcDetail");
    loginWhiteList.push("/doTask");
    loginWhiteList.push("/webAnalysis");
    loginWhiteList.push('/keywordsPackage');

    //小马App
    loginWhiteList.push("/app");
    loginWhiteList.push("/templates");
    loginWhiteList.push("/taskUser");
    loginWhiteList.push("/taskHall");
    loginWhiteList.push("/printScreenTask");
    loginWhiteList.push('/withdrawalRelated');
    loginWhiteList.push('/jifenqiangApi');
    loginWhiteList.push('/quickTaskHall');

    //奖池接口设计
    loginWhiteList.push('/lottery');


    var needLogin = !routeHasPrefix(req.originalUrl, loginWhiteList);

    //console.log('---------- ', req.originalUrl, needLogin);

    //不是主页,也不是以白名单开头的网页,则是需要用户先登陆的网站
    if (req.originalUrl.length > 1 && needLogin){
        //获取cookie的值
        var encodeUserId = req.cookies.userIdCookie;

        //鉴别cookie是否存在
        if ('undefined' === (typeof req.cookies.userIdCookie)){
            res.render('login');
        }else {
            if (encodeUserId.length > 0){
                next();
            }else {
                res.render('login');
            }
        }
    }else {
        //console.log('---------- next');
        next();
    }
});

app.get('/', function(req, res) {
    res.render('index', { currentTime: new Date() });
});

app.get('/apple-app-site-association', function(req, res) {
    res.status(200);
    // res.writeHead(200, {"Content-Type": "application/json"});
    res.download("./apple-app-site-association");

    // fs.readFile("./apple-app-site-association", "binary", function(err, file) {
    //     res.status(200);
    //     res.writeHead(200, {"Content-Type": "application/json"});
    //     if(err) {
    //         res.write(err + "\n");
    //         res.end();
    //     } else {
    //         res.write(file, "binary");
    //         res.end();
    //     }
    // });

});

app.post('/upload/img', function(req, resp) {
    customUtil.postFile(req, resp);
});

app.post('/upload/excel', function(req, res) {
    customUtil.postExcel(req, res);
});

app.get('/userProtocol', function(req, res) {
    res.render('userProtocol');
});

app.get('/handBook', function(req, res) {
    res.render('handBook');
});

app.get('/contactUs', function(req, res) {
    res.render('contactUs');
});

app.get('/guide', function(req, res) {
    res.render('guide');
});

//小马试客
app.get('/app', function(req, res) {
    res.render('app');
});

// 可以将一类的路由单独保存在一个文件中
app.use('/api', api);
app.use('/user', users);
app.use('/myapp', userApps);
app.use('/', index);
app.use('/doTask', doTask);
app.use('/taskCheck', taskCheck);
app.use('/taskInfor', taskInfor);
app.use('/pay', alipay);
app.use('/myClaim', myClaim);
app.use('/newtaskMobile', newtaskMobile);
app.use('/interiorExcDetail', interiorExcDetail);
app.use('/userProtocol', userProtocol);
app.use('/handBook', handBook);
app.use('/guide', guide);
app.use('/webAnalysis', webAnalysis);
app.use('/nextTaskCheck', nextTaskCheck);
app.use('/shop', shop);
app.use('/asoEffect', asoEffect);

app.use('/withdrawDeposit', withdrawDeposit);
app.use('/keywordsPackage', keywordsPackage);

//extra route
app.use('/homePage', homePage);
app.use('/home', homePage);
app.use('/taskUserDetails', taskUserDetails);
app.use('/Administrator', Administrator);

//小马试客
app.use('/taskUser', taskUsers);
app.use('/taskHall', taskHall);
app.use('/lottery', lottery);
app.use('/templates', loadHtml);

app.use('/printScreenTask', printScreenTask);
app.use('/withdrawalRelated', withdrawalRelated);
app.use('/jifenqiangApi', jifenqiangApi);
app.use('/quickTaskHall', quickTaskHall);

app.use('/lotteryResults', lotteryResults);


//静态html组建
app.use('/html', loadHtml);

// 如果任何路由都没匹配到，则认为 404
// 生成一个异常让后面的 err handler 捕获
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) { // jshint ignore:line
        var statusCode = err.status || 500;
        if(statusCode === 500) {
            console.error(err.stack || err);
        }
        if(req.timedout) {
            console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
            res.json({'errorMsg':err.message, 'errorId': err.code});
            return;
        }
        res.status(statusCode);
        res.render('error', {
            message: err.message || err,
            error: err
        });
    });
}

// 如果是非开发环境，则页面只输出简单的错误信息
app.use(function(err, req, res, next) { // jshint ignore:line
    res.status(err.status || 500);
    if(req.timedout) {
        console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
        res.json({'errorMsg':err.message, 'errorId': err.code});
        return;
    }

    res.render('error', {
        message: err.message || err,
        error: {}
    });
});

module.exports = app;