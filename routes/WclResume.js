var express = require('express');
var router = express.Router();
var AV = require('leanengine');
var util = require('./util');
var tryPriceUtil = require('../utils/tryPriceUtil');
var Base64 = require('../public/javascripts/vendor/base64').Base64;


router.get('/', function(req, res) {
    res.render('wucailong_profile');
});

module.exports = router;