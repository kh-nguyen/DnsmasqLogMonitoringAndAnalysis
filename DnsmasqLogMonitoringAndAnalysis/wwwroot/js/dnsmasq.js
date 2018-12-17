(function () {
    "use strict";

    System.angular.controller('NetworkController',
    ['$scope', '$element', '$http', '$timeout', function ($scope, $element, $http, $timeout) {
        var controller = $($element);
        $.extend($scope, controller.data('model'));

        $scope.dnsmasq = {
            startTime: new Date(),
            data: [],
            dataOptions: { hidden: true, orderBy: 'time', orderReverse: false, limit: 100 },
            queries: [],
            queriesOptions: { hidden: false, orderBy: 'hostname', orderReverse: false },
            resolvers: [],
            resolversOptions: { hidden: true, orderBy: 'key', orderReverse: false },
            domains: [],
            domainsOptions: { hidden: true, orderBy: 'key', orderReverse: false },
            isNonRoutableRequest: function (query) {
                return typeof query.ipaddress === 'undefined'
                    || query.ipaddress === '0.0.0.0'
                    || query.ipaddress.indexOf('NXDOMAIN') === 0
                    || query.ipaddress.indexOf('NODATA') === 0;
            },
            log: function (loggedEvent) {
                $timeout(function () {
                    if (loggedEvent.domain === null) {
                        return;
                    }

                    var dnsmasq = $scope.dnsmasq;

                    var requestor = dnsmasq.queries.find(function (x) { return x.key === loggedEvent.requestor; });
                    if (typeof requestor === 'undefined') {
                        requestor = {
                            hidden: true,
                            key: loggedEvent.requestor,
                            records: [],
                            totalTopDomains: 0,
                            totalDomains: 0,
                            totalRequests: 0
                        };
                        dnsmasq.queries.push(requestor);

                        // note: timeout to not block the process
                        $timeout(function () {
                            $scope.networkResolve(loggedEvent.requestor, requestor);
                        });
                    }

                    var domainComponents = loggedEvent.domain.split('.');
                    var topDomainKey = domainComponents[domainComponents.length - 2]
                        + '.' + domainComponents[domainComponents.length - 1];
                    var topDomain = requestor.records.find(function (x) { return x.key === topDomainKey; });
                    if (typeof topDomain === 'undefined') {
                        topDomain = {
                            key: topDomainKey,
                            hidden: true,
                            records: [],
                            totalDomains: 0,
                            totalRequests: 0
                        };
                        $scope.$apply(function () {
                            requestor.records.push(topDomain);
                            ++requestor.totalTopDomains;
                        });
                    }

                    var domain = topDomain.records.find(function (x) { return x.domain === loggedEvent.domain; });
                    if (typeof domain === 'undefined') {
                        domain = { totalRequests: 0 };
                        $scope.$apply(function () {
                            topDomain.records.push(domain);
                            ++topDomain.totalDomains;
                            ++requestor.totalDomains;
                        });
                    }
                    $.extend(domain, loggedEvent);
                    ++domain.totalRequests;
                    ++topDomain.totalRequests;
                    ++requestor.totalRequests;
                    topDomain.lastRequestTime = loggedEvent.time;
                    requestor.lastRequestTime = loggedEvent.time;

                    var resolver = dnsmasq.resolvers.find(function (x) { return x.key === loggedEvent.resolver; });
                    if (typeof resolver === 'undefined') {
                        resolver = {
                            key: loggedEvent.resolver,
                            totalRequests: 0
                        };
                        dnsmasq.resolvers.push(resolver);

                        // note: timeout to not block the process
                        $timeout(function () {
                            $scope.networkResolve(loggedEvent.resolver, resolver);
                        });
                    }
                    ++resolver.totalRequests;

                    topDomain = dnsmasq.domains.find(function (x) { return x.key === topDomainKey; });
                    if (typeof topDomain === 'undefined') {
                        topDomain = {
                            key: topDomainKey,
                            totalRequests: 0,
                            records: [],
                            hidden: true
                        };
                        $scope.$apply(function () {
                            dnsmasq.domains.push(topDomain);
                        });
                    }
                    domain = topDomain.records.find(function (x) { return x.key === loggedEvent.domain; });
                    if (typeof domain === 'undefined') {
                        domain = { key: loggedEvent.domain, totalRequests: 0 };
                        $scope.$apply(function () {
                            topDomain.records.push(domain);
                        });
                    }
                    ++domain.totalRequests;
                    ++topDomain.totalRequests;
                    domain.lastRequestTime = loggedEvent.time;
                    topDomain.lastRequestTime = loggedEvent.time;
                });
            },
            dataAdd: function (row) {
                var data = $scope.dnsmasq.data;
                var options = $scope.dnsmasq.dataOptions;

                if (data.length >= options.limit) {
                    data.shift();
                };

                data.push(row);
            }
        };

        $scope.applySort = function (options, name) {
            if (options.orderBy !== name) {
                options.orderBy = name;
            } else {
                options.orderReverse = !options.orderReverse;
            }
        };

        $scope.networkResolve = function (ipAddress, storageObject) {
            $.post($scope.HostnameResolveUrl + '/' + ipAddress, function (data) {
                if (data !== null && data.endsWith($scope.DomainName)) {
                    data = data.substring(0, data.length - $scope.DomainName.length - 1);
                }

                $scope.$apply(function () {
                    storageObject.hostname = data;
                });
            });
        };

        var query = null;

        connection.on("loggedEvent", function (line) {
            if ($scope.dnsmasq.dataOptions.pause) {
                return;
            }

            var split = line.split(' ');
            var baseIndex = 4;

            if (split.length <= baseIndex) {
                // print the line as is
                $timeout(function () {
                    $scope.dnsmasq.dataAdd({
                        time: new Date(),
                        message: line
                    });
                });

                return;
            }

            var timestamp = getDateTime(split);
            var loggerName = split[3].slice(0, -1); // remove the ':' at the end of the name

            $timeout(function () {
                var message = line.substring(line.indexOf(loggerName) + loggerName.length + 2);

                $scope.dnsmasq.dataAdd({
                    time: timestamp,
                    logger: loggerName,
                    message: message,
                    messageSplits: message.split(' ')
                });
            });

            var queryKey = "query[";
            var cmd = split[baseIndex];

            if (cmd.startsWith(queryKey)) {
                if (query !== null) {
                    // not get a reply ?
                    $scope.dnsmasq.log(query);
                }

                query = {};
                query.type = cmd.substring(queryKey.length, cmd.length - queryKey.length - 1);
                query.time = timestamp;
                query.domain = split[baseIndex + 1];
                query.requestor = split[baseIndex + 3];
            } else if (query != null) {
                if (cmd == "forwarded") {
                    query.resolver = split[baseIndex + 3];
                }
                else if (split[baseIndex + 2] == "is") {
                    if (cmd != "reply") {
                        query.resolver = split[baseIndex];
                    }

                    query.ipaddress = split[baseIndex + 3];

                    if (query.ipaddress == "<CNAME>") {
                        // ???
                    }
                    else {
                        $scope.dnsmasq.log(query);
                        query = null;
                    }
                }
            }

            function getDateTime(split) {
                var month = split[0];
                var day = split[1];
                var year = new Date().getFullYear();
                var time = split[2];

                if (month.startsWith("<"))
                    month = month.substring(month.indexOf(">") + 1);

                var date = [];
                date.push(year);
                date.push(month);
                date.push(day);
                date.push(time);

                var timestamp = moment(date.join(' '), 'YYYY MMM D HH:mm:ss');

                return timestamp;
            }
        });
    }]);
}());