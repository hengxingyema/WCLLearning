/**
 * Created by cailong on 2016/11/22.
 */

'use strict';
var router = require('express').Router();
var AV = require('leanengine');

var util = require('./util');
var https = require('https');

// var leanObjectRedis = require('../utils/leanObjectRedis');

var User = AV.Object.extend('_User');
var keywordsPackageSql = AV.Object.extend('keywordsPackageObject');

router.get('/', function(req, res) {
    res.render('keywordsPackage');
});

// 获取用户询价信息
router.get('/getInfo', function(req, res){
    var userId = util.useridInReq(req);

    var userObject = new User();
    userObject.id = userId;

    var query = new AV.Query(keywordsPackageSql);
    query.equalTo('userObject', userObject);
    query.first().then(function(makeInquiryInfo){
        var keywordsPackageObject = Object();
        if (makeInquiryInfo == undefined || makeInquiryInfo == ''){
            res.json({'keywordsPackageObject':keywordsPackageObject, 'errorId':0, 'errorMsg':''})
        }
        else {
            keywordsPackageObject.appTrackName = makeInquiryInfo.get('appTrackName');
            keywordsPackageObject.iTunesURL = makeInquiryInfo.get('iTunesURL');
            keywordsPackageObject.packageCount = makeInquiryInfo.get('packageCount');
            keywordsPackageObject.rankingCount = makeInquiryInfo.get('rankingCount');
            keywordsPackageObject.onTheCycleStart = makeInquiryInfo.get('onTheCycleStart');
            keywordsPackageObject.onTheCycleEnd = makeInquiryInfo.get('onTheCycleEnd');
            keywordsPackageObject.userQQ = makeInquiryInfo.get('userQQ');
            keywordsPackageObject.searchKeyWord = makeInquiryInfo.get('searchKeyWord');

            res.json({'keywordsPackageObject':keywordsPackageObject, 'errorId':0, 'errorMsg':''})
        }
    },function(error){
        res.json({'errorId' : error.code, 'message' : error.message})
    })
});


// 保存用户询价信息
router.post('/saveInfo', function(req, res){
    var userId = util.useridInReq(req);

    var userInfo = req.body.userInfoObject;

    var userObject = new User();
    userObject.id = userId;

    var query = new AV.Query(keywordsPackageSql);
    query.equalTo('userObject', userObject);
    query.first().then(function(results){
        if (results == undefined || results == ''){
            var keywordsPackageObject = new keywordsPackageSql();
            keywordsPackageObject.set('userObject', userObject);
            keywordsPackageObject.set('appTrackName', userInfo.appTrackName);
            keywordsPackageObject.set('iTunesURL', userInfo.iTunesURL);
            keywordsPackageObject.set('packageCount', userInfo.packageCount);
            keywordsPackageObject.set('rankingCount', userInfo.rankingCount);
            keywordsPackageObject.set('onTheCycleStart', userInfo.onTheCycleStart);
            keywordsPackageObject.set('onTheCycleEnd', userInfo.onTheCycleEnd);
            keywordsPackageObject.set('userQQ', userInfo.userQQ);
            keywordsPackageObject.set('searchKeyWord', userInfo.searchKeyWord);

            keywordsPackageObject.save().then(function(){
                res.json({'errorId':0, 'errorMsg':''})
            });
        }
        else {
            results.set('userObject', userObject);
            results.set('appTrackName', userInfo.appTrackName);
            results.set('iTunesURL', userInfo.iTunesURL);
            results.set('packageCount', userInfo.packageCount);
            results.set('rankingCount', userInfo.rankingCount);
            results.set('onTheCycleStart', userInfo.onTheCycleStart);
            results.set('onTheCycleEnd', userInfo.onTheCycleEnd);
            results.set('userQQ', userInfo.userQQ);
            results.set('searchKeyWord', userInfo.searchKeyWord);

            results.save().then(function(){
                res.json({'errorId':0, 'errorMsg':''})
            });
        }

    },function(error){
        res.json({'errorId' : error.code, 'message' : error.message})
    })


});



module.exports = router;
