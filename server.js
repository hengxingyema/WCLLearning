/**
 * Created by wujiangwei on 16/5/4.
 */

'use strict';

var apm = require('leanengine-apm');
apm.init('cb36bfbb19c7ecafa356c5b2e24a9dae74653b3e'); // 你的 Token
apm.cloudApi();

var AV = require('leanengine');

var isFormalService = 0;

var APP_ID = process.env.LEANCLOUD_APP_ID || 'AKmplURjmVSt7TPP3Aly2JBV-gzGzoHsz';
var APP_KEY = process.env.LEANCLOUD_APP_KEY || 'PxL2ll8vWqjYAbbY8xyFQzak';
var MASTER_KEY = process.env.LEANCLOUD_APP_MASTER_KEY || 'GJQL0kG0A5BGD60q2HImHfn8';

if(isFormalService == 1){
    console.log('****************************************************************************************');
    console.log('***************************************正式服务器****************************************');
    console.log('****************************************************************************************');
    APP_ID = process.env.LEANCLOUD_APP_ID || 'rBMsNNTFEhPsIOpmC3V9hMQA-gzGzoHsz';
    APP_KEY = process.env.LEANCLOUD_APP_KEY || '3fxdvjsqHrd2LIVBqpS23A9N';
    MASTER_KEY = process.env.LEANCLOUD_APP_MASTER_KEY || 'mK0myEemUe7RqzLifjnAYVgN';
}else {
    console.log('****************************************************************************************');
    console.log('***************************************测试服务器****************************************');
    console.log('****************************************************************************************');
}

AV.init({
    appId: APP_ID,
    appKey: APP_KEY,
    masterKey: MASTER_KEY
});

// 如果不希望使用 masterKey 权限，可以将下面一行删除
AV.Cloud.useMasterKey();

var app = require('./app');

// 端口一定要从环境变量 `LEANCLOUD_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LEANCLOUD_APP_PORT || process.env.PORT || 3000);
app.listen(PORT, function () {
    console.log('Node app is running, port:', PORT);

    // 注册全局未捕获异常处理器
    process.on('uncaughtException', function(err) {
        console.error("Caught exception:", err.stack);
    });
    process.on('unhandledRejection', function(reason, p) {
        console.error("Unhandled Rejection at: Promise ", p, " reason: ", reason.stack);
    });
});
