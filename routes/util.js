/**
 * Created by wujiangwei on 16/5/11.
 */
'use strict';

var AV = require('leanengine');
var https = require('https');

var User = AV.Object.extend('_User');
var Base64 = require('../public/javascripts/vendor/base64').Base64;
var IOSAppSql = AV.Object.extend('IOSAppInfo');
var mackTaskInfo = AV.Object.extend('mackTaskInfo');
var everydayTaskObjectSql = AV.Object.extend('everydayTaskObject'); // 每日任务库
var XLSX = require('xlsx');

exports.indexInList = function(element, elementList){
    for (var i = 0; i < elementList.length; i++){
        if(elementList[i] == element){
            return i;
        }
    }
    return -1;
};

exports.useridInReq = function(req){
    //获取cookie的值,进行解密
    var encodeUserId = req.cookies.userIdCookie;
    if(encodeUserId == undefined){
        return encodeUserId;
    }else {
        return Base64.decode(encodeUserId);
    }
};

exports.decodeUserId = function(encodeUserId){
    if(encodeUserId == undefined){
        return undefined;
    }
    return Base64.decode(encodeUserId);
};

exports.encodeStr = function(encodeStr){
    if(encodeStr == undefined){
        return undefined;
    }
    return Base64.encode(encodeStr);
};

exports.postExcel = function (req, res) {
    if (req.busboy) {
        req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
            console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
            file.on('data', function(data) {
                var dataArray = new Uint8Array(data);
                var arr = Array();
                for(var i = 0; i != dataArray.length; ++i) arr[i] = String.fromCharCode(dataArray[i]);
                var bstr = arr.join("");
                var workbook = XLSX.read(bstr, {type:"binary"});
                var first_sheet_name = workbook.SheetNames[0];
                var worksheet = workbook.Sheets[first_sheet_name];
                var headers = Array();
                var contents = Array();
                for (var key in worksheet) {
                    var cell_content = worksheet[key];
                    if (!(key == "A1" || key == "B1")) {
                        if (key.slice(0,1) == "A") {
                            headers.push(cell_content.v);
                            var contentKey = "B".concat(key.substr(1));
                            contents.push(worksheet[contentKey].v);
                        }
                    }
                }
                res.json({'header' : headers, 'content':contents, 'length' : headers.length});
            });
            file.on('end', function() {
                console.log('File [' + fieldname + '] Finished');
            });
        });
    }
    req.pipe(req.busboy);
};

exports.postFile = function (req, res) {

    if (req.busboy) {
        var base64dataList = Array();
        var pubFileNameList = Array();
        var pubMimeTypeList = Array();
        var promiseIndex = 0;

        req.busboy.on('file', function (fieldName, file, fileName, encoding, mimeType) {
            var buffer = '';
            file.setEncoding('base64');
            file.on('data', function(data) {
                buffer += data;
            }).on('end', function() {
                pubFileNameList.push(fileName);
                pubMimeTypeList.push(mimeType);
                base64dataList.push(buffer);
            });
        }).on('finish', function() {

            var totalData = base64dataList.length;
            var fileUrlList = Array();

            if(totalData == 0){
                res.json({'files':fileUrlList, 'totalCount':base64dataList.length});
                return;
            }

            for (var i = 0; i < base64dataList.length; i++){
                (function (index){
                    // console.log('------ upload img ------ ' + pubFileNameList[index]);
                    try{
                        var f = new AV.File(pubFileNameList[index], {
                            // 仅上传第一个文件（多个文件循环创建）
                            base64: base64dataList[index]
                        });
                        // console.log('------ upload img ------ avfile succeed');
                        f.save().then(function(fileObj) {
                            fileUrlList.push(fileObj.url());
                            promiseIndex++;
                            if (promiseIndex == totalData){
                                res.json({'files':fileUrlList, 'totalCount':base64dataList.length});
                            }
                        }, function(error){
                            console.error('------ ' + pubFileNameList[index] + ' upload img failed ------ ' + error.message);
                            promiseIndex++;
                            if(promiseIndex == totalData){
                                res.json({'errorId':error.code, 'errorMsg':error.message});
                            }
                        });
                    }catch (e){
                        promiseIndex++;
                        if(promiseIndex == totalData){
                            console.error('------ AVFile error:' + pubFileNameList[index] + ' upload img failed ------ ' + e.message);
                            res.json({'errorId':error.code, 'errorMsg':error.message});
                        }
                    }

                }(i));
            }
        });
        req.pipe(req.busboy);
    } else {
        console.error('uploadFile - busboy undefined.');
        res.status(502);
    }
};


// --------
// iTunes Api deal
function findAppIniTunes(res, userId){
    //not need
    var appInfoUrl = 'https://itunes.apple.com/lookup?id=' + appid +'&country=cn&entity=software';

    https.get(appInfoUrl, function(httpRes) {

        //console.log('statusCode: ', httpRes.statusCode);
        //console.log('headers: ', httpRes.headers);
        var totalData = '';

        if (httpRes.statusCode != 200){
            console.log("Add app error: " + httpRes.statusMessage);
            res.json({'appInfo':[], 'errorMsg' : httpRes.statusCode + httpRes.statusMessage})
        }else {
            httpRes.on('data', function(data) {
                totalData += data;
            });

            httpRes.on('end', function(){
                var dataStr = totalData.toString();
                var dataObject = eval("(" + dataStr + ")");

                //appid just 1 result
                var appInfo = dataObject.results[0];

                var appObject = new IOSAppSql();
                var appInfoObject = util.updateIOSAppInfo(appInfo, appObject);
                appObject.save().then(function(post) {
                    // 实例已经成功保存.
                    blindAppToUser(res, userId, appObject, appInfoObject);
                }, function(err) {
                    // 失败了.
                    res.json({'errorMsg':err.message, 'errorId': err.code});
                });
            })
        }

    }).on('error', function(e) {
        console.log("Got appInfo with appid error: " + e.message);
        res.json({'errorMsg':e.message, 'errorId': e.code});
    });
}


exports.updateUserAppsVersion = function (req) {
    //parse appleId
    var appleIdArray = Array();
    var appleIdObject = Object();
    for (var i = 0; i < dataObject.results.length; i++) {
        var appleObject = dataObject.results[i];
        appleIdArray.push(appleObject.trackId);
        appleIdObject[appleObject.trackId] = appleObject;
    }

    //query appid not in SQL
    //query did it exist
    var query = new AV.Query(IOSAppSql);
    query.containedIn('appleId', appleIdArray);
    query.find({
        success: function(results) {
            for (var j = 0; j < appleIdArray.length; j++){

                var appObject = '';

                var flag = 0;
                for (var i = 0; i < results.length; i++) {
                    if (appleIdArray[j] == results[i].get('appleId')){
                        flag = 1;
                        appObject = results[i];
                        break;
                    }
                }

                if(flag == 0){
                    console.log(appleIdArray[j] + 'not exist in SQL');
                    //appid store to app sql
                    appObject = new IOSAppSql();
                }

                if (flag == 1 && appleIdObject[appleIdArray[j]]['version'] != appObject.get('version'))
                {

                }

                var appInfoObject = util.updateIOSAppInfo(appleIdObject[appleIdArray[j]], appObject);
                appObject.save().then(function(post) {
                    // 实例已经成功保存.
                    //blindAppToUser(res, userId, appObject, appInfoObject);
                    console.log(appInfoObject.appleId + 'save to SQL succeed');
                }, function(err) {
                    // 失败了.
                    console.log(appInfoObject.appleId + 'save to SQL failed');
                });
            }
        },
        error: function(err) {
            console.log(appleId + 'error in query');
        }
    });
};

function updateIOSAppInfo (appstoreObject, leanAppObject){
    var genres = appstoreObject['genres'];
    var appInfoObject = Object();

    //is updated
    var isUpdated = false;
    if(leanAppObject.get('version') != appstoreObject['version']){
        isUpdated = true;
    }

    leanAppObject.set('trackName', appstoreObject['trackName']);
    leanAppObject.set('artworkUrl100', appstoreObject['artworkUrl100']);
    leanAppObject.set('artworkUrl512', appstoreObject['artworkUrl512']);
    leanAppObject.set('appleId', appstoreObject['trackId']);
    leanAppObject.set('appleKind', genres[0]);
    leanAppObject.set('formattedPrice', appstoreObject['formattedPrice']);
    leanAppObject.set('latestReleaseDate', appstoreObject['currentVersionReleaseDate']);
    leanAppObject.set('sellerName', appstoreObject['sellerName']);
    leanAppObject.set('version', appstoreObject['version']);
    leanAppObject.set('excUniqueCode', appstoreObject['trackId'] + appstoreObject['version']);

    appInfoObject.trackName = appstoreObject['trackName'];
    appInfoObject.artworkUrl100 = appstoreObject['artworkUrl100'];
    appInfoObject.artworkUrl512 = appstoreObject['artworkUrl512'];
    appInfoObject.appleId = appstoreObject['trackId'];
    appInfoObject.appleKind = genres[0];
    appInfoObject.formattedPrice = appstoreObject['formattedPrice'];
    appInfoObject.latestReleaseDate = appstoreObject['currentVersionReleaseDate'];
    appInfoObject.excUniqueCode = appstoreObject['trackId'] + appstoreObject['version'];
    appInfoObject.sellerName = appstoreObject['sellerName'];
    appInfoObject.version = appstoreObject['version'];
    appInfoObject.appObjectId = leanAppObject.id;
    appInfoObject.isUpdated = isUpdated;

    appInfoObject.createdAt = leanAppObject.createdAt;
    return appInfoObject;
}


//tools for leancloud
exports.leanObjectListIdList = function(leanObjectList){
    var idList = Array();

    for(var i = 0; i < leanObjectList.length; i++){
        var leanObject = leanObjectList[i];
        if(leanObject != undefined){
            idList.push(leanObject.id);
        }
    }
    return idList;
};

exports.addLeanObject = function(leanObject, leanObjectList){
    if(leanObject == undefined){
        return undefined;
    }
    if(leanObject.id == undefined){
        leanObjectList.push(leanObject);
        return leanObject;
    }
    for (var i = 0; i < leanObjectList.length; i++){
        var temLeanObject = leanObjectList[i];
        if(temLeanObject.id == leanObject.id){
            return temLeanObject;
        }
    }
    leanObjectList.push(leanObject);
    return leanObject;
};

exports.addLeanObjectToDic = function(leanObject, leanObjectDic){
    if(leanObject == undefined || leanObjectDic == undefined){
        return;
    }

    if(leanObjectDic[leanObject.id] == undefined){
        leanObjectDic[leanObject.id] = leanObject;
        return leanObject;
    }

    return leanObjectDic[leanObject.id];
};

//每日任务
var maxSendTaskYCoin = 5;
var maxDoTaskYCoin = 10;
var maxCheckTaskYCoin = 5;

function getMaxDayTaskYCoin(taskKey){
    if(taskKey == 'releaseTaskY'){
        return maxSendTaskYCoin;
    }else if(taskKey == 'doTaskY'){
        return maxDoTaskYCoin;
    }else if(taskKey == 'checkTaskY'){
        return maxCheckTaskYCoin;
    }

    return 0;
}

exports.dayTaskIncrement = function(userId, taskKey, incrementYCoin){
    var userObject = new User();
    userObject.id = userId;

    // 今日日期
    var myDate = new Date();
    var myDateStr = myDate.getFullYear() + '-' + (parseInt(myDate.getMonth())+1) + '-' + myDate.getDate();

    var query = new AV.Query(everydayTaskObjectSql);
    query.equalTo('userObject', userObject);
    query.equalTo('taskDateStr', myDateStr);
    query.include('userObject');
    query.descending('createdAt');
    query.first().then(function(dayTaskObject){
        if (dayTaskObject == undefined){
            // 无今日任务
            var everydayTaskObject = new everydayTaskObjectSql();
            everydayTaskObject.set('taskDateStr', myDateStr);
            everydayTaskObject.set('userObject', userObject);

            if(incrementYCoin > getMaxDayTaskYCoin(taskKey)){
                incrementYCoin = getMaxDayTaskYCoin(taskKey);
            }

            everydayTaskObject.increment(taskKey, incrementYCoin);
            everydayTaskObject.save().then(function(){
                //succeed
                console.success('day task save success ' + userId + ' ,task ' + taskKey, 'add Y Coin ' + incrementYCoin);
            }, function(error){
                console.error('day task save error ' + userId + ' ,task ' + taskKey, 'add Y Coin ' + incrementYCoin);
            });
        }
        else {
            var dayTotalTaskYCoin = dayTaskObject.get(taskKey + 'All');
            if(dayTotalTaskYCoin == undefined){
                dayTotalTaskYCoin = 0;
            }
            var existTaskYCoin = dayTaskObject.get(taskKey);
            if(existTaskYCoin == undefined){
                existTaskYCoin = 0;
            }
            //已经领的 + 可以领的 + 这次增加的 > 最大限额
            if(dayTotalTaskYCoin + incrementYCoin + existTaskYCoin >= getMaxDayTaskYCoin(taskKey)){
                //need do nothing
                return;
            }

            dayTaskObject.increment(taskKey, incrementYCoin);
            //dayTaskObject.increment(taskKey + 'All', incrementYCoin);
            dayTaskObject.save().then(function(){
                //succeed
                console.success('day task save success ' + userId + ' ,task ' + taskKey, 'add Y Coin ' + incrementYCoin);
            }, function(error){
                console.error('day task save error ' + userId + ' ,task ' + taskKey, 'add Y Coin ' + incrementYCoin);
            });
        }

    },function(error){
        console.error('day task save error ' + userId + ' ,task ' + taskKey, 'add Y Coin ' + incrementYCoin);
    });
};

//领取任务信誉系统
exports.reputationForReceiveTask = function(reputation, receiveCount){
    var needReputation = receiveCount * 8 + 60;//60是基数
    if(reputation != undefined && reputation < needReputation){
        return '您的信誉不够（需要 ' + needReputation + ' 信誉）方可一次性领取 ' + receiveCount + ' 条任务';
    }

    return '';
};

//获取制定时间
//大者若为0，则下面为便宜时间
exports.getOffTimer = function(offDays, offHours, offMinutes, offSeconds) {
    var nowTimestamp = new Date().getTime();

    var pointerDayTimestamp = nowTimestamp - (1000*60*60*24*offDays + 1000*60*60*offHours + 1000*60*offMinutes + 1000*offSeconds);
    var pointerDayDate = new Date(pointerDayTimestamp);

    return pointerDayDate;
};

//用户积分获取
exports.getUserPointer = function (userId, callback) {

    var userObject = new AV.User();
    userObject.id = userId;
    var goodPointer, badPointer, userDataObject;
    var queryCounter = 0;

    function dealUserPointer() {
        if(goodPointer != undefined && badPointer != undefined && userDataObject != undefined){
            var userUsedPointer = userDataObject.get('usedPointer');
            if(userUsedPointer == undefined){
                userUsedPointer = 0;
            }
            callback(goodPointer, goodPointer - badPointer - userUsedPointer, userDataObject, undefined);
        }else {
            if(queryCounter == 3){
                callback(0, 0, userDataObject, '网络异常, 积分查询失败');
            }
        }
    }

    var userQuery = new AV.Query('_User');
    userQuery.get(userId).then(function (userObject) {
        queryCounter++;
        userDataObject = userObject;
        dealUserPointer();
    }, function (error) {
        queryCounter++;
        console.error('pointerQuery  user query error ', error.message);
        dealUserPointer();
    });

    var goodPointerQuery = new AV.Query(mackTaskInfo);
    goodPointerQuery.equalTo('doTaskUser', userObject);
    goodPointerQuery.containedIn('taskStatus', ['accepted', 'systemAccepted']);
    goodPointerQuery.count().then(function (totalCount) {
        queryCounter++;
        goodPointer = totalCount;
        dealUserPointer();
    }, function (error) {
        queryCounter++;
        console.error('goodPointerQuery query error ', error.message);
        dealUserPointer();
    });

    var badPointerQuery = new AV.Query(mackTaskInfo);
    badPointerQuery.equalTo('doTaskUser', userObject);
    badPointerQuery.equalTo('taskStatus', 'expired');
    badPointerQuery.count().then(function (totalCount) {
        queryCounter++;
        badPointer = totalCount;
        dealUserPointer();
    }, function (error) {
        queryCounter++;
        console.error('badPointerQuery query error ', error.message);
        dealUserPointer();
    });
};

//shop

exports.getPlanDetail = function (planId, planObject) {
    var planObject = {};
    if(planId == '2016_11_11_buy_1111_special_plan'){
        planObject.set('price', 1888);
        //TODO:
    }
};

//商品限购规则
exports.canProductBuy = function(productId, goods) {

    //解析商品售卖规则
    //只有limit 限购 1 份
    //month_limit 月限购1份
    var month_limit = false;
    var total_limit = false;
    if(productId.indexOf('month_limit') >= 0){
        month_limit = true;
    }else if(productId.indexOf('total_limit') >= 0){
        total_limit = true;
    }

    if(month_limit == true || total_limit == true){
        var nowDate = new Date();
        if(goods.length == 0){
            return true;
        }
        for (var i = 0; i < goods.length; i++){
            var goodObject = goods[i];
            var goodProductId = goodObject.get('productId');

            if(goodProductId == undefined){
                continue;
            }

            if(productId == goodProductId){
                //用户已经购买过的product
                if(total_limit == true){
                    //限购，无法购买
                    return false;
                }else {
                    //看看最近是不是在1个月内购买的
                    var buyedCreateDate = goodObject.createdAt;
                    if((nowDate.getFullYear() == buyedCreateDate.getFullYear()) && (nowDate.getMonth() == buyedCreateDate.getMonth())){
                        //同一年同一月
                        //无法购买
                        return false;
                    }else {
                        //非同一年 或 非同一月
                        //可以购买
                        return true;
                    }
                }
            }
        }
    }

    return true;
};

exports.getYCoinGoodItemById = function(yCoinProductId) {

    // 1.38元购买588Y币（月限购1次） （这算基本下载/好评价格）
    // 2.充值99元,获1980Y币（首冲）
    // 3.111元购买1888Y币（双11特别活动 限111份）
    var YCoinGoodItem = {};
    YCoinGoodItem.productId = yCoinProductId;

    if(yCoinProductId == 'yCoin_month_limit_38'){
        YCoinGoodItem.price = 38;
        YCoinGoodItem.yCoin = 588;
        YCoinGoodItem.title = '38元购买';
        YCoinGoodItem.subTitle = '轻松一星期';
        YCoinGoodItem.comment = '每月福利';
        YCoinGoodItem.lable = '每月限购一次';
        YCoinGoodItem.icon = '/images/shop/Yb.png';
    }else if(yCoinProductId == 'yCoin_total_limit_99'){
        YCoinGoodItem.price = 99;
        YCoinGoodItem.yCoin = 1980;
        YCoinGoodItem.title = '99元购买';
        YCoinGoodItem.subTitle = '首冲超值优惠';
        YCoinGoodItem.comment = '首冲大礼包';
        YCoinGoodItem.lable = '帐号限购一次';
        YCoinGoodItem.icon = '/images/shop/Yb.png';
    }
    // 4.500 元购买 6000 Y币（不限购1.2）（2.08 2.5）
    // 5.1000 元购买 12500 Y币（不限购1.25） （1.92 2.31）
    // 6.2000 元购买 26000 Y币（不限购1.3） （1.92 2.31）
    // 7.5000 元购买 67500 Y币（不限购1.35） （1.78 2.14）
    // 8.10000 元购买 140000 Y币（不限购1.4） （1.78 2.14）
    else if(yCoinProductId == 'yCoin_120_500'){
        YCoinGoodItem.price = 500;
        YCoinGoodItem.yCoin = 6000;
        YCoinGoodItem.title = '500元购买';
        YCoinGoodItem.subTitleA = '价值一个月每天8条下载/6条好评';
        YCoinGoodItem.keyWordHeat = '适合热度<5000 关键词';
        YCoinGoodItem.icon = '/images/shop/card-18.png';
    }else if(yCoinProductId == 'yCoin_125_1000'){
        YCoinGoodItem.price = 1000;
        YCoinGoodItem.yCoin = 12500;
        YCoinGoodItem.title = '1000元购买';
        YCoinGoodItem.subTitleA = '价值一个月每天18条下载/14条好评';
        YCoinGoodItem.keyWordHeat = '适合热度<6000 关键词';
        YCoinGoodItem.icon = '/images/shop/card-18.png';
    }else if(yCoinProductId == 'yCoin_130_2000'){
        YCoinGoodItem.price = 2000;
        YCoinGoodItem.yCoin = 26000;
        YCoinGoodItem.title = '2000元购买';
        YCoinGoodItem.subTitleA = '价值一个月每天45条下载/28条好评';
        YCoinGoodItem.keyWordHeat = '适合热度<7000 关键词';
        YCoinGoodItem.icon = '/images/shop/card-18.png';
    }else if(yCoinProductId == 'yCoin_135_5000'){
        YCoinGoodItem.price = 5000;
        YCoinGoodItem.yCoin = 67500;
        YCoinGoodItem.title = '5000元购买';
        YCoinGoodItem.subTitleA = '价值一个月内每天112条下载';
        YCoinGoodItem.keyWordHeat = '适合热度<8000 关键词';
        YCoinGoodItem.icon = '/images/shop/card-18.png';
    }else if(yCoinProductId == 'yCoin_140_10000'){
        YCoinGoodItem.price = 10000;
        YCoinGoodItem.yCoin = 140000;
        YCoinGoodItem.title = '10000元购买';
        YCoinGoodItem.subTitleA = '价值一个季度每天75条下载/50条好评';
        YCoinGoodItem.keyWordHeat = '适合全面优化你的App';
        YCoinGoodItem.icon = '/images/shop/card-18.png';
    }

    return YCoinGoodItem;
};

//toDay true 到天
//toDay false 到分钟
exports.dateToString = function (aDate, toDay) {
    var yearMonthDayStr = aDate.getFullYear() + '-' + (aDate.getMonth() + 1) + '-' + aDate.getDate();
    if(toDay == true){
        return yearMonthDayStr;
    }

    return yearMonthDayStr + ' ' + aDate.getHours() + ':' + aDate.getMinutes() + ':' + aDate.getSeconds();
};

exports.updateIOSAppInfo = updateIOSAppInfo;
