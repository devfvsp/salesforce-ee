/**
 * Script includes
 */
var HTTPBaseService = require('./HTTPBaseService');

var GetTransaction = HTTPBaseService.extend({
    init: function (httpUser, httpPassword) {
        // call parent init method to set service name
        var serviceName = 'wirecard.paymentgateway';
        this._super(serviceName);

        // set authentication method
        this.authentication = 'BASIC';

        // request header
        var authorizationHash = this.getAuthorizationHash(httpUser, httpPassword);
        this.requestHeaders = {
            'Content-type': 'application/json',
            Authorization: 'Basic ' + authorizationHash
        };
        this.requestMethod = 'GET';
    },

    /**
     * Prepare the request i.e. create request body as json
     * @param {dw.svc.HTTPService}    svc       The service itself
     * @param {dw.util.Map}           params    Map of key value pairs that have to be added as parameters to the call
     * @return String The string that has to be sent to the service
     */
    createRequest: function (svc, params) {
        // sets the service call endpoint
        svc.URL = [
            svc.URL,
            'engine/rest/merchants',
            params.get('merchantAccountID'),
            'payments',
            params.get('transactionID')
        ].join('/');

        // adding header values
        if (!empty(this.requestHeaders)) {
            for (var headerID in this.requestHeaders) {
                svc.addHeader(headerID, this.requestHeaders[headerID]);
            }
        }

        // setting the authentication mechanism
        svc.setAuthentication(this.authentication);

        // setting request method
        svc.setRequestMethod(this.requestMethod);
        return params;
    },

    /**
     * Retrieves the auth header hash.
     * @param {String} userName
     * @param {String} password
     * @returns {String}
     */
    getAuthorizationHash: function (userName, password) {
        var Encoding = require('dw/crypto/Encoding');
        var Bytes = require('dw/util/Bytes');
        var bytes = new Bytes(userName + ':' + password, this.encoding);
        return Encoding.toBase64(bytes);
    }
});

// Export the service
module.exports = function (userName, password) {
    return (new GetTransaction(userName, password)).getService();
};
