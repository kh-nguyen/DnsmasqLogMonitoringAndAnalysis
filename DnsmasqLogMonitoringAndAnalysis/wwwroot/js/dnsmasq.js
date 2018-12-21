(function () {
    "use strict";

    System.angular.controller('DnsmasqController',
    ['$scope', '$element', '$http', '$timeout', function ($scope, $element, $http, $timeout) {
        var controller = $($element);
        $.extend($scope, controller.data('model'));

        $scope.dnsmasq = {
            startTime: new Date(),
            data: [],
            dataOptions: { hidden: false, orderBy: 'time', orderReverse: false, limit: 1000 },
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
                            key: loggedEvent.requestor,
                            records: [],
                            totalTopDomains: 0,
                            totalDomains: 0,
                            totalRequests: 0,
                            hidden: true
                        };
                        dnsmasq.queries.push(requestor);

                        $scope.networkResolve(loggedEvent.requestor, requestor);
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
                        requestor.records.push(topDomain);
                        ++requestor.totalTopDomains;
                    }

                    var domain = topDomain.records.find(function (x) { return x.domain === loggedEvent.domain; });
                    if (typeof domain === 'undefined') {
                        domain = { totalRequests: 0 };
                        topDomain.records.push(domain);
                        ++topDomain.totalDomains;
                        ++requestor.totalDomains;
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

                        $scope.networkResolve(loggedEvent.resolver, resolver);
                    }
                    ++resolver.totalRequests;

                    topDomain = dnsmasq.domains.find(function (x) { return x.key === topDomainKey; });
                    if (typeof topDomain === 'undefined') {
                        topDomain = {
                            key: topDomainKey,
                            totalRequests: 0,
                            requestors: [],
                            records: [],
                            hidden: true
                        };
                        dnsmasq.domains.push(topDomain);
                    }
                    domain = topDomain.records.find(function (x) { return x.key === loggedEvent.domain; });
                    if (typeof domain === 'undefined') {
                        domain = {
                            key: loggedEvent.domain,
                            totalRequestors: 0,
                            totalRequests: 0,
                            records: [],
                            hidden: true
                        };
                        topDomain.records.push(domain);
                    }
                    requestor = domain.records.find(function (x) { return x.key === loggedEvent.requestor; });
                    if (typeof requestor === 'undefined') {
                        requestor = {
                            key: loggedEvent.requestor,
                            totalRequests: 0,
                            hidden: true
                        };
                        domain.records.push(requestor);
                        ++domain.totalRequestors;

                        var topDomainRequestors = topDomain.requestors.find(function (x) { return x === loggedEvent.requestor; });
                        if (typeof topDomainRequestors === 'undefined') {
                            topDomain.requestors.push(loggedEvent.requestor);
                        }
                    }
                    ++requestor.totalRequests;
                    ++domain.totalRequests;
                    ++topDomain.totalRequests;
                    requestor.lastRequestTime = loggedEvent.time;
                    domain.lastRequestTime = loggedEvent.time;
                    topDomain.lastRequestTime = loggedEvent.time;
                });
            },
            dataAdd: function (row) {
                var data = $scope.dnsmasq.data;
                var options = $scope.dnsmasq.dataOptions;

                if (typeof options.limit !== 'undefined' && data.length >= options.limit) {
                    data.shift();
                }

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
            ipAddress = $.trim(ipAddress);

            if (!isIP(ipAddress)) {
                return ipAddress;
            }

            $.post($scope.HostnameResolveUrl + '/' + ipAddress, function (data) {
                if (data !== null && data.endsWith($scope.DomainName)) {
                    data = data.substring(0, data.length - $scope.DomainName.length - 1);
                }

                $scope.$apply(function () {
                    storageObject.hostname = data;
                });
            });

            function isIP(ipaddress) {
                return /^(?=\d+\.\d+\.\d+\.\d+$)(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.?){4}$/.test(ipaddress);
            }  
        };

        var query = null;

        $(document).on("dnsmasq", function (event, line) {
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

            // write to the raw data table
            $timeout(function () {
                var message = line.substring(line.indexOf(loggerName) + loggerName.length + 2);
                var messageSplits = message.split(' ');

                if (messageSplits.length > 4) {
                    var keyword = messageSplits[0];
                    var verb = messageSplits[2];

                    if (keyword === 'reply' && verb === 'is') {
                        messageSplits[3] = message.substring(
                            keyword.length + 1 +
                            messageSplits[1].length + 1 +
                            verb.length + 1);

                        while (messageSplits.length > 4) {
                            messageSplits.pop();
                        }
                    }
                }

                $scope.dnsmasq.dataAdd({
                    time: timestamp,
                    logger: loggerName,
                    message: message,
                    messageSplits: messageSplits
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
            } else if (query !== null) {
                if (cmd === "forwarded") {
                    query.resolver = split[baseIndex + 3];
                }
                else if (split[baseIndex + 2] === "is") {
                    if (cmd !== "reply") {
                        query.resolver = split[baseIndex];
                    }

                    query.ipaddress = split[baseIndex + 3];

                    if (query.ipaddress === "<CNAME>") {
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