/**
 * Created by Shi Xiang on 8/24/16.
 */
var AV = require('leanengine');
var User = AV.Object.extend('_User');
var messageObject = AV.Object.extend('messageObject');

//*************** CSS 装饰 Helper Function *******************
function messageWrapper(messageText){
    return messageText;

    //不是这种转换,如果需要某些细节格式时,转换
    var style = 'style = "font-size: 12px; color: #333333"';
    return '<span ' + style + '>' + messageText + '/span>';
}

//*************** 其它Helper Function ***********************

//保存信息
function saveMsg (receiverObject, msg, msgElement, msgType, needSave){
    var newMsgObject = new messageObject();
    // newMsgObject.set('receiverObject', receiverObject);//移除，会引起错误的save
    newMsgObject.set('receiverObjectId', receiverObject.id);
    newMsgObject.set('messageText', msg);
    newMsgObject.set('messageHtml', msgElement);
    newMsgObject.set('type', msgType);

    //账户变化
    if(receiverObject.get('totalMoney') != undefined){
        newMsgObject.set('totalMoney', receiverObject.get('totalMoney'));
    }
    if(receiverObject.get('freezingMoney') != undefined) {
        newMsgObject.set('freezingMoney', receiverObject.get('freezingMoney'));
    }
    if(receiverObject.get('feedingMoney') != undefined) {
        newMsgObject.set('feedingMoney', receiverObject.get('feedingMoney'));
    }

    if(needSave == true){
        newMsgObject.save().then(function(){
            return ({'errorId': 0, 'errorMsg': ''});
        }, function(error){
            console.error('Y Coin save error' + error.message);
        })
    }else {
        return newMsgObject;
    }
}

//*************** User数据库请求冻结金额和总额 ******************
 function getAccountInfo(userId, callBack){
    var query = new AV.Query(User);
    query.get(userId).then(function(userObject){
        if (userObject != undefined){
            callBack(userObject);
        }
    },function(error){
        console.error('user Y Coin Flow error:' + error.message);
    })
}

//*********************** 生成消息 *****************************
//奖励
exports.bonusMsg = function (reason, amount, userId){
    //判断userId是object还是string
    if (typeof userId === 'object'){
        userId = userId.id;
    }

    //请求服务器
    getAccountInfo(userId, function(accountInfo){
        //拼接消息
        var msg = reason + ',获得' + parseInt(amount) + 'Y币';

        //消息转换成html
        var msgElement = messageWrapper(msg);

        //保存信息
        saveMsg(accountInfo, msg, msgElement, '奖励', true);
    })
};

//充值
exports.topUpMsg = function (money, Ycoin, userId){
    //判断userId是object还是string
    if (typeof userId === 'object'){
        userId = userId.id;
    }

    //请求服务器
    getAccountInfo(userId, function(accountInfo){
        //拼接消息
        var msg = '恭喜您成功充值了' + parseInt(money) + '元，获得' + parseInt(Ycoin) + 'Y币';

        //消息转换成html
        var msgElement = messageWrapper(msg);

        //保存信息
        saveMsg(accountInfo, msg, msgElement, '充值', true);
    })
};

//冻结
exports.freezeMsg = function (appName, Ycoin, userId){
    //判断userId是object还是string
    if (typeof userId === 'object'){
        userId = userId.id;
    }

    //请求服务器
    getAccountInfo(userId, function(accountInfo){
        //拼接消息
        var msg = '你成功发布了任务(' + appName + '), 共冻结' + parseInt(Ycoin) + 'Y币,';

        //消息转换成html
        var msgElement = messageWrapper(msg);

        //保存信息
        saveMsg(accountInfo, msg, msgElement, '冻结', true);
    })
};

//解冻
exports.unfreezeMsg = function (text, Ycoin, userId, needMoneyInfo){

    //请求服务器
    if(needMoneyInfo == 1){
        getAccountInfo(userId, function(accountInfo){
            //拼接消息
            var msg = text + ', 解冻' + parseInt(Ycoin) + 'Y币';
            //消息转换成html
            var msgElement = messageWrapper(msg);

            //保存信息
            saveMsg(accountInfo, msg, msgElement, '解冻', true);
        })
    }else {
        //拼接消息
        var msg = text + ', 解冻' + parseInt(Ycoin) + 'Y币';
        //消息转换成html
        var msgElement = messageWrapper(msg);

        //var userObject = new User();
        //userObject.id = userId;
        //保存信息
        return saveMsg(needMoneyInfo, msg, msgElement, '解冻', false);
    }

};

//扣罚(错误拒绝 —— 只有彻底拒绝才有该问题)
//XXX用户做的任务（appname）申诉成功，支付30Y币，您错误拒绝，扣罚15Y币
exports.penaltyMsg = function (doTaskUserName, appName, YCoin, userObject){
    var msg = doTaskUserName +  '用户做的任务（' + appName + '）申诉成功，支付' + YCoin + 'Y币';
    //消息转换成html
    var msgElement = messageWrapper(msg);

    //保存信息
    return saveMsg(userObject, msg, msgElement, '扣罚', false);
};

//赚取
exports.earnMsg = function (taskEarnInfo, Ycoin, userId, needMoneyInfo){
    //判断userId是object还是string
    if (typeof userId === 'object'){
        userId = userId.id;
    }

    //请求服务器
    if(needMoneyInfo == 1){
        getAccountInfo(userId, function(accountInfo){
            //拼接消息
            var msg = taskEarnInfo + ', 获得了' + parseInt(Ycoin) + 'Y币';

            //消息转换成html
            var msgElement = messageWrapper(msg);

            //保存信息
            saveMsg(accountInfo, msg, msgElement, '赚取', true);
        })
    }else {
        //拼接消息
        var msg = taskEarnInfo + ', 获得了' + parseInt(Ycoin) + 'Y币';
        //消息转换成html
        var msgElement = messageWrapper(msg);

        //var userObject = new User();
        //userObject.id = userId;
        //保存信息
        return saveMsg(needMoneyInfo, msg, msgElement, '赚取', false);
    }

};

//支付
exports.payMsg = function (taskPayInfo, Ycoin, userId, needMoneyInfo){
    //判断userId是object还是string
    if (typeof userId === 'object'){
        userId = userId.id;
    }

    if(needMoneyInfo == 1){
        //请求服务器
        getAccountInfo(userId, function(accountInfo){
            //拼接消息
            var msg = taskPayInfo + ', 支付' + parseInt(Ycoin) + 'Y币';

            //消息转换成html
            var msgElement = messageWrapper(msg);

            //保存信息
            saveMsg(accountInfo, msg, msgElement, '支付', true);
        })
    }else {
        //拼接消息
        var msg = taskPayInfo + ', 支付' + parseInt(Ycoin) + 'Y币';
        //消息转换成html
        var msgElement = messageWrapper(msg);

        //var userObject = new User();
        //userObject.id = userId;
        //保存信息
        return saveMsg(needMoneyInfo, msg, msgElement, '支付', false);
    }
};

//通用信息
//暂不支持使用
exports.normalMessage = function (YCoinMessage, messageType, userObject){
    var msg = YCoinMessage;
    //消息转换成html
    var msgElement = messageWrapper(msg);

    //保存信息
    return saveMsg(userObject, msg, msgElement, messageType, false);
};



//现金账户流水变动

var cashChangeRecordSQL = AV.Object.extend('cashRecordObject');

exports.cashMoneyRecharge = function (rechargeMoney, aliOrderId, userObject, productId){
    //支付宝充值
    var newCashRecordObject = new cashChangeRecordSQL();
    newCashRecordObject.set('userId', userObject.id);
    newCashRecordObject.set('aliOrderId', aliOrderId);
    newCashRecordObject.set('rechargeMoney', rechargeMoney);
    if(productId != undefined){
        newCashRecordObject.set('productId', productId);
    }
    newCashRecordObject.set('type', '充值');

    return newCashRecordObject;
};

exports.refundMoneyMessage = function (refundMoney, planObject, userObject, refundMessage){

    var newCashRecordObject = new cashChangeRecordSQL();
    newCashRecordObject.set('userId', userObject.id);
    newCashRecordObject.set('planId', planObject.id);
    newCashRecordObject.set('refundMoney', refundMoney);
    newCashRecordObject.set('refundMessage', refundMessage);
    newCashRecordObject.set('type', '退款');

    return newCashRecordObject;
};

exports.cashMoneyExchange = function (consumePointer, cashMoney, userObject){

    var newCashRecordObject = new cashChangeRecordSQL();
    newCashRecordObject.set('userId', userObject.id);
    newCashRecordObject.set('rechargeMoney', cashMoney);
    newCashRecordObject.set('type', '积分兑换');
    newCashRecordObject.set('costPointer', consumePointer);

    return newCashRecordObject;
};

exports.cashMoneyUsedForPlan = function (costMoney, planObject, userObject){
    //计划激活消耗Y币
    var newCashRecordObject = new cashChangeRecordSQL();
    newCashRecordObject.set('userId', userObject.id);
    newCashRecordObject.set('costMoney', costMoney);
    // newCashRecordObject.set('moneyUsedRemark', moneyUsedRemark);
    newCashRecordObject.set('planId', planObject.id);
    newCashRecordObject.set('type', '付费');

    return newCashRecordObject;
};