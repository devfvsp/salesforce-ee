'use strict';

/**
 * Controller for payment gateway transactions in business manager
 * @module controllers/PaymentGateway
 */

/* Script Modules */
var app = require('~/cartridge/scripts/app');
var guard = require('~/cartridge/scripts/guard');

var StringUtils = require('dw/util/StringUtils');
var URLUtils = require('dw/web/URLUtils');
var Logger = require('dw/system/Logger').getLogger('paymentgateway');

/**
 * Renders the transaction overview in business manager
 * @see {@link module:controllers/PaymentGateway~transactions}
 */
exports.Transactions = guard.ensure(['get', 'https'], function () {
    var parameterMap = request.httpParameterMap;
    var pageSize = parameterMap.sz.intValue || 30;
    var start = parameterMap.start.intValue || 0;
    var orderID = parameterMap.OrderID.value;

    var OrderMgr = require('dw/order/OrderMgr');
    var Order = require('dw/order/Order');
    // fetch all orders with payment gateway payment method
    var orderResult;
    if (orderID) {
        orderResult = OrderMgr.queryOrders(
            'custom.paymentGatewayTransactions != NULL AND status != {0} AND UUID = {1}',
            'orderNo desc',
            Order.ORDER_STATUS_FAILED,
            orderID
        );
    } else {
        orderResult = OrderMgr.queryOrders(
            'custom.paymentGatewayTransactions != NULL AND status != {0}',
            'orderNo desc',
            Order.ORDER_STATUS_FAILED
        );
    }

    var PagingModel = require('dw/web/PagingModel');
    var orderPagingModel = new PagingModel(orderResult, orderResult.count);
    orderPagingModel.setPageSize(pageSize);
    orderPagingModel.setStart(start);

    app.getView({
        OrderPagingModel: orderPagingModel
    }).render('paymentgateway/transactions/overview');
});

/**
 * Display single transaction
 */
exports.TransactionDetail = guard.ensure(['get', 'https'], function () {
    var parameterMap = request.httpParameterMap;
    var orderNo = parameterMap.orderNo.value;
    var transactionId = parameterMap.transactionId.value;

    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(orderNo);
    if (!(order instanceof dw.order.Order)) {
        Logger.error('No valid order found for given orderNo!');
        response.redirect(URLUtils.https('PaymentGateway-Transactions'));
    } else {
        var transactionHelper = require('*/cartridge/scripts/paymentgateway/helper/TransactionHelper');
        try {
            // fetch possible error message from backend operation failure
            var msg = JSON.parse(session.privacy.paymentGatewayMsg) || {};
            var displayMsg;
            delete session.privacy.paymentGatewayMsg;
            if (Object.prototype.hasOwnProperty.call(msg, 'message')) {
                displayMsg = msg.message;
            }

            var transactionData = transactionHelper.getPaymentGatewayTransactionData(order, transactionId);
            app.getView({
                isSuccess  : Object.prototype.hasOwnProperty.call(msg, 'success'),
                Message    : displayMsg,
                Order      : order,
                Transaction: transactionData
            }).render('paymentgateway/transactions/details');
        } catch (err) {
            response.redirect(URLUtils.https('PaymentGateway-Transactions'));
        }
    }
});

/**
 * Execute operation for given order & transaction
 */
exports.ExecuteOperation = guard.ensure(['post', 'https'], function () {
    var parameterMap = request.httpParameterMap;
    var orderNo = parameterMap.orderNo.value;
    var transactionId = parameterMap.transactionId.value;
    var operation = parameterMap.operation.value;

    var Resource = require('dw/web/Resource');
    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(orderNo);

    // default message
    var msg = { message: 'No valid order found for given orderNo!' };

    if (!(order instanceof dw.order.Order)) {
        Logger.error(msg.message);
    } else {
        var backendOperation = require('*/cartridge/scripts/paymentgateway/BackendOperation');
        try {
            var result = backendOperation.callService(
                order,
                {
                    action           : operation,
                    amount           : parameterMap.amount.value,
                    transactionId    : transactionId,
                    merchantAccountId: parameterMap.merchantAccountId.value
                }
            );
            if (result.transactionState !== 'success') {
                msg.message = StringUtils.format(
                    'Operation [{0}] failed: {1}',
                    operation,
                    result.status.description
                );
            } else {
                msg.message = Resource.msg('success_new_transaction', 'paymentgateway', null);
                msg.success = 1;
            }
        } catch (err) {
            Logger.error(
                StringUtils.format(
                    'Error while executing "{0}" for transaction {1}!',
                    operation,
                    transactionId
                )
            );
            msg.message = err.message;
        }
    }
    session.privacy.paymentGatewayMsg = JSON.stringify(msg);
    response.redirect(URLUtils.https('PaymentGateway-TransactionDetail', 'orderNo', orderNo, 'transactionId', transactionId));
});

/**
 * Display http user / password overview
 */
exports.HttpAccessOverview = guard.ensure(['get', 'https'], function () {
    /**
     * Helper function to retrieve specific config value
     * @param {string} key - site preference name
     * @returns {string}
     */
    var Site = require('dw/system/Site').getCurrent();
    var getSitePreference = function (key) {
        var result = Site.getCustomPreferenceValue(key);
        if (!result) {
            result = '';
        }
        return result;
    };

    var httpCredentials = [
        {
            methodID: 'PayPal',
            user    : getSitePreference('paymentGatewayPayPalHttpUser'),
            password: getSitePreference('paymentGatewayPayPalHttpPassword')
        }
    ];
    app.getView({
        HttpAccessData: httpCredentials
    }).render('paymentgateway/httpaccesstest');
});

/**
 * Check http user / password
 */
exports.HttpAccessTest = guard.ensure(['post', 'https'], function () {
    var parameterMap = request.httpParameterMap;
    var userName = parameterMap.user.value;
    var password = parameterMap.password.value;
    var result;

    try {
        var service = require('*/cartridge/scripts/paymentgateway/services/TestHttpCredentials')(userName, password);
        result = service.call();
        // 404 means acknowledged otherwise api responds with 401 unauthorized
        if (result.error !== 404) {
            throw new Error(result.errorMessage);
        }
        response.setStatus(200);
    } catch (err) {
        response.setStatus(510);
        Logger.error(
            StringUtils.format(
                'Invalid merchant credentials for {0}\n {1}',
                parameterMap.methodID,
                result
            )
        );
    }
});

/**
 * Retrieve complete transaction xml
 */
exports.GetTransactionXML = guard.ensure(['post', 'https'], function () {
    var parameterMap = request.httpParameterMap;
    var transactionId = parameterMap.transactionId.value;
    var paymentMethodID = parameterMap.paymentMethodID.value;

    var preferenceHelper = require('*/cartridge/scripts/paymentgateway/PreferencesHelper');
    var preferences = preferenceHelper.getPreferenceForMethodID(paymentMethodID);
    var data = '<?xml version="1.0" encoding="UTF-8"?>'
          + '<payment xmlns="http://www.elastic-payments.com/schema/payment">'
          + 'NO TRANSACTION DATA'
          + '</payment>';

    try {
        var userName = preferences.userName;
        var password = preferences.password;

        var HashMap = require('dw/util/HashMap');
        var params = new HashMap();
        params.put('merchantAccountID', preferences.merchantAccountID);
        params.put('transactionID', transactionId);

        var service = require('*/cartridge/scripts/paymentgateway/services/GetTransaction')(userName, password);
        var result = service.call(params);
        if (!result || result.status != 'OK') {
            throw new Error('Api-error: ' + result.errorMessage);
        }
        data = result.object;
    } catch (err) {
        Logger.error(
            StringUtils.format(
                'Error while retrieving transaction XML for transactionId {0}\n {1}',
                transactionId,
                err.message
            )
        );
    }
    response.setContentType('application/xml');
    response.writer.print(data);
});