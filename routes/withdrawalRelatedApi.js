/**
 * Created by cailong on 2016/12/21.
 */

var express = require('express');
var router = express.Router();
var AV = require('leanengine');
var util = require('./util');
var tryPriceUtil = require('../utils/tryPriceUtil');
var Base64 = require('../public/javascripts/vendor/base64').Base64;

var tempUserSQL = AV.Object.extend('tempUser');
var mentorRelationSQL = AV.Object.extend('mentorRelation');
var tempUserWithdrawalAQL = AV.Object.extend('tempUserWithdrawalObject');
var telePhonePay = require('../utils/telephonePay');

var leanObjectRedis = require('../utils/leanObjectRedis');

function saveWithdrawalDetail(tempUserObject, userInfoObj){
    var tempUserWithdraObject = new tempUserWithdrawalAQL();
    tempUserWithdraObject.set('tempUserObject', tempUserObject);  // 申请的用户
    tempUserWithdraObject.set('aliPayNumber', userInfoObj.aliPayNumber);  // 支付宝帐号
    tempUserWithdraObject.set('aliPayName', userInfoObj.aliPayName);   // 支付宝绑定的名字
    tempUserWithdraObject.set('type', userInfoObj.type);  // 类型 1.手机充值 2.支付宝提现 3.微信提现
    tempUserWithdraObject.set('applyAmount', userInfoObj.applyAmount);  // 申请的金额
    tempUserWithdraObject.set('serviceChargeMoney', userInfoObj.serviceChargeMoney); // 手续费
    tempUserWithdraObject.set('mobilePhone', userInfoObj.mobilePhone); // 手机号码
    tempUserWithdraObject.set('status', userInfoObj.status);  // 状态

    tempUserWithdraObject.save();
}

// 查询帐号余额
router.get('/phone/:userId', function(req, res){
    var userCId = Base64.decode(req.params.userId);

    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function(tempUserObject){
        var userInfoObject = Object();
        userInfoObject.mobilePhone = tempUserObject.get('phoneNumber');
        userInfoObject.currentMoney = tempUserObject.get('currentMoney'); // 余额
        userInfoObject.aliPayNumber = tempUserObject.get('aliAccount'); // 支付宝帐号
        userInfoObject.aliPayName = tempUserObject.get('aliPayUserName'); // 支付宝姓名
        userInfoObject.phoneTopUpIsSuccess = tempUserObject.get('phoneTopUpIsSuccess');

        if (tempUserObject.get('phoneTopUpIsSuccess') == false){
            var query = new AV.Query(tempUserWithdrawalAQL);
            query.equalTo('status', '0');
            query.equalTo('tempUserObject', tempUserObject);
            query.equalTo('type', '手机充值');
            query.first().then(function(tempUserInfo){
                if (tempUserInfo == undefined){
                    res.json({'errorId':0, 'errorMsg':'', 'userInfoObject':userInfoObject})
                }else {
                    telePhonePay.orderStatusQuery(tempUserInfo.get('uorderid'), function(queryResults){
                        if (queryResults.error_code == 0){
                            tempUserInfo.set('status', queryResults.result.game_state);
                            tempUserObject.set('phoneTopUpIsSuccess', true);
                            tempUserObject.save();
                            tempUserInfo.save().then(function(){
                                res.json({'errorId':0, 'errorMsg':'', 'status':queryResults.result.game_state, 'userInfoObject':userInfoObject})
                            },function(error){
                                res.json({'errorMsg':error.message, 'errorId': error.code});
                            })
                        }
                        else {
                            res.json({'errorId':-1, 'errorMsg':queryResults.reason, 'userInfoObject':userInfoObject})
                        }
                    })
                }
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            })
        }
        else {
            res.json({'errorId':0, 'errorMsg':'', 'userInfoObject':userInfoObject})
        }
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    });

});

// 验证钱够不够
router.post('/isNoMoney', function(req, res){
    var userCId = Base64.decode(req.body.userId);

    var temUserObject = new tempUserSQL();
    temUserObject.id = userCId;

    var userInfoObject = Object();
    userInfoObject.applyAmount = parseInt(req.body.needMoney);
    userInfoObject.type = req.body.type;
    userInfoObject.mobilePhone = req.body.mobilePhone;
    userInfoObject.type = req.body.type;
    userInfoObject.status = 'ongoing';
    userInfoObject.aliPayNumber = req.body.aliPayNumber;
    userInfoObject.aliPayName = req.body.aliPayName;

    //var tempUserQuery = new AV.Query(tempUserSQL);
    //tempUserQuery.equalTo('aliAccount', userInfoObject.aliPayNumber);
    //tempUserQuery.count().then(function(count){
    //    //if (count > 0){
    //    //    res.json({'errorId': -1, 'errorMsg': '该支付宝账号已经被绑定'});
    //    //    return;
    //    //}
    //
    //    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function(userInfo){
    //        var currentMoney = userInfo.get('currentMoney'); // 余额
    //        if (currentMoney < userInfoObject.applyAmount){
    //            res.json({'errorId':-1, 'errorMsg':'余额不足'})
    //        }
    //        else if (userInfo.get('withdrawMoney') > 0){
    //            res.json({'errorId':-1, 'errorMsg':'有一笔正在提现中,请等待处理'})
    //        }
    //        else {
    //            // 处理提现相关保存信息
    //            saveWithdrawalDetail(temUserObject, userInfoObject);
    //            userInfo.increment('currentMoney', -userInfoObject.applyAmount);
    //            userInfo.set('withdrawMoney', userInfoObject.applyAmount);
    //            userInfo.save().then(function(successInfo){
    //                res.json({'errorId':0, 'errorMsg':'申请成功', 'successInfo':successInfo.get('currentMoney')})
    //            },function(error){
    //                res.json({'errorMsg':error.message, 'errorId': error.code});
    //            })
    //        }
    //    },function(error){
    //        res.json({'errorMsg':error.message, 'errorId': error.code});
    //    })
    //});
    var query = new AV.Query(tempUserSQL);
    query.get(userCId).then(function(userInfo){
        var currentMoney = userInfo.get('currentMoney'); // 余额
        if (currentMoney < userInfoObject.applyAmount){
            res.json({'errorId':-1, 'errorMsg':'余额不足'})
        }
        else if (userInfo.get('withdrawMoney') > 0 && userInfoObject.type != '手机充值'){
            res.json({'errorId':-1, 'errorMsg':'有一笔正在提现中,请等待处理'})
        }
        else if(userInfoObject.type == '手机充值' && userInfo.get('phoneTopUpIsSuccess') == false){
            res.json({'errorId':-1, 'errorMsg':'你有一个充值正在处理,请耐心等待'})
        }
        else {
            userInfo.set('phoneNumber', req.body.mobilePhone);
            userInfo.save().then(function(successInfo){
                res.json({'errorId':0, 'errorMsg':'申请成功', 'successInfo':successInfo.get('currentMoney')})
            },function(error){
                res.json({'errorMsg':error.message, 'errorId': error.code});
            });
            //res.json({'errorId':0, 'errorMsg':''})
        }
    },function(error){
        res.json({'errorMsg':error.message, 'errorId': error.code});
    })
});

//var request = require('request');
//router.get('/orderStatusQuery/:userId', function(req, res){
//    var userCId = Base64.decode(req.params.userId);
//
//    var tempUserObject = new tempUserSQL();
//    tempUserObject.id = userCId;
//
//    var query = new AV.Query(tempUserWithdrawalAQL);
//    query.equalTo('status', '0');
//    query.equalTo('tempUserObject', tempUserObject);
//    query.equalTo('type', '手机充值');
//    query.first().then(function(toUpDepositsObject){
//        if (toUpDepositsObject == undefined){
//            res.json({'errorId':-1, 'errorMsg':''});
//        }
//        else {
//            var uorderid = toUpDepositsObject.get('uorderid');
//            var phoneIn = encodeURI('http://op.juhe.cn/ofpay/mobile/ordersta?key=48201b5a11150828e0a84e67271ccbfb&orderid=' + uorderid);
//            //创建请求
//            request(phoneIn,function(error, response, body){
//                var bodyT =  JSON.parse(body);
//                if (!error && response.statusCode == 200) {
//                    if (bodyT.error_code == 0){
//                        console.log('状态:' + bodyT.result.game_state);
//                        console.log('聚合订单号:' + bodyT.result.sporder_id);
//                        toUpDepositsObject.set('status', bodyT.result.game_state);
//                        toUpDepositsObject.save().then(function(){
//                            res.json({'errorId':0, 'errorMsg':'', 'status':bodyT.result.game_state})
//                        },function(error){
//                            res.json({'errorMsg':error.message, 'errorId': error.code});
//                        })
//                    }
//                    else {
//                        console.log('2' + bodyT.reason);
//                        res.json({'errorId':-1, 'errorMsg':bodyT.reason})
//                    }
//                }else {
//                    console.log('3' + bodyT.reason);
//                    res.json({'errorId':-1, 'errorMsg':bodyT.reason})
//                }
//            });
//        }
//    },function(error){
//        res.json({'errorMsg': error.message, 'errorId': error.code});
//    })
//});

module.exports = router;