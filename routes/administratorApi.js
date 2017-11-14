/**
 * Created by cailong on 2016/11/23.
 */

var express = require('express');
var AV = require('leanengine');
var router = express.Router();
var util = require('./util');
var https = require('https');

var User = AV.Object.extend('_User');
var keywordsPackageSql = AV.Object.extend('keywordsPackageObject');

router.get('/', function(req, res) {
    res.render('administrator');
});

router.get('/keywordInfo', function(req, res){
    var userId = util.useridInReq(req);

    var userObject = new User();
    userObject.id = userId;

    var query = new AV.Query(keywordsPackageSql);
    query.find().then(function(results){
        var keywordInfoArray = Array();
        for (var i = 0; i < results.length; i++){
            var keywordInfoObject = Object();
            keywordInfoObject.appTrackName = results[i].get('appTrackName');
            keywordInfoObject.iTunesURL = results[i].get('iTunesURL');
            keywordInfoObject.packageCount = results[i].get('packageCount');
            keywordInfoObject.rankingCount = results[i].get('rankingCount');
            keywordInfoObject.onTheCycleStart = results[i].get('onTheCycleStart');
            keywordInfoObject.onTheCycleEnd = results[i].get('onTheCycleEnd');
            keywordInfoObject.userQQ = results[i].get('userQQ');
            keywordInfoObject.searchKeyWord = results[i].get('searchKeyWord');

            keywordInfoArray.push(keywordInfoObject);
        }

        res.json({'keywordInfoArray':keywordInfoArray, 'errorId':0, 'errorMsg':''})

    },function(error){
        res.json({'errorId' : error.code, 'message' : error.message})
    })
});


module.exports = router;