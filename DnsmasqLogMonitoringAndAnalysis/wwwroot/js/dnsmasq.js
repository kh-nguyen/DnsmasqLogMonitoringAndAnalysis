(function () {
    "use strict";

    System.angular.controller('DnsmasqController',
    ['$scope', '$element', '$http', '$timeout', function ($scope, $element, $http, $timeout) {
        var controller = $($element);
        var model = controller.data('model');
        $.extend($scope, model);

        var dnsmasq = $scope.dnsmasq = {};
        $.extend(true, dnsmasq, {
            title: 'Dnsmasq Log Real-Time Monitoring And Analysis',
            startTime: new Date(),
            limits: [5, 10, 20, 50, 100, 200, 500, 1000],
            ignored: {
                add: function () {
                    var input = this.input;

                    if (input === null) {
                        return;
                    }

                    input = $.trim(input);

                    if (!this.data.find(function (x) { return x === input; })) {
                        this.data.push(input);
                    }

                    this.input = null;
                },
                remove: function (value) {
                    this.data.splice(this.data.indexOf(value), 1);
                },
                data: ['0.0.0.0'] // network nodes to be ignored
            },
            hostnames: {}, // resolved hostnames cache
            categories: [
                { name: 'Adware', url: ['https://raw.githubusercontent.com/notracking/hosts-blocklists/master/hostnames.txt', 'https://raw.githubusercontent.com/notracking/hosts-blocklists/master/domains.txt'] },
                { name: 'Fakenews', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/fakenews/hosts', classes: 'text-danger' },
                { name: 'Gambling', url: ['https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/gambling/hosts', 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/gambling.txt'], classes: 'text-danger' },
                { name: 'Porn', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/porn/clefspeare13/hosts', classes: 'text-danger' },
                { name: 'Social', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/social/sinfonietta/hosts', classes: 'text-warning' },
                { name: 'Adult', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/adult.txt', classes: 'text-danger' },
                { name: 'Advertising', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/advertising.txt' },
                { name: 'Cartoons', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/cartoons.txt' },
                { name: 'Chat', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/chat.txt' },
                { name: 'Dangerous', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/dangerous.txt' },
                { name: 'Dating', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/dating.txt' },
                { name: 'Drugs', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/drugs.txt' },
                { name: 'Games', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/games.txt' },
                { name: 'Hacking', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/hacking.txt' },
                { name: 'Malware', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/malware.txt' },
                { name: 'Multimedia', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/multimedia.txt' },
                { name: 'Phishing', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/phishing.txt' },
                { name: 'Redirector', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/redirector.txt' },
                { name: 'Remote-control', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/remote-control.txt' },
                { name: 'Shopping', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/shopping.txt' },
                { name: 'Social-networks', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/social-networks.txt' },
                { name: 'Sports', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/sports.txt' },
                { name: 'Violence', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/violence.txt' },
                { name: 'Warez', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/warez.txt' }
            ],
            categoriesOptions: {
                data: {},
                expand: { hidden: true, sort: { orderBy: 'name', orderReverse: false } },
                resetCounter: function () {
                    $.each(dnsmasq.categories, function (index, value) {
                        value.matches = 0;
                    });
                },
                load: function () {
                    var options = this;

                    loadDefaultProperties();
                    options.loadCategories();

                    // schedule to reload every day
                    setInterval(options.loadCategories, 1 * 24 * 60 * 60 * 1000);

                    function loadDefaultProperties() {
                        $.each(dnsmasq.categories, function (index, value) {
                            $.extend(value, {
                                expand: {
                                    hidden: true,
                                    sort: {
                                        orderBy: 'lastRequestTime',
                                        orderReverse: true
                                    },
                                    limit: 20
                                },
                                size: 0,
                                records: [],
                                matches: 0
                            });
                        });
                    }
                },
                loadCategories: function () {
                    var options = dnsmasq.categoriesOptions;

                    options.updating = true;

                    // clear or initialize the data holder variable
                    options.data = {};

                    $.each(dnsmasq.categories, function (index, value) {
                        value.size = 0;
                        var url = value.url;

                        if (typeof url === 'string') {
                            loadData(url);
                        } else { // array of urls
                            $.each(url, function (index, value) {
                                loadData(value);
                            });
                        }

                        function loadData(url) {
                            $.get(url, function (data) {
                                loadCategory(data, options.data, value);
                            });
                        }
                    });

                    function loadCategory(data, dict, cat) {
                        data = data.split('\n');

                        $.each(data, function (index, value) {
                            if (typeof value === 'undefined') {
                                return;
                            }

                            value = value.split(' ').map(function (e) { return $.trim(e); });

                            var key = value[0];

                            if (value.length > 1) {
                                if (key === '0.0.0.0' || key === '127.0.0.1') {
                                    key = value[1];
                                }
                            }

                            if (!(key in dict)) {
                                ++cat.size;
                            }

                            dict[key] = cat;
                        });
                    }
                },
                add: function (obj) {
                    if (typeof obj.category !== 'undefined') {
                        return false;
                    }

                    var domainComponents = obj.domain.split('.');

                    while (domainComponents.length > 1) {
                        var domain = domainComponents.join('.');
                        var category = dnsmasq.categoriesOptions.data[domain];

                        if (typeof category === 'object') {
                            obj.category = category;
                            ++category.matches;
                            return category;
                        }

                        domainComponents.shift();
                    }

                    return false;
                },
                getClasses: function (categoryObj) {
                    var categoryName = '';

                    if (typeof categoryObj === 'string') {
                        categoryName = categoryObj;
                    } else if (typeof categoryObj === 'object') {
                        categoryName = categoryObj.name;
                    }

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
                count: 0,
                chart: {
                    show: false,
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
            queriesOptions: { expand: { hidden: true, sort: { orderBy: 'hostname', orderReverse: false }, limit: 50 } },
            resolvers: [],
            resolversOptions: { expand: { hidden: true, sort: { orderBy: 'key', orderReverse: false } }, sum: { totalRequests: 0 } },
            filteredDomainsOptions: { bare_or_www_only: false },
            domains: [],
            domainsOptions: { expand: { hidden: false, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 10 } },
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
                var toBeFilledWithDescription = [];
                var isNewDomain = false;

                if ($.inArray($.trim(loggedEvent.requestor), dnsmasq.ignored.data) >= 0) {
                    return;
                }

                if (loggedEvent.domain === null) {
                    return;
                }

                // apply filters
                if (dnsmasq.filteredDomainsOptions.bare_or_www_only && !isBareOrWwwDomain(loggedEvent.domain)) {
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
                        expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 },
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
                toBeFilledWithDescription.push(topDomain);

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
                        expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }
                    };
                    dnsmasq.domains.push(topDomain);
                }
                domain = topDomain.records.find(function (x) { return x.key === loggedEvent.domain; });
                if (typeof domain === 'undefined') {
                    isNewDomain = true;
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
                        records: [loggedEvent],
                        expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }
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
                    catTopDomain.lastRequestor = requestor;
                    catTopDomain.lastRequestTime = loggedEvent.time;

                    var catDomain = catTopDomain.records.find(function (x) { return x.key === loggedEvent.domain; });
                    if (typeof catDomain === 'undefined') {
                        catTopDomain.records.push(domain);
                    }
                }
                ++requestor.totalRequests;
                ++domain.totalRequests;
                ++topDomain.totalRequests;
                {
                    var lastRequestTime = requestor.lastRequestTime;
                    var currentRequestTime = loggedEvent.time;

                    // remove seconds and milliseconds info to keep only minutes
                    lastRequestTime.seconds(0);
                    lastRequestTime.milliseconds(0);
                    currentRequestTime.seconds(0);
                    currentRequestTime.milliseconds(0);

                    var IsNewRecord = lastRequestTime < currentRequestTime;

                    if (IsNewRecord === true) {
                        if (requestor.records.length >= REQUESTOR_MAX_RECORDS) {
                            requestor.records.shift();
                        }
                        requestor.records.push(loggedEvent);
                    }
                }
                requestor.lastRequestTime = loggedEvent.time;
                domain.lastRequestTime = loggedEvent.time;
                toBeFilledWithDescription.push(domain);
                topDomain.lastRequestTime = loggedEvent.time;
                topDomain.lastRequestor = requestor;
                toBeFilledWithDescription.push(topDomain);

                if (isNewDomain || typeof domain.description === 'undefined') {
                    // skip requesting description while importing saved data
                    // so that we do not flood the server with too many requests
                    if (!(loggedEvent.imported === true)) {
                        domain.description = "";

                        getDescription();
                    }
                }

                function getDescription() {
                    $.get($scope.GetDescriptionUrl, { domain: loggedEvent.domain })
                    .done(function (data) {
                        if (typeof data !== 'undefined' && data.length > 1) {
                            data = jQuery('<div />').html(data).text();

                            if (typeof data !== 'undefined') {
                                $.each(toBeFilledWithDescription, function (index, obj) {
                                    obj.description = data;
                                });
                            }
                        }
                    });
                }

                function isBareOrWwwDomain(domain) {
                    var domainComponents = domain.split('.');

                    if (domainComponents.length <= 1) {
                        return false;
                    }

                    // we want to not count adware domains for this filter
                    var category = dnsmasq.categoriesOptions.data[domain];
                    if (typeof category !== 'undefined' && category.name === 'Adware') {
                        return false;
                    }

                    if (domainComponents.length >= 3) {
                        return domain.startsWith('www.');
                    }

                    return true;
                }

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
            },
            clearData: function () {
                var $this = this;

                $this.data = [];
                $this.queries = [];
                $this.domains = [];
                $this.resolvers = [];

                this.categoriesOptions.resetCounter();
                this.resolversOptions.sum.totalRequests = 0;
                this.dataOptions.count = 0;
            },
            loadData: function () {
                var $this = this;

                $scope.loading_data = true;

                $.get($scope.OldDataUrl).done(function (data) {
                    $this.clearData();

                    if (typeof data !== 'undefined' && data.length > 1) {
                        model.OldData = data;
                        processSavedData();
                    }
                }).always(function () {
                    $scope.loading_data = false;
                });
            },
            saveData: function () {
                var blob = new Blob([JSON.stringify(dnsmasq)], { type: 'application/json' });
                saveAs(blob, "dnsmasq.txt");
            }
        }, model.dnsmasq);

        $scope.networkResolve = function (ipAddress, storageObject) {
            ipAddress = $.trim(ipAddress);

            if (!isIP(ipAddress)) {
                return ipAddress;
            }

            var hostname = dnsmasq.hostnames[ipAddress];

            if (typeof hostname === 'object') {
                hostname.push(storageObject);
                return;
            }

            if (typeof hostname === 'undefined' || isIP(hostname)) {
                var queue = [];
                dnsmasq.hostnames[ipAddress] = queue;
                queue.push(storageObject);

                $.post($scope.HostnameResolveUrl + '/' + ipAddress, function (data) {
                    if (data !== null && data.endsWith($scope.DomainName)) {
                        data = data.substring(0, data.length - $scope.DomainName.length - 1);
                    }

                    dnsmasq.hostnames[ipAddress] = data;

                    $scope.$apply(function () {
                        $.each(queue, function (index, obj) {
                            obj.hostname = data;
                        });
                    });
                });
            }

            storageObject.hostname = hostname;

            function isIP(ipaddress) {
                return /^(?=\d+\.\d+\.\d+\.\d+$)(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.?){4}$/.test(ipaddress);
            }
        };

        // load category lists
        dnsmasq.categoriesOptions.load();

        dnsmasq.dataOptions.chart.initialize();

        var query = null;

        $(document).on("dnsmasq", function (event, line, imported) {
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
            if (!imported) {
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
                query.imported = imported;
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

        // query for the updated host name of the clients every 15 minutes
        setInterval(function () {
            $.each(dnsmasq.queries, function (index, client) {
                $scope.networkResolve(client.key, client);
            });
        }, 15 * 60 * 1000);

        // load old data if any
        $timeout(processSavedData);

        function processSavedData() {
            if (model.OldData === null || typeof model.OldData !== 'object') {
                return;
            }

            // process multiple lines for each time
            // interval to improve data throughput
            var NUMBER_OF_LINES_PER_INTERVAL = 10;

            // need to reverse the array to process correctly
            // the data with time in increasing position
            var data = model.OldData.reverse();

            $scope.OldDataCount = data.length;
            $scope.OldDataLoadedCount = 0;

            var interval = setInterval(function () {
                var i = 0;

                for (i = 0; i < NUMBER_OF_LINES_PER_INTERVAL; i++) {
                    process();
                }
            });

            function process () {
                if (data.length > 0) {
                    var loggedEvent = data.pop();
                    System.loggedEvent({ Message: loggedEvent, hidden: true });
                    $scope.OldDataLoadedCount++;
                } else {
                    clearInterval(interval);
                    model.OldData = null;
                }
            }
        }
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

    System.angular.directive('tableOptionsTemplate', function () {
        return {
            restrict: 'A',
            replace: true,
            scope: { records: '=', options: '=', dnsmasq: '=' },
            template: function () { return $('#dnsmasq-table-options-template').html(); },
            link: function (scope, element, attr) { scope.Math = window.Math; }
        };
    });
}());