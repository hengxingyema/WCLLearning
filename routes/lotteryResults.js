/**
 * Created by alvin on 1/15/17.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

var Base64 = require('../public/javascripts/vendor/base64').Base64;

var leanObjectRedis = require('../utils/leanObjectRedis');

var lotteryPoolSQL = AV.Object.extend('lotteryPool');

router.get('/', function(req, res) {
    var lotteryPoolQuery = new AV.Query(lotteryPoolSQL);
    lotteryPoolQuery.descending('createdAt');
    lotteryPoolQuery.equalTo('expired', true);
    lotteryPoolQuery.limit(7);
    lotteryPoolQuery.include('result');
    lotteryPoolQuery.include('totalWinners');
    lotteryPoolQuery.find().then(function(results) {
        var pools = Array();
        var length = results.length;
        for (var i = 0; i < length; i++) {
            var pool = Object();
            pool.result = results[i].get('result');
            pool.totalWinners = results[i].get('totalWinners');
            pool.date = results[i].createdAt;
            pools.push(pool);
        }
        res.json({'errorId': 0, 'pools': pools});
    }).catch(function(error){
        //服务器错误
    });
});

module.exports = router;