/**
 * Created by wujiangwei on 2016/11/5.
 */
/**
 * Created by wujiangwei on 2016/10/23.
 */

var AV = require('leanengine');

var ASOKeyRankSQL = AV.Object.extend('ASOKeyRankObject');
var IOSAppInfoSQL = AV.Object.extend('IOSAppInfo');

exports.recordAppASOKey = function (appleId, asoKey, asoRank, appObjectId) {
    var query = new AV.Query(ASOKeyRankSQL);
    query.equalTo('appleId', appleId);
    query.equalTo('asoKey', asoKey);

    query.find().then(function(ASOKeyRanks){
        var ASOKeyRankObject;
        if(ASOKeyRanks.length == 0){
            ASOKeyRankObject = new ASOKeyRankSQL();
            ASOKeyRankObject.set('asoKey', asoKey);
            ASOKeyRankObject.set('rank', asoRank);
            ASOKeyRankObject.set('appleId', appleId);
            ASOKeyRankObject.set('appObjectId', appObjectId);
            var appObject = new IOSAppInfoSQL();
            appObject.id = appObjectId;
            ASOKeyRankObject.set('appObject', appObject);
            ASOKeyRankObject.set('asoCount', 1);
            ASOKeyRankObject.set('isRoot', true);
        }else {
            ASOKeyRankObject = ASOKeyRanks[0];
            ASOKeyRankObject.increment('asoCount', 1);
        }

        ASOKeyRankObject.save().then(function () {
            //saved succeed
        }, function (error) {
            console.error('record app aso key(save) error : ', error.message);
        });

    },function(error){
        console.error('record app aso key(query) error : ', error.message);
    })
};