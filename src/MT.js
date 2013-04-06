/*
 * 
 */
var MT = (function(self){

    self.define = _define;  
    self.get = _get;
    self.getId = _getId;
    self.extend = _extend;
    self.env = _env;
    self.ajax = _ajax;
    self.format = _format;
    self.JSON = JSON;
    self.b64HmacSha1 = b64_hmac_sha1;
    
    self.on = function(){
        observe.on.apply(observe, arguments);
    };
    self.off = function(){
        observe.off.apply(observe, arguments);
    };
    self.fire = function(event){
        observe.fire.apply(observe, arguments);
    };
    self.init = _init;   
    
    function Observable(){
    }
    Observable.prototype = {
        on: function(){
            $.fn.on.apply(__getObserve.call(this), arguments);
            return this;            
        },
        off: function(){
            $.fn.off.apply(__getObserve.call(this), arguments);
            return this;           
        },
        fire: function(){
            var data = [];
            if(arguments.length>1) for(var i=1; i<arguments.length; i++){
                data.push(arguments[i]);
            }
            $.fn.triggerHandler.call(__getObserve.call(this), arguments[0], data);
            return this;         
        }
    }    
    
    var _ = window._,
        moment = window.moment,
        $ = window.$,
        
        env = {},
        classes = {},
        observe = new Observable();
    

    function __getObserve(){
        if(!this.__observe) this.__observe = $(this);
        return this.__observe;
    }  
    function _init(data, clbFn){
        for(var p in data){
            _env(p, data[p]);
        }
        self.fire('init');
        if(clbFn) clbFn.call(self);
    }
    function _define(name, data){  

        var inheritCls = data.extend || Observable,
            cls = data.constructor || function() {inheritCls.apply(this, arguments);},
            F = function() {};
        
        F.prototype = inheritCls.prototype;    
        
        var clsProto = cls.prototype = new F();
        clsProto.constructor = cls;
        cls.__super__ = inheritCls.prototype;
        
        _extend(cls.prototype, data.publics);
        _extend(cls, data.statics);
        
        classes[name] = cls;
        
        return cls;
    }
    function _get(name){
        return classes[name];
    }
    function _getId(prefix){
        return _.uniqueId(prefix);
    }
    function _format(value, format, params){
        if(value instanceof Date){
            var m = moment(value);
            if(params && params.utc) m.utc();
            return m.format(format);
        }
    }
    function _env(name, value){
        if(arguments.length == 2){
            var stack = [[name, value]];
            while (stack.length > 0){
                current = stack.pop();
                if( $.isPlainObject(current[1])) {
                    for(var p in current[1]) {
                        stack.push([current[0] + '.' + p, current[1][p]]);
                    }
                } else {
                    env[current[0]] = current[1];
                }
            }            
            return;
        }
        return env[name];
    }
    function _ajax(data){
        if(!$.flXHRproxy.isRegister(data.url)) {
            $.flXHRproxy.registerOptions(data.url);
        }
        return $.ajax(data);
    }
    function _extend(){
        return _.extend.apply(_, arguments);
    }
    
    delete window._;
    //delete window.$;
    delete window.moment;
    return self;
    
})(window.MT || {});
