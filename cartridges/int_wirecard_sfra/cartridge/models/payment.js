/**
 * Shop System Plugins:
 * - Terms of Use can be found under:
 * https://github.com/wirecard/salesforce-ee/blob/master/_TERMS_OF_USE
 * - License can be found under:
 * https://github.com/wirecard/salesforce-ee/blob/master/LICENSE
 */
/* eslint-disable max-len */
'use strict';

var collections = require('*/cartridge/scripts/util/collections');

var base = module.superModule;

/**
 * Creates an array of objects containing selected payment information
 * @param {dw.util.ArrayList<dw.order.PaymentInstrument>} selectedPaymentInstruments - ArrayList
 *      of payment instruments that the user is using to pay for the current basket
 * @returns {Array} Array of objects that contain information about the selected payment instruments
 */
function getSelectedPaymentInstruments(selectedPaymentInstruments) {
    return collections.map(selectedPaymentInstruments, function (paymentInstrument) {
        var results = {
            paymentMethod: paymentInstrument.paymentMethod,
            amount: paymentInstrument.paymentTransaction.amount.value
        };
        if (paymentInstrument.paymentMethod === 'CREDIT_CARD') {
            results.lastFour = paymentInstrument.creditCardNumberLastDigits;
            results.owner = paymentInstrument.creditCardHolder;
            results.expirationYear = paymentInstrument.creditCardExpirationYear;
            results.type = paymentInstrument.creditCardType;
            results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
            results.expirationMonth = paymentInstrument.creditCardExpirationMonth;
        } else if (paymentInstrument.paymentMethod === 'GIFT_CERTIFICATE') {
            results.giftCertificateCode = paymentInstrument.giftCertificateCode;
            results.maskedGiftCertificateCode = paymentInstrument.maskedGiftCertificateCode;
        } else if (paymentInstrument.paymentMethod.indexOf('PG_') > -1) {
            var paymentHelper = require('*/cartridge/scripts/paymentgateway/helper/PaymentHelper');
            var methodData = paymentHelper.getPaymentMethodData(paymentInstrument.paymentMethod);
            results.methodImg = methodData.image;
            results.name = methodData.name;
        }
        if (/PG_SEPA/.test(paymentInstrument.paymentMethod)) {
            results.SEPADebtorName = paymentInstrument.custom.paymentGatewaySEPADebtorName;
            results.SEPAIBAN = paymentInstrument.custom.paymentGatewayIBAN;
            results.SEPABIC = paymentInstrument.custom.paymentGatewayBIC;
        } else if (/^PG_POI$/.test(paymentInstrument.paymentMethod)) {
            results.merchantBank = {
                iban: paymentInstrument.custom.paymentGatewayIBAN,
                bic: paymentInstrument.custom.paymentGatewayBIC
            };
        }

        return results;
    });
}

/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @param {string} countryCode - the associated Site countryCode
 * @constructor
 */
function Payment(currentBasket, currentCustomer, countryCode) {
    base.call(this, currentBasket, currentCustomer, countryCode);

    var paymentInstruments = currentBasket.paymentInstruments;
    this.selectedPaymentInstruments = paymentInstruments
        ? getSelectedPaymentInstruments(paymentInstruments) : null;
}

Payment.prototype = Object.create(base.prototype);

module.exports = Payment;
