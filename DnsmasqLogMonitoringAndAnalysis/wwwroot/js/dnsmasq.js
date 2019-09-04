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
            hostnames: {}, // resolved hostnames cache
            categories: [
                { name: 'adware', expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }, data: {}, records: [], url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts' },
                { name: 'fakenews', classes: 'text-danger', expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }, data: {}, records: [], url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/fakenews/hosts' },
                { name: 'gambling', classes: 'text-danger', expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }, data: {}, records: [], url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/gambling/hosts' },
                { name: 'porn', classes: 'text-danger', expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }, data: {}, records: [], url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/porn/clefspeare13/hosts' },
                { name: 'social', classes: 'text-warning', expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }, data: {}, records: [], url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/social/sinfonietta/hosts' }
            ],
            categoriesOptions: {
                expand: { hidden: false, sort: { orderBy: 'name', orderReverse: false } },
                load: function () {
                    loadCategories();

                    setInterval(loadCategories, 1 * 24 * 60 * 60 * 1000 /* reload every day */);

                    function loadCategories() {
                        $.each(dnsmasq.categories, function (index, value) {
                            $.get(value.url, function (data) {
                                loadCategory(data, value.data);
                            });
                        });
                    }

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
                            return category;
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
                expand: { hidden: true, sort: { orderBy: 'time', orderReverse: true }, limit: 100 },
                applyLimit: function () {
                    while (dnsmasq.data.length > dnsmasq.dataOptions.expand.limit) {
                        dnsmasq.data.shift();
                    }
                },
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
            queriesOptions: { expand: { hidden: true, sort: { orderBy: 'hostname', orderReverse: false } } },
            resolvers: [],
            resolversOptions: { expand: { hidden: false, sort: { orderBy: 'key', orderReverse: false } }, sum: { totalRequests: 0 } },
            domains: [],
            domainsOptions: { expand: { hidden: false, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 5 } },
            isNonRoutableRequest: function (query) {
                return typeof query.ipaddress === 'undefined'
                    || query.ipaddress === '0.0.0.0'
                    || query.ipaddress.indexOf('NXDOMAIN') === 0
                    || query.ipaddress.indexOf('NODATA') === 0;
            },
            setHidden: function (nodes, value) {
                $.each(nodes, function (index, node) {
                    node.hidden = value;
                });
            },
            log: function (loggedEvent) {
                var dnsmasq = $scope.dnsmasq;
                var REQUESTOR_MAX_RECORDS = 100;

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
                        expand: { hidden: true, sort: { orderBy: 'key', orderReverse: true }, limit: 20 },
                        records: [],
                        totalTopDomains: 0,
                        totalDomains: 0,
                        totalRequests: 0,
                        categories: []
                    };
                    dnsmasq.queries.push(requestor);

                    $scope.networkResolve(loggedEvent.requestor, requestor);
                }

                var topDomainKey = getTopDomain(loggedEvent.domain);
                var topDomain = requestor.records.find(function (x) { return x.key === topDomainKey; });
                if (typeof topDomain === 'undefined') {
                    topDomain = {
                        key: topDomainKey,
                        expand: { hidden: true, sort: { orderBy: 'key', orderReverse: true }, limit: 20 },
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
                var categoryObj = dnsmasq.categoriesOptions.add(domain);
                if (typeof categoryObj === 'object') {
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
                ++dnsmasq.resolversOptions.sum.totalRequests;

                var categories = topDomain.categories;
                topDomain = dnsmasq.domains.find(function (x) { return x.key === topDomainKey; });
                if (typeof topDomain === 'undefined') {
                    topDomain = {
                        key: topDomainKey,
                        categories: categories,
                        totalRequests: 0,
                        lastRequestTime: loggedEvent.time,
                        requestors: [],
                        records: [],
                        expand: { hidden: true, sort: { orderBy: 'key', orderReverse: true }, limit: 20 }
                    };
                    dnsmasq.domains.push(topDomain);
                }
                domain = topDomain.records.find(function (x) { return x.key === loggedEvent.domain; });
                if (typeof domain === 'undefined') {
                    domain = {
                        key: loggedEvent.domain,
                        totalRequestors: 0,
                        totalRequests: 0,
                        lastRequestTime: loggedEvent.time,
                        records: [],
                        expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }
                    };
                    topDomain.records.push(domain);
                }
                requestor = domain.records.find(function (x) { return x.key === loggedEvent.requestor; });
                if (typeof requestor === 'undefined') {
                    requestor = {
                        key: loggedEvent.requestor,
                        totalRequests: 0,
                        lastRequestTime: loggedEvent.time,
                        records: [],
                        expand: { hidden: true, sort: { orderBy: 'time', orderReverse: true }, limit: 20 }
                    };
                    domain.records.push(requestor);
                    ++domain.totalRequestors;

                    $scope.networkResolve(loggedEvent.requestor, requestor);

                    var topDomainRequestors = topDomain.requestors.find(function (x) { return x === loggedEvent.requestor; });
                    if (typeof topDomainRequestors === 'undefined') {
                        topDomain.requestors.push(loggedEvent.requestor);
                    }
                }
                if (typeof categoryObj === 'object') {
                    var catTopDomainName = getTopDomain(loggedEvent.domain);

                    var catTopDomain = categoryObj.records.find(function (x) { return x.key === catTopDomainName; });
                    if (typeof catTopDomain === 'undefined') {
                        catTopDomain = {
                            records: [],
                            key: catTopDomainName,
                            expand: { hidden: true, sort: { orderBy: 'time', orderReverse: true }, limit: 20 }
                        };
                        categoryObj.records.push(catTopDomain);
                    }
                    catTopDomain.lastRequestTime = loggedEvent.time;

                    var catDomain = catTopDomain.records.find(function (x) { return x.key === loggedEvent.domain; });
                    if (typeof catDomain === 'undefined') {
                        catTopDomain.records.push(domain);
                    }
                }
                ++requestor.totalRequests;
                ++domain.totalRequests;
                ++topDomain.totalRequests;
                if (requestor.lastRequestTime < loggedEvent.time) {
                    var lastRequestTime = requestor.lastRequestTime;
                    var currentRequestTime = loggedEvent.time;
                    requestor.lastRequestTime = loggedEvent.time;

                    var IsNewRecord = true;

                    if (lastRequestTime instanceof Date) {
                        lastRequestTime.setSeconds(0);
                        lastRequestTime.setMilliseconds(0);
                        currentRequestTime.setSeconds(0);
                        currentRequestTime.setMilliseconds(0);

                        IsNewRecord = lastRequestTime < currentRequestTime;
                    }

                    if (IsNewRecord === true) {
                        if (requestor.records.length >= REQUESTOR_MAX_RECORDS) {
                            requestor.records.shift();
                        }
                        requestor.records.push(loggedEvent);
                    }
                }
                domain.lastRequestTime = loggedEvent.time;
                topDomain.lastRequestTime = loggedEvent.time;

                function getTopDomain(domain) {
                    var domainComponents = domain.split('.');

                    if (domainComponents.length <= 1) {
                        return domain;
                    }

                    return domainComponents[domainComponents.length - 2]
                        + '.' + domainComponents[domainComponents.length - 1];
                }
            },
            dataAdd: function (row) {
                var data = dnsmasq.data;
                var options = dnsmasq.dataOptions;
                var chartData = dnsmasq.dataOptions.chart;

                if (typeof options.expand.limit !== 'undefined' && data.length >= options.expand.limit) {
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

            storageObject.hostname = dnsmasq.hostnames[ipAddress];

            if (typeof storageObject.hostname === 'undefined' || isIP(storageObject.hostname)) {
                $.post($scope.HostnameResolveUrl + '/' + ipAddress, function (data) {
                    if (data !== null && data.endsWith($scope.DomainName)) {
                        data = data.substring(0, data.length - $scope.DomainName.length - 1);
                    }

                    dnsmasq.hostnames[ipAddress] = data;

                    $scope.$apply(function () {
                        storageObject.hostname = data;
                    });
                });
            }

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
                query.type = "query";
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

        // query for the updated host name of the clients every 15 minutes
        setInterval(function () {
            $.each(dnsmasq.queries, function (index, client) {
                $scope.networkResolve(client.key, client);
            });
        }, 15 * 60 * 1000);
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

    System.angular.directive('domainsTemplate', function () {
        return {
            restrict: 'A',
            replace: true,
            scope: { domains: '=', dnsmasq: '=' },
            template: function () { return $('#dnsmasq-domains-template').html(); }
        };
    });
}());