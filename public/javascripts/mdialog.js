/*  
 * @弹出提示层 ( 加载动画(load), 提示动画(tip), 成功(success), 错误(error), )  
 * @method  tipBox  
 * @description 默认配置参数   
 * @time    2016-12-14
 * @param {Number} width -宽度  
 * @param {Number} height -高度         
 * @param {String} str -默认文字  
 * @param {Object} windowDom -载入窗口 默认当前窗口  
 * @param {Number} setTime -定时消失(毫秒) 默认为0 不消失  
 * @param {Boolean} hasMask -是否显示遮罩  
 * @param {Boolean} hasMaskWhite -显示白色遮罩   
 * @param {Boolean} clickDomCancel -点击空白取消  
 * @param {Function} callBack -回调函数 (只在开启定时消失时才生效)  
 * @param {Function} hasBtn -显示按钮  
 * @param {String} type -动画类型 (加载,成功,失败,提示)  
 * @example   
 * new TipBox();   
 * new TipBox({type:'load',setTime:1000,callBack:function(){ alert(..) }});   
*/  
function TipBox(cfg){  
    this.config = {   
        width          : 300,
        height         : 370,
        str            : '正在处理',       
        windowDom      : window,   
        setTime        : 0,     
        hasMask        : true,    
        hasMaskWhite   : false,   
        clickDomCancel : false,    
        callBack       : null, 
        hasBtn         : false,
        hasButton       : false,
        type           : 'success'  
    }
    $.extend(this.config,cfg);

    //存在就retrun  
    if(TipBox.prototype.boundingBox) return;  
      
    //初始化  
    this.render(this.config.type);    
    return this;   
};  
  
//外层box  
TipBox.prototype.boundingBox = null;  
  
//渲染  
TipBox.prototype.render = function(tipType,container){    
    this.renderUI(tipType);   
      
    //绑定事件  
    this.bindUI();   
      
    //初始化UI  
    this.syncUI();   
    $(container || this.config.windowDom.document.body).append(TipBox.prototype.boundingBox);     
};  
  
//渲染UI  
TipBox.prototype.renderUI = function(tipType){   
    TipBox.prototype.boundingBox = $("<div id='animationTipBox'></div>");
    tipType == 'load'    && this.loadRenderUI();
    tipType == 'success' && this.successRenderUI();   
    tipType == 'error'   && this.errorRenderUI();  
    tipType == 'tip'     && this.tipRenderUI();
    tipType == 'confirm' && this.confirmRenderUI();
    tipType == 'assistant' && this.assistantRenderUI();
    tipType == 'await' && this.awaitRenderUI();
    tipType == 'topUp'   && this.topUpRenderUI();
    TipBox.prototype.boundingBox.appendTo(this.config.windowDom.document.body);  
                  
    //是否显示遮罩  
    if(this.config.hasMask){
        this.config.hasMaskWhite ? this._mask = $("<div class='mask_white'></div>") : this._mask = $("<div class='mask'></div>");
        this._mask.appendTo(this.config.windowDom.document.body);
    }
    // 是否显示按钮
    if(this.config.hasBtn){
        this.config.height = 226;
        $('#animationTipBox').css("margin-top","103px");
        switch(this.config.type){
            case 'success':$(".success").after("<button class='okoButton'>确认</button>");
                break;
            case 'error':$(".lose").after("<button class='cancelButton'>取消</button><button class='reopenApp'>重新打开</button>");
                break;
            case 'tip':$(".tip").after("<button class='cancelButton'>取消</button><button class='okoButton'>放弃任务</button>");
                break;
            case 'confirm':$(".confirm").after("<button class='continueToMakeMoney' style='background-color: #EC4949;height: 47px;width:90%;margin-left:auto;margin-right:auto;border-radius: 5px;color: #FFFFFF'>很好，继续赚钱</button>");
                break;
            case 'assistant':$(".assistant").after("<button class='okButton' style='background-color: #4191FA;height: 47px;width:90%;margin-left:auto;margin-right:auto;border-radius: 5px;color: #FFFFFF'>打开助手</button>");
                break;
            case 'topUp':$(".topUp").after("<button class='cancelButton'>取消</button><button class='confirmTopUp'>确认</button>");
                break;
            default: break;
        }
        $('button.okoButton').on('click',function(){_this.giveUpTask()});
        $('button.cancelButton').on('click',function(){_this.close();});
        $('button.reopenApp').on('click',function(){_this.reopenApp();});
        $('button.continueToMakeMoney').on('click',function(){_this.continueToMakeMoney();});
        $('button.okButton').on('click',function(){_this.openAssistant();});
        $('button.confirmTopUp').on('click',function(){_this.confirmPay()});
    }

    //定时消失  
    _this = this;  
    !this.config.setTime && typeof this.config.callBack === "function" && (this.config.setTime = 1);      
    this.config.setTime && setTimeout( function(){ _this.close(); }, _this.config.setTime );  
};  
  
TipBox.prototype.bindUI = function(){  
    _this = this;             
      
    //点击空白立即取消  
    this.config.clickDomCancel && this._mask && this._mask.click(function(){_this.close();});                        
};  
TipBox.prototype.syncUI = function(){             
    TipBox.prototype.boundingBox.css({  
        width       : this.config.width+'px',  
        height      : this.config.height+'px',  
        marginLeft  : "-"+(this.config.width/2)+'px',  
        marginTop   : "-"+(this.config.height/2)+'px'  
    });   
};  
  
//提示效果UI  
TipBox.prototype.tipRenderUI = function(){
    var tip = "<div class='tip'>";
        tip +="     <img src='images/xiaoma/!.png' class='icon' style='margin-left: 120px'>";
        tip +="     <div class='dec_txt'>"+this.config.str+"</div>";
        tip += "</div>";
    TipBox.prototype.boundingBox.append(tip);
};

// 等待
TipBox.prototype.awaitRenderUI = function(){
    var await = "<div class='await'>";
    await +="     <img src='images/xiaoma/闹钟.png' class='icon' style='margin-left: 120px;margin-top: 30px'>";
    await +="     <div class='dec_txt'>"+this.config.str+"</div>";
    await +="     <div class='dec_txt'>"+this.config.string+"</div>";
    await += "</div>";
    TipBox.prototype.boundingBox.append(await);
};

//成功效果UI  
TipBox.prototype.successRenderUI = function(){  
    var suc = "<div class='success'>";  
        suc +=" <div class='icon'>";  
        suc +=      "<div class='line_short'></div>";  
        suc +=      "<div class='line_long'></div>  ";        
        suc +=  "</div>";  
        suc +=" <div class='dec_txt'>"+this.config.str+"</div>";  
        suc += "</div>";  
    TipBox.prototype.boundingBox.append(suc);  
};

//错误效果UI  
TipBox.prototype.errorRenderUI = function(){
    var err = "<div class='lose'>";
        err +="     <img src='images/xiaoma/!.png' class='icon' style='margin-left: 120px'>";
        err +="     <div class='dec_txt'>"+this.config.str+"</div>";
        err += "</div>";
    TipBox.prototype.boundingBox.append(err);
};

TipBox.prototype.confirmRenderUI = function(){
    var confirm = "<div class='confirm'>";
    confirm +="     <div class='dec_txt' style='color: #EC4949;margin-top: 21px;font-size: 16px'>"+this.config.str+"</div>";
    confirm +="     <div class='dec_txt' style='color: #B3B3B3;margin-top:-10px;font-size: 13px'>"+this.config.string+"</div>";
    confirm +="     <div class='dec_txt' style='color: #F43446;margin-top:-5px;margin-bottom:10px;font-size: 20px'>" + "<span style='font-size: 15px'>+ </span>" + this.config.price+"</div>";
    confirm += "</div>";
    TipBox.prototype.boundingBox.append(confirm);
};

TipBox.prototype.assistantRenderUI = function(){
    var assistant = "<div class='assistant'>";
        assistant +="     <img src='images/xiaoma/!.png' class='icon' style='margin-left: 120px'>";
        assistant +="     <div class='dec_txt' style='color: #999999;margin-top: -3.09vw;font-size: 4.06vw'>"+this.config.str+"</div>";
        assistant += "</div>";
    TipBox.prototype.boundingBox.append(assistant);
};

// 充值弹框提示
TipBox.prototype.topUpRenderUI = function(){
    var topUp = "<div class='topUp'>";
    topUp +="     <div class='dec_txt' style='margin-top: 15px'>确认充值</div>";
    topUp +="     <div class='input-info'>";
    topUp +="           <p class='item-input' style='height: 30px;margin-left: 10px'>";
    topUp +="           <span class='input-label' style='font-size: 16px;color: #666666'>手机号码</span>";
    topUp +="           <span style='font-size: 18px;'>"+this.config.str+"</span>";
    topUp +="           <hr>";
    topUp +="           <p class='item-input' style='height: 30px;margin-left: 10px'>";
    topUp +="           <span class='input-label' style='font-size: 16px;color: #666666'>充值金额</span>";
    topUp +="           <span style='font-size: 18px;color: red;'>"+this.config.string+"</span>&nbsp;元";
    topUp +="     </p></div>";
    topUp +="     </div>";
    TipBox.prototype.boundingBox.append(topUp);
};
  
//加载动画load UI  
TipBox.prototype.loadRenderUI = function(){  
    var load = "<div class='load'>";  
        load += "<div class='icon_box'>";  
    for(var i = 1; i < 4; i++ ){  
        load += "<div class='cirBox"+i+"'>";  
        load +=     "<div class='cir1'></div>";  
        load +=     "<div class='cir2'></div>";  
        load +=     "<div class='cir3'></div>";  
        load +=     "<div class='cir4'></div>";  
        load += "</div>";  
    }  
    load += "</div>";  
    load += "</div>";  
    load += "<div class='dec_txt'>"+this.config.str+"</div>";  
    TipBox.prototype.boundingBox.append(load);  
};  
  
//关闭  
TipBox.prototype.close = function(){      
    TipBox.prototype.destroy();  
    this.destroy();  
    this.config.setTime && typeof this.config.callBack === "function" && this.config.callBack();                  
};  
  
//销毁  
TipBox.prototype.destroy = function(){  
    this._mask && this._mask.remove();  
    TipBox.prototype.boundingBox && TipBox.prototype.boundingBox.remove();   
    TipBox.prototype.boundingBox = null;  
};


// 其他样式
function TipBoxA(cfg){
    this.config = {
        width          : 300,
        height         : 470,
        str            : '正在处理',
        windowDom      : window,
        setTime        : 0,
        hasMask        : true,
        hasMaskWhite   : false,
        clickDomCancel : false,
        callBack       : null,
        hasBtn         : false,
        hasButton       : false,
        type           : 'success'
    }
    $.extend(this.config,cfg);

    //存在就retrun
    if(TipBoxA.prototype.boundingBox) return;

    //初始化
    this.render(this.config.type);
    return this;
};

//外层box
TipBoxA.prototype.boundingBox = null;

//渲染
TipBoxA.prototype.render = function(tipType,container){
    this.renderUI(tipType);

    //绑定事件
    this.bindUI();

    //初始化UI
    this.syncUI();
    $(container || this.config.windowDom.document.body).append(TipBoxA.prototype.boundingBox);
};

//渲染UI
TipBoxA.prototype.renderUI = function(tipType){
    TipBoxA.prototype.boundingBox = $("<div id='animationTipBox'></div>");
    //tipType == 'topUp'   && this.topUpRenderUI();
    TipBoxA.prototype.boundingBox.appendTo(this.config.windowDom.document.body);

    //是否显示遮罩
    if(this.config.hasMask){
        this.config.hasMaskWhite ? this._mask = $("<div class='mask_white'></div>") : this._mask = $("<div class='mask'></div>");
        this._mask.appendTo(this.config.windowDom.document.body);
    }
    // 是否显示按钮
    if(this.config.hasBtn){
        this.config.height = 226;
        $('#animationTipBox').css("margin-top","103px");
        switch(this.config.type){
            case 'success':$(".success").after("<button class='okoButton'>确认</button>");
                break;
            case 'error':$(".lose").after("<button class='okoButton redOkoButton'>确认</button>");
                break;
            //case 'topUp':$(".topUp").after("<button class='cancelButton'>取消</button><button class='confirmTopUp'>确认</button>");
            //    break;
            default: break;
        }
        //$('button.confirmTopUp').on('click',function(){_this.confirmPay()});
        $('button.cancelButton').on('click',function(){_this.close();});
    }

    //定时消失
    _this = this;
    !this.config.setTime && typeof this.config.callBack === "function" && (this.config.setTime = 1);
    this.config.setTime && setTimeout( function(){ _this.close(); }, _this.config.setTime );
};

TipBoxA.prototype.bindUI = function(){
    _this = this;

    //点击空白立即取消
    this.config.clickDomCancel && this._mask && this._mask.click(function(){_this.close();});
};
TipBoxA.prototype.syncUI = function(){
    TipBoxA.prototype.boundingBox.css({
        width       : this.config.width+'px',
        height      : this.config.height+'px',
        marginLeft  : "-"+(this.config.width/2)+'px',
        marginTop   : "-"+(this.config.height/2)+'px'
    });
};

//// 充值弹框提示
//TipBoxA.prototype.topUpRenderUI = function(){
//    var topUp = "<div class='topUp'>";
//    topUp +="     <div class='dec_txt' style='margin-top: 15px'>确认充值</div>";
//    topUp +="     <div class='input-info'>";
//    topUp +="           <p class='item-input' style='height: 30px;margin-left: 10px'>";
//    topUp +="           <span class='input-label' style='font-size: 16px;color: #666666'>手机号码</span>";
//    topUp +="           <span style='font-size: 18px;'>"+this.config.str+"</span>";
//    topUp +="           <hr>";
//    topUp +="           <p class='item-input' style='height: 30px;margin-left: 10px'>";
//    topUp +="           <span class='input-label' style='font-size: 16px;color: #666666'>充值金额</span>";
//    topUp +="           <span style='font-size: 18px;color: red;'>"+this.config.string+"</span>&nbsp;元";
//    topUp +="     </p></div>";
//    topUp +="     </div>";
//    TipBoxA.prototype.boundingBox.append(topUp);
//};

//关闭
TipBoxA.prototype.close = function(){
    TipBoxA.prototype.destroy();
    this.destroy();
    this.config.setTime && typeof this.config.callBack === "function" && this.config.callBack();
};

//销毁
TipBoxA.prototype.destroy = function(){
    this._mask && this._mask.remove();
    TipBoxA.prototype.boundingBox && TipBoxA.prototype.boundingBox.remove();
    TipBoxA.prototype.boundingBox = null;
};