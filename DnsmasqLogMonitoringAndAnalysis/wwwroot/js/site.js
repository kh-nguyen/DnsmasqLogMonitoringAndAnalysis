"use strict";

var System = {};

System.angular = angular.module('app', ['ng', 'ngAnimate', 'angularMoment']);

System.angular.filter('keylength', [function () {
    return function (input) {
        if (!angular.isObject(input)) {
            return '0';
        }
        return Object.keys(input).length;
    };
}]);

var connection = new signalR.HubConnectionBuilder().withUrl("/dnsmasq").build();

connection.start().catch(function (err) {
    return console.error(err.toString());
});

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