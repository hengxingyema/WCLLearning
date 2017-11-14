/**
 * Created by tanghui on 16/5/31.
*/
'use strict';
var router = require('express').Router();
var util = require('./util');

// 加载静态html
router.get('/:htmlName', function(req, res) {
    var htmlName = req.params.htmlName;
    return res.render(htmlName);
});

// 导航栏
router.get('/:htmlApp/:htmlName', function(req, res) {
    var htmlApp = req.params.htmlApp;
    var htmlName = req.params.htmlName;
    return res.render(htmlApp +'/' + htmlName);
});

module.exports = router;
