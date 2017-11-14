/**
 * Created by wujiangwei on 16/5/8.
 */
'use strict';
var express = require('express');
var router = express.Router();
var AV = require('leanengine');
var https = require('https');
var http = require('http');
var util = require('./util');

var IOSAppSql = AV.Object.extend('IOSAppInfo');
var IOSAppExcLogger = AV.Object.extend('IOSAppExcLogger');

/* GET home page. */
router.get('/', function(req, res, next) {
    res.send('api home support by wujiangwei')
});


//iTunes Store Api
router.get('/itunes/search/:searchkey', function(req, res, next) {

    //http://backend.cqaso.com/search/趣恋爱?limit=100&offset=0
    //var searchCAAsoUrl = 'http://backend.cqaso.com/search/' + req.params.searchkey +'?limit=120&offset=0';
    //searchCAAsoUrl = encodeURI(searchCAAsoUrl);
    //var appResults = Array();
    //
    //http.get(searchCAAsoUrl, function(response) {
    //    response.setEncoding('utf-8');
    //    console.log("状态码 %d \nheaders:\n %s \n当前的请求方式为【GET】请求",response.statusCode,
    //        JSON.stringify(response.headers));
    //
    //    if (response.statusCode != 200){
    //        res.json({'appResults':[], 'errorMsg' : response.statusCode, 'errorId':-2})
    //    }else {
    //        var receiveData = "";
    //        response.on('data', function (chunk) {
    //            receiveData += chunk;
    //        }).on('end', function () {
    //            //打印
    //            var appObjectList = JSON.parse(receiveData);
    //
    //            for (var i = 0; i < appObjectList.contents.length; i++){
    //                var appleObject = appObjectList.contents[i];
    //
    //                var appResult = Object();
    //
    //                appResult.trackName = appleObject['name'];
    //                appResult.artworkUrl512 = appleObject['artworkUrl60'];
    //                appResult.artworkUrl100 = appleObject['artworkUrl60'];
    //                appResult.appleId = appleObject['appid'];//number
    //                //Appid+版本号来做匹配的唯一识别码
    //                appResult.excUniqueCode = appleObject['appId'] + appleObject['version'];
    //                appResult.sellerName = appleObject['artistName'];
    //                appResult.version = appleObject['version'];
    //                appResult.appleKind = appleObject['genreValue'];
    //
    //                var appType = appleObject['subGenre']['type'];
    //                if(appType == undefined || appType.indexOf('付费') == -1 ){
    //                    appResult.formattedPrice = '免费';
    //                }else {
    //                    appResult.formattedPrice = '付费';
    //                }
    //
    //                //类别 平台信息
    //                appResults.push(appResult);
    //            }
    //
    //            res.json({'appResults':appResults, 'errorMsg':'', 'errorId':0});
    //        });
    //    }
    //}).on('error', function(e) {
    //    console.log("Got error: " + e.message);
    //    res.json({'appResults':[], 'errorMsg' : e.message, 'errorId' : -1})
    //});
    //
    //return;


    //iTunes接口API(速度较慢)
    //https://itunes.apple.com/search?term=美丽约&country=cn&entity=software
    var searchUrl = 'https://itunes.apple.com/search?term=' + req.params.searchkey +'&limit=120&country=cn&entity=software&media=software';
    searchUrl = encodeURI(searchUrl);

    https.get(searchUrl, function(httpRes) {

        // console.log('statusCode: ', httpRes.statusCode);
        // console.log('headers: ', httpRes.headers);
        var totalData = '';

        if (httpRes.statusCode != 200){
            console.log("Got error: " + httpRes.statusMessage);
            res.json({'appResults':[], 'errorMsg' : httpRes.statusCode + httpRes.statusMessage, 'errorId':-2})
        }else {
            httpRes.on('data', function(data) {
                totalData += data;
            });

            httpRes.on('end', function(){
                var dataStr = totalData.toString();
                try{
                    var dataObject = eval("(" + dataStr + ")");
                    var appResults = Array();

                    for (var i = 0; i < dataObject.results.length; i++){
                        var appleObject = dataObject.results[i];

                        var appResult = Object();

                        appResult.trackName = appleObject['trackName'];
                        appResult.artworkUrl512 = appleObject['artworkUrl512'];
                        appResult.artworkUrl100 = appleObject['artworkUrl100'];
                        appResult.appleId = appleObject['trackId'];
                        appResult.latestReleaseDate = appleObject['currentVersionReleaseDate'];
                        appResult.excUniqueCode = appleObject['trackId'] + appleObject['version'];
                        appResult.sellerName = appleObject['sellerName'];
                        appResult.version = appleObject['version'];
                        appResult.appleKind = appleObject['genres'][0];
                        appResult.formattedPrice = appleObject['formattedPrice'];
                        appResult.bundleId = appleObject['bundleId'];

                        //类别 平台信息

                        appResults.push(appResult);
                    }

                    if(dataObject.results.length > 0){
                        res.json({'appResults':appResults, 'errorMsg':'', 'errorId':0});
                    }else {
                        res.json({'appResults':[], 'errorMsg':'请尝试搜索App的全名', 'errorId':-1});
                    }

                }catch (e){
                    res.json({'appResults':[], 'errorMsg': e.message, 'errorId':-100});
                }

            })
        }

    }).on('error', function(e) {
        console.log("Got error: " + e.message);
        res.json({'appResults':[], 'errorMsg' : e.message, 'errorId' : -1})
    });
});

module.exports = router;
