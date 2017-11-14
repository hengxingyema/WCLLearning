/**
 * Created by tanghui on 16/7/27.
 */
'use strict';
var router = require('express').Router();
var AV = require('leanengine');
var util = require('./util');
var https = require('https');

router.get('/', function(req, res) {
    res.render('userProtocol');
});
module.exports = router;