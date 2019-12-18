var System = {};

(function () {
    "use strict";

    System.angular = angular.module('app', ['ng', 'ngAnimate', 'angularMoment']);

    System.formatBytes = function (bytes, decimals) {
        if (bytes === 0) {
            return '0 Byte';
        }

        var k = 1024; // 1024 for binary
        var dm = decimals + 1 || 3;
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    System.angular.filter('keylength', [function () {
        return function (input) {
            if (!angular.isObject(input)) {
                return '0';
            }
            return Object.keys(input).length;
        };
    }]);
    System.angular.filter('html', ['$sce', function ($sce) {
        return function (text) {
            return $sce.trustAsHtml(text);
        };
    }]);
    System.angular.filter('formatBytes', [function () {
        return function (fileSize) {
            return System.formatBytes(fileSize, 1);
        };
    }]);

    System.loggedEvent = function (loggedEvent) {
        if (typeof loggedEvent === 'undefined') {
            return;
        }

        // convert it to an object if it is a string
        if (typeof loggedEvent === 'string') {
            loggedEvent = { time: new Date(), message: loggedEvent };
        }

        var message = loggedEvent.message;

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

    async function start() {
        try {
            await connection.start();
            console.log("connected");
        } catch (err) {
            console.log(err);
            setTimeout(() => start(), 2000);
        }
    }

    connection.onclose(async () => {
        await start();
    });

    connection.on("loggedEvent", System.loggedEvent);

    start();

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