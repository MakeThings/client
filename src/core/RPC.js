(function(MT){

    var RPC = MT.define('RPC', {
        constructor: __constructor,
        statics: {
            call: _call
        },
        publics: {
            
        }
    });
    
    var cXhr = [],
        cToDelete = [];
    
    MT.on('init', function(){
        doReadResponse();
        doRequestTimeout();
        doDelete();
    });    
    function doDelete(){
        var toDelete,
            data;
            
        while(cToDelete.length > 0){
            toDelete = cToDelete.splice(0, Math.min(10, cToDelete.length));
            data = {
                'Action': 'DeleteMessageBatch'
            }
            for(var i=0; i<toDelete.length; i++){
                data['DeleteMessageBatchRequestEntry.'+(i+1)+'.Id'] = toDelete[i][0];
                data['DeleteMessageBatchRequestEntry.'+(i+1)+'.ReceiptHandle'] = toDelete[i][1];
            }
            _sendSQS(MT.env('session.ResponseQueue'), data);           
        }
        setTimeout(doDelete, 10000);
    }
    function doRequestTimeout(){
        var xhr,
            time = new Date().getTime();
        while(true){
            xhr = cXhr[0];
            if(!xhr || time - xhr.__requestTime < 15000 ) break;
            cXhr.splice(0,1);
            try {
                if(cXhr[xhr.__id]) {
                    delete cXhr[xhr.__id];
                    xhr.fire('fail');
                    xhr.fire('always');
                }
            } catch (e) {
                console.log(e);
            }
        }
        setTimeout(doRequestTimeout, 1000);
    }
    function doReadResponse(){
         var queue = MT.env('session.ResponseQueue'),
             data = {
                'Action': 'ReceiveMessage',
                'MaxNumberOfMessages': 10
             };
             
         if(!queue) {
            setTimeout(doReadResponse, 1000);
            return;
         }
         
         _sendSQS(queue, data)
            .done(function(resp){
                try {
                    var $resp = $(resp),
                        responseId = $resp.find('RequestId').text();
                    $resp.find('Message').each(function(){
                        var node = $(this),
                            message = MT.JSON.parse(node.find('Body').text()),
                            messageId = node.find('MessageId').text(),
                            ReceiptHandle = node.find('ReceiptHandle').text();
                            
                        cToDelete.push([messageId, ReceiptHandle]);
                        _reciveResponse(message, responseId);
                    });
                 } catch (e){
                    console.log(e);
                 }
            })
            .always(function(){setTimeout(doReadResponse, 500)})       
    } 
    function __constructor(method, data, clbFn){
        this.__id = MT.getId(new Date().getTime() + '_');
        if(clbFn) this.on('done', clbFn);
        __sendRequest.call(this, method, data);
    }
    function _call(method, data, clbFn){
        return new RPC(method, data, clbFn);
    }
    function __sendRequest(method, data){
    
        var self = this,
            aMethod = method.split('.'),
            rpcAction = aMethod.splice(0,1).join(''),
            rpcMethod = aMethod.join('.');
            
         this.__requestTime = new Date().getTime(); 
           
         cXhr[this.__id] = this;
         cXhr.push(this);
            
        _sendSQS(_getUrlSQS(rpcAction), {
            'Action': 'SendMessage',
            'MessageBody': MT.JSON.stringify({
                'SId': MT.env('session.SId'),
                'Req': _JSON_RPC(rpcMethod, this.__id, data)
            })
        })
            .done(function(resp){
                if($(resp).find('MessageId').length > 0) {
                    success = true;
                }
            })
            .always(function(){
                if(!success) {
                    delete cXhr[self.__id];
                    self.fire('fail');
                    self.fire('always');
                }
            });
    }
    function _sendSQS(url, data){
        
        url = url.replace(/^https/i,'http');
        
        var time = new Date(),
            success = false,
            messageBody = _signatureSQS(MT.extend({
                'SignatureVersion': 1,
                'Timestamp': MT.format(time,'YYYY-MM-DDTHH:mm:ss.000[Z]', {utc: true}),
                'Version': '2011-10-01',
                'QueueUrl': url
            }, data));
        
        // Send cross-domain request
        return MT.ajax({
            url: url,
            data: messageBody,
            type: 'POST',
            dataType: 'xml'
        });
    }
    function _signatureSQS(data){
        var body = '',
            toSign = [];
        for(var p in data){
            body += p+'='+encodeURIComponent(data[p])+'&';
            toSign.push();
        }
        body += "AWSAccessKeyId=" + encodeURIComponent(MT.env('demo.AccessKeyId')); // TODO
        body += "&Signature=" + encodeURIComponent(_generateV1Signature(body, MT.env('demo.SecureKeyId')));  // TODO 
        
        return body;
    }
    function _generateV1Signature(body, key){
        var stringToSign = _getStringToSign(body),
            signed =   MT.b64HmacSha1(key, stringToSign);
        return signed;        
    }
    function _ignoreCaseSort(a, b) {
        var ret = 0;
        a = a.toLowerCase();
        b = b.toLowerCase();
        if(a > b) ret = 1;
        if(a < b) ret = -1;
        return ret;
    }
    function _getStringToSign(query) {

        var stringToSign = "";

        var params = query.split("&");
        params.sort(_ignoreCaseSort);
        for (var i = 0; i < params.length; i++) {
            var param = params[i].split("=");
            var name =   param[0];
            var value =  param[1];
            if (name == 'Signature' || undefined  == value) continue;
                stringToSign += name;
                stringToSign += decodeURIComponent(value);
             }

        return stringToSign;
    }      
    function _getUrlSQS(method){
        return MT.env('session.RemoteServices.' + method);
    }
    function _reciveResponse(message, responseId){
        var id = message.Req.id, // TODO
            xhr =  cXhr[id];
        
        if(!xhr) return;
        
        delete cXhr[id];
        xhr.fire('done', message, {responseId: responseId}); // TODO
        xhr.fire('always');
    }
    function _JSON_RPC(method, id, params){
        return {"jsonrpc": "2.0", "method": method, "params": params, "id": id};
    }
})(MT);

