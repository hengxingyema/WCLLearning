/**
 * Created by tanghui on 16/7/28.
 */
/**
 * Created by tanghui on 16/7/28.
 */
/**
 * Created by tanghui on 16/7/27.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

var IOSAppSql = AV.Object.extend('IOSAppInfo');
var IOSAppBinder = AV.Object.extend('IOSAppBinder');
var IOSAppExcLogger = AV.Object.extend('IOSAppExcLogger');

router.get('/', function(req, res) {
    res.render('contactUs');
});
module.exports = router;