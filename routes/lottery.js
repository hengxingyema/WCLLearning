/**
 * Created by alvin on 1/13/17.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

var Base64 = require('../public/javascripts/vendor/base64').Base64;

var leanObjectRedis = require('../utils/leanObjectRedis');

var lotteryRecordSQL = AV.Object.extend('lotteryRecord');
var lotteryPoolSQL = AV.Object.extend('lotteryPool');
var tempUserSQL = AV.Object.extend('tempUser');

router.get('/:userCId', function(req, res) {
    if(req.params.userCId == undefined || req.params.userCId.length < 15){
        var err = new Error('not register user');
        err.status = 404;
        res.render('error', {
            message: err.message || err,
            error: {}
        });
        return;
    }
    var userCId = Base64.decode(req.params.userCId);
    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (tempUserObject) {
        var accountBalance = tempUserObject.get('currentMoney');

        var lotteryQuery = new AV.Query(lotteryRecordSQL);
        lotteryQuery.equalTo('tempUserObject', tempUserObject);
        lotteryQuery.equalTo('expired', false);
        lotteryQuery.include('1');
        lotteryQuery.include('2');
        lotteryQuery.include('3');
        lotteryQuery.include('4');
        lotteryQuery.include('5');
        lotteryQuery.include('6');
        lotteryQuery.include('7');
        lotteryQuery.include('8');
        lotteryQuery.include('9');
        lotteryQuery.find().then(function (results) {
            var currentBidArray = Array(10);
            if (results.length == 0) {
                for (var i = 1;  i < 10; i++) {
                    currentBidArray[i] = 0;
                }
            }
            else {
                for (var i = 1; i < 10; i++) {
                    currentBidArray[i] = results[0].get(i);
                }
            }

            var totalLotteryResult = new AV.Query(lotteryPoolSQL);
            totalLotteryResult.equalTo('expired', false);
            totalLotteryResult.include('pool');
            totalLotteryResult.find().then(function(results){
                if (results.length == 1) {
                    var currentPool = results[0].get('pool');
                    res.json({'errorId': 0, 'accountBalance': parseInt(accountBalance), 'pool': currentPool, 'currentBidArray': currentBidArray});
                }
                else {
                    console.log('error');
                    res.json({'errorId': 0, 'accountBalance': accountBalance, 'currentBidArray': currentBidArray});
                }
            })
        }, function (error) {
            res.json({'errorId': error.code, 'message': error.message});
        });
    });
});

router.get('/:userCId/:number', function(req, res) {
    if(req.params.userCId == undefined || req.params.userCId.length < 15){
        var err = new Error('not register user');
        err.status = 404;
        res.render('error', {
            message: err.message || err,
            error: {}
        });
        return;
    }
    var userCId = Base64.decode(req.params.userCId);
    var bid = req.params.number;
    leanObjectRedis.fetchLeanObjectFromCache(userCId, 'tempUser').then(function (tempUserObject) {
        if (tempUserObject.get('currentMoney') < 1) {
            res.json({'errorId': -1, 'message': '余额不足'});
        }
        else {
            var tempUser = new tempUserSQL();
            tempUser.id = userCId;

            tempUser.increment('currentMoney', -1);
            tempUser.save().then(function(){
                tempUserObject.increment('currentMoney', -1);
                var lotteryPoolQuery = new AV.Query(lotteryPoolSQL);
                lotteryPoolQuery.equalTo('open', true);
                lotteryPoolQuery.equalTo('revealed', false);
                lotteryPoolQuery.equalTo('expired', false);
                lotteryPoolQuery.find().then(function(results){
                    if (results.length != 1) {
                        res.json({'errorId': -2, 'message': '下注被锁定,锁定时间:每天下午5:30到6:00'});
                    }
                    else {
                        results[0].increment('pool', 1);
                        results[0].save().then(function(){
                            var lotteryQuery = new AV.Query(lotteryRecordSQL);
                            lotteryQuery.equalTo('tempUserObject', tempUserObject);
                            lotteryQuery.equalTo('expired', false);
                            lotteryQuery.find().then(function (results) {
                                var bidRecord;
                                var currentBidArray = Array();
                                if (results.length == 1) {
                                    bidRecord = results[0];
                                }
                                else if (results.length == 0) {
                                    bidRecord = new lotteryRecordSQL();
                                    bidRecord.set('tempUserObject', tempUserObject);
                                }
                                else {
                                    console.log("error");
                                }
                                bidRecord.increment(bid, 1);
                                bidRecord.save();
                                res.json({'errorId': 0, 'currentBidArray': currentBidArray, 'accountBalance':parseInt(tempUserObject.get('currentMoney'))});
                            }, function (error) {
                                res.json({'errorId': error.code, 'message': error.message});
                            });
                        });
                    }
                })
            })
        }
    })
});


module.exports = router;