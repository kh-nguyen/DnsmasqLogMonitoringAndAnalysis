var System = {};

(function () {
    "use strict";

    System.angular = angular.module('app', ['ng', 'ngAnimate', 'angularMoment']);

    System.angular.filter('keylength', [function () {
        return function (input) {
            if (!angular.isObject(input)) {
                return '0';
            }
            return Object.keys(input).length;
        };
    }]);

    System.loggedEvent = function (loggedEvent) {
        if (typeof loggedEvent === 'undefined') {
            return;
        }

        // convert it to an object if it is a string
        if (typeof loggedEvent === 'string') {
            loggedEvent = { Message: loggedEvent };
        }

        var message = loggedEvent.Message;

        if (typeof message === 'string') {
            // check if it is a dnsmasq log and trigger the event if it is
            if (message.substring(0, 50).indexOf('dnsmasq') > 0) {
                $(document).trigger("dnsmasq", [message, loggedEvent.hidden]);

                return;
            }
        }

        $(document).trigger("syslog", [loggedEvent]);
    };

    var connection = new signalR.HubConnectionBuilder().withUrl("/dnsmasq").build();

    connection.start().catch(function (err) {
        return console.error(err.toString());
    });

    connection.on("loggedEvent", System.loggedEvent);

    // add support for method startsWith which is not available in IE browsers
    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function (searchString, position) {
            position = position || 0;
            return this.indexOf(searchString, position) === position;
        };
    }

    // add support for method endsWith
    if (!String.prototype.endsWith) {
        String.prototype.endsWith = function (pattern) {
            var d = this.length - pattern.length;
            return d >= 0 && this.lastIndexOf(pattern) === d;
        };
    }
}());