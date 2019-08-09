(function () {
    "use strict";

    System.angular.controller('DnsmasqController',
    ['$scope', '$element', '$http', '$timeout', function ($scope, $element, $http, $timeout) {
        var controller = $($element);
        var model = controller.data('model');
        $.extend($scope, model);

        var dnsmasq = $scope.dnsmasq = {};
        $.extend(true, dnsmasq, {
            startTime: new Date(),
            limits: [5, 10, 20, 50, 100, 200, 500, 1000],
            ignores: ['0.0.0.0'], // network nodes to be ignored
            categories: [
                { name: 'adware', data: {}, count: 0, url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts' },
                { name: 'fakenews', classes: 'text-danger', data: {}, count: 0, url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/fakenews/hosts' },
                { name: 'gambling', classes: 'text-danger', data: {}, count: 0, url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/gambling/hosts' },
                { name: 'porn', classes: 'text-danger', data: {}, count: 0, url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/porn/clefspeare13/hosts' },
                { name: 'social', classes: 'text-warning', data: {}, count: 0, url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/social/sinfonietta/hosts' }
            ],
            categoriesOptions: {
                hidden: false,
                orderBy: 'hostname',
                orderReverse: false,
                load: function () {
                    $.each(dnsmasq.categories, function (index, value) {
                        $.get(value.url, function (data) {
                            loadCategory(data, value.data);
                        });
                    });

                    function loadCategory(data, dict) {
                        data = data.split('\n');

                        $.each(data, function (index, value) {
                            if (typeof value === 'undefined') {
                                return;
                            }

                            value = value.split(' ');
                            var ip = value[0];

                            if (ip === '0.0.0.0' || ip === '127.0.0.1') {
                                dict[value[1]] = true;
                            }
                        });
                    }
                },
                add: function (obj) {
                    if (typeof obj.category !== 'undefined') {
                        return false;
                    }

                    var categories = dnsmasq.categories;
                    for (var i = 0; i < categories.length; ++i) {
                        var category = categories[i];
                        var data = category.data;

                        if (data[obj.domain] === true) {
                            obj.category = category.name;
                            ++category.count;
                            return true;
                        }
                    }

                    return false;
                },
                getClasses: function (categoryName) {
                    var category = dnsmasq.categories.find(function (x) { return x.name === categoryName; });

                    if (typeof category !== 'undefined') {
                        return category.classes;
                    }

                    return null;
                }
            },
            data: [],
            dataOptions: {
                hidden: true,
                orderBy: 'time',
                orderReverse: false,
                limit: 100,
                count: 0,
                chart: {
                    show: true,
                    durations: [
                        { name: '15 seconds', value: 15 * 1000 },
                        { name: '30 seconds', value: 30 * 1000 },
                        { name: '1 minute', value: 60 * 1000 },
                        { name: '5 minutes', value: 5 * 60 * 1000 },
                        { name: '15 minutes', value: 15 * 60 * 1000 },
                        { name: '30 minutes', value: 30 * 60 * 1000 },
                        { name: '45 minutes', value: 45 * 60 * 1000 },
                        { name: '1 hour', value: 60 * 60 * 1000 },
                        { name: '2 hours', value: 2 * 60 * 60 * 1000 }
                    ],
                    initialize: function () {
                        var $self = this;

                        setInterval(function () {
                            var data = $self.next();

                            $.each(data, function (index, value) {
                                $self.datasets[index].data.push(value);
                            });

                            if ($self.show === true) {
                                $self.element.update({ preservation: true });
                            }
                        }, 1000);
                    },
                    datasets: [
                        {
                            data: [],
                            label: 'Raw',
                            lineTension: 0,
                            borderColor: 'rgb(54, 162, 235)',
                            backgroundColor: 'rgba(54, 162, 235, 0.5)'
                        }, {
                            data: [],
                            label: 'Queries',
                            lineTension: 0,
                            borderColor: 'rgb(54, 62, 135)',
                            backgroundColor: 'rgba(54, 62, 135, 0.5)'
                        }
                    ],
                    next: function () {
                        var entry = [];

                        entry.push({ x: new Date().getTime(), y: this.current.raw });
                        entry.push({ x: new Date().getTime(), y: this.current.queries });

                        this.current = { raw: 0, queries: 0 };

                        return entry;
                    },
                    current: { raw: 0, queries: 0 }
                }
            },
            queries: [],
            queriesOptions: { hidden: true, orderBy: 'hostname', orderReverse: false },
            resolvers: [],
            resolversOptions: { hidden: false, orderBy: 'key', orderReverse: false, sum: { totalRequests: 0 } },
            domains: [],
            domainsOptions: { hidden: true, orderBy: 'lastRequestTime', orderReverse: true, limitTo: 10, page: 1 },
            isNonRoutableRequest: function (query) {
                return typeof query.ipaddress === 'undefined'
                    || query.ipaddress === '0.0.0.0'
                    || query.ipaddress.indexOf('NXDOMAIN') === 0
                    || query.ipaddress.indexOf('NODATA') === 0;
            },
            log: function (loggedEvent) {
                var dnsmasq = $scope.dnsmasq;

                if ($.inArray($.trim(loggedEvent.requestor), dnsmasq.ignores) >= 0) {
                    return;
                }

                if (loggedEvent.domain === null) {
                    return;
                }

                var requestor = dnsmasq.queries.find(function (x) { return x.key === loggedEvent.requestor; });
                if (typeof requestor === 'undefined') {
                    requestor = {
                        key: loggedEvent.requestor,
                        hidden: true,
                        records: [],
                        totalTopDomains: 0,
                        totalDomains: 0,
                        totalRequests: 0,
                        categories: []
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
                        totalRequests: 0,
                        categories: []
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
                if (dnsmasq.categoriesOptions.add(domain)) {
                    var category = topDomain.categories.find(function (x) { return x === domain.category; });
                    if (typeof category === 'undefined') {
                        topDomain.categories.push(domain.category);

                        // add category to the requester object if not already added
                        category = requestor.categories.find(function (x) { return x === domain.category; });
                        if (typeof category === 'undefined') {
                            requestor.categories.push(domain.category);
                        }
                    }
                }
                ++domain.totalRequests;
                ++topDomain.totalRequests;
                ++requestor.totalRequests;
                if (typeof topDomain.lastRequestTime === 'undefined' ||
                    topDomain.lastRequestTime < loggedEvent.time) {
                    topDomain.lastRequestTime = loggedEvent.time;
                }
                if (typeof requestor.lastRequestTime === 'undefined' ||
                    requestor.lastRequestTime < loggedEvent.time) {
                    requestor.lastRequestTime = loggedEvent.time;
                }

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
                ++dnsmasq.resolversOptions.sum.totalRequests;

                var categories = topDomain.categories;
                topDomain = dnsmasq.domains.find(function (x) { return x.key === topDomainKey; });
                if (typeof topDomain === 'undefined') {
                    topDomain = {
                        key: topDomainKey,
                        categories: categories,
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
                if (typeof requestor.lastRequestTime === 'undefined' ||
                    requestor.lastRequestTime < loggedEvent.time) {
                    requestor.lastRequestTime = loggedEvent.time;
                }
                if (typeof domain.lastRequestTime === 'undefined' ||
                    domain.lastRequestTime < loggedEvent.time) {
                    domain.lastRequestTime = loggedEvent.time;
                }
                if (typeof topDomain.lastRequestTime === 'undefined' ||
                    topDomain.lastRequestTime < loggedEvent.time) {
                    topDomain.lastRequestTime = loggedEvent.time;
                }
            },
            dataAdd: function (row) {
                var data = dnsmasq.data;
                var options = dnsmasq.dataOptions;
                var chartData = dnsmasq.dataOptions.chart;

                if (typeof options.limit !== 'undefined' && data.length >= options.limit) {
                    data.shift();
                }

                $scope.$apply(function () {
                    data.push(row);
                });

                ++options.count;

                if (typeof chartData === 'object') {
                    ++chartData.current.raw;

                    var message = row.message;

                    if (message.startsWith('query')) {
                        ++chartData.current.queries;
                    }
                }
            }
        }, model.dnsmasq);

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

        // load category lists
        dnsmasq.categoriesOptions.load();

        dnsmasq.dataOptions.chart.initialize();

        var query = null;

        $(document).on("dnsmasq", function (event, line, hidden) {
            if (dnsmasq.dataOptions.pause) {
                return;
            }

            var split = line.split(' ')
                // remove null, undefined and empty
                .filter(function (e) { return e === 0 || e; });
            var baseIndex = 4;

            if (split.length <= baseIndex) {
                // print the line as is
                dnsmasq.dataAdd({
                    time: new Date(),
                    message: line
                });

                return;
            }

            var timestamp = getDateTime(split);
            var loggerName = split[3].slice(0, -1); // remove the ':' at the end of the name

            // write to the raw data table
            //-------------------------------------
            if (!hidden) {
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

                dnsmasq.dataAdd({
                    time: timestamp,
                    logger: loggerName,
                    message: message,
                    messageSplits: messageSplits
                });
            }
            //-------------------------------------

            var queryKey = "query[";
            var cmd = split[baseIndex];

            if (cmd.startsWith(queryKey)) {
                if (query !== null) {
                    // not get a reply ?
                    dnsmasq.log(query);
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
                        dnsmasq.log(query);
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

        // load old data if any
        $timeout(function () {
            if (model.OldData === null || typeof model.OldData === 'undefined') {
                return;
            }

            var oldData = model.OldData;
            $scope.OldDataCount = oldData.length;
            $scope.OldDataLoadedCount = 0;

            var interval = setInterval(function () {
                if (oldData.length > 0) {
                    var loggedEvent = oldData.pop();
                    System.loggedEvent({ Message: loggedEvent, hidden: true });
                    $scope.OldDataLoadedCount++;
                } else {
                    clearInterval(interval);
                    model.OldData = null;
                }
            }, 5);
        });
    }]);

    System.angular.directive('realTimeDataChart', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                var options = scope.$eval(attr.realTimeDataChart);
                var chartData = scope.dnsmasq.dataOptions.chart;

                options = $.extend({
                    scales: {
                        xAxes: [{
                            type: 'realtime',
                            realtime: {
                                duration: 15000,
                                refresh: 1000,
                                delay: 1000,
                                pause: false,
                                ttl: undefined
                            }
                        }]
                    },
                    tooltips: {
                        mode: 'nearest',
                        intersect: false
                    },
                    hover: {
                        mode: 'nearest',
                        intersect: false
                    },
                    plugins: { streaming: { frameRate: 30 } }
                }, options);

                chartData.element = new Chart(element[0], {
                    type: 'line',
                    data: chartData,
                    options: options
                });
            }
        };
    });

    System.angular.directive('sortDirection', function () {
        return {
            restrict: 'A',
            scope: { options: '=', orderBy: '@', title: '@' },
            template: "{{title}}<a ng-hide=\"options.orderBy != orderBy\" class=\"pull-right\"><span class=\"glyphicon\" ng-class=\"options.orderReverse ? 'glyphicon-triangle-bottom' : 'glyphicon-triangle-top'\" aria-hidden=\"true\"></span></a>",
            link: function (scope, element, attr) {
                element.on('click', function (event) {
                    var options = scope.options;
                    var orderBy = scope.orderBy;

                    scope.$apply(function () {
                        if (options.orderBy !== orderBy) {
                            options.orderBy = orderBy;
                        } else {
                            options.orderReverse = !options.orderReverse;
                        }
                    });
                });
            }
        };
    });

    System.angular.directive('toggleHidden', function () {
        return {
            restrict: 'A',
            scope: { options: '=' },
            template: "<a ng-click=\"options.hidden = !options.hidden\"><span class=\"glyphicon\" ng-class=\"options.hidden ? 'glyphicon-triangle-right' : 'glyphicon-triangle-bottom'\" aria-hidden=\"true\"></span></a>"
        };
    });
}());