(function () {
    "use strict";

    System.angular.controller('DnsmasqController',
    ['$scope', '$element', '$http', '$timeout', function ($scope, $element, $http, $timeout) {
        var controller = $($element);
        var model = controller.data('model');
        $.extend($scope, model);

        var absIgnore = {
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
            }
        };

        var dnsmasq = $scope.dnsmasq = {};
        $.extend(true, dnsmasq, {
            title: 'Dnsmasq Log Real-Time Monitoring And Analysis',
            startTime: new Date(),
            limits: [5, 10, 20, 50, 100, 200, 500, 1000],
            ignored: $.extend({
                data: ['0.0.0.0'] // network nodes to be ignored
            }, absIgnore),
            hostnames: {}, // resolved hostnames cache
            vendors: {
                requests: []
            }, // resolved vendors cache
            descriptions: {
                requests: [],
                processingCount: 0,
                expand: { hidden: true, limit: 10 },
                add: function () {
                    var input = this.input;

                    if (input === null) {
                        return;
                    }

                    input = $.trim(input);

                    if (!this.requests.find(function (x) { return x === input; })) {
                        this.requests.push(input);
                    }

                    this.input = null;
                },
                clear: function () {
                    var requests = this.requests;

                    while (requests.length > 0) {
                        var request = requests.pop();
                        delete dnsmasq.descriptions[request];
                    }
                }
            }, // website description cache
            categories: [
                { name: 'Adware', url: ['https://raw.githubusercontent.com/notracking/hosts-blocklists/master/hostnames.txt', 'https://raw.githubusercontent.com/notracking/hosts-blocklists/master/domains.txt'] },
                { name: 'Fakenews', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/fakenews/hosts', classes: 'text-warning' },
                { name: 'Gambling', url: ['https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/gambling/hosts', 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/gambling.txt'], classes: 'text-danger' },
                { name: 'Porn', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/porn/clefspeare13/hosts', classes: 'bg-danger' },
                { name: 'Social', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/social/sinfonietta/hosts', classes: 'text-warning' },
                { name: 'Adult', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/adult.txt', classes: 'bg-danger' },
                { name: 'Advertising', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/advertising.txt' },
                { name: 'Cartoons', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/cartoons.txt' },
                { name: 'Chat', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/chat.txt' },
                { name: 'Dangerous', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/dangerous.txt' },
                { name: 'Dating', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/dating.txt' },
                { name: 'Drugs', url: 'https://raw.githubusercontent.com/jankais3r/Synology-Safe-Access-domain-list/master/drugs.txt', classes: 'bg-danger' },
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
                ignored: $.extend({
                    data: [] // categories to be ignored
                }, absIgnore),
                expand: { hidden: true, sort: { orderBy: 'name', orderReverse: false } },
                resetCounter: function () {
                    $.each(dnsmasq.categories, function (index, value) {
                        value.hits = 0;
                        value.records = [];
                        value.requestors = [];
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
                                hits: 0,
                                records: [],
                                requestors: []
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
                            } else {
                                if (key.startsWith('address=')) {
                                    key = key.split('/')[1];
                                }
                            }

                            if (!(key in dict)) {
                                ++cat.size;
                            }

                            dict[key] = cat;
                        });
                    }
                },
                get: function (domainName) {
                    domainName = domainName.split('.');

                    while (domainName.length > 1) {
                        var domain = domainName.join('.');
                        var category = dnsmasq.categoriesOptions.data[domain];

                        if (typeof category !== 'undefined') {
                            ++category.hits;
                            return category;
                        }

                        domainName.shift();
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
            queriesOptions: {
                expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 50 },
                resolveNames: function () {
                    $.each(dnsmasq.queries, function (index, client) {
                        delete dnsmasq.hostnames[client.key];
                        $scope.networkResolve(client.key, client);
                    });
                }
            },
            resolvers: [],
            resolversOptions: { expand: { hidden: true, sort: { orderBy: 'key', orderReverse: false } }, sum: { totalRequests: 0 } },
            domains: [],
            domainsOptions: {
                expand: { hidden: false, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 10 }
            },
            settings: {
                bare_or_www_only: false,
                disable_website_description: false,
                ignore_data_with_future_date_log_files: true,
                retrieve_website_description_log_files: false,
                reset_data_when_load_log_files: true,
                show_raw_data_when_import: false
            },
            isNonRoutableRequest: function (query) {
                return typeof query.ipaddress === 'undefined'
                    || query.ipaddress === '0.0.0.0'
                    || query.ipaddress.indexOf('NXDOMAIN') === 0
                    || query.ipaddress.indexOf('NODATA') === 0;
            },
            setHidden: function (nodes, value) {
                $.each(nodes, function (index, node) {
                    if (node.expand) {
                        node.expand.hidden = value;
                    }
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

                if (loggedEvent.time > new Date() && loggedEvent.imported && dnsmasq.settings.ignore_data_with_future_date_log_files) {
                    return;
                }

                if (loggedEvent.domain === null) {
                    return;
                }

                // apply filters
                if (dnsmasq.settings.bare_or_www_only && !isBareOrWwwDomain(loggedEvent.domain)) {
                    return;
                }

                var categoryObj = dnsmasq.categoriesOptions.get(loggedEvent.domain);
                if (categoryObj !== false) {
                    if (dnsmasq.categoriesOptions.ignored.data.indexOf(categoryObj.name) !== -1) {
                        return;
                    }
                }

                var client = dnsmasq.queries.find(function (x) { return x.key === loggedEvent.requestor; });
                if (typeof client === 'undefined') {
                    client = {
                        key: loggedEvent.requestor,
                        lastRequestTime: loggedEvent.time,
                        expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 },
                        records: [],
                        totalTopDomains: 0,
                        totalDomains: 0,
                        totalRequests: 0,
                        categories: []
                    };
                    dnsmasq.queries.push(client);

                    $scope.networkResolve(loggedEvent.requestor, client);
                }

                var topDomainKey = getTopDomain(loggedEvent.domain);
                var subDomain = loggedEvent.domain.length > topDomainKey.length ? loggedEvent.domain.substring(0, loggedEvent.domain.length - topDomainKey.length - 1) : null;
                var topDomain = client.records.find(function (x) { return x.key === topDomainKey; });
                if (typeof topDomain === 'undefined') {
                    topDomain = {
                        key: topDomainKey,
                        lastRequestTime: loggedEvent.time,
                        expand: { hidden: true, sort: { orderBy: 'time', orderReverse: true }, limit: 20 },
                        records: [],
                        totalDomains: 0,
                        totalRequests: 0,
                        categories: []
                    };
                    client.records.push(topDomain);
                    ++client.totalTopDomains;
                }

                var domain = topDomain.records.find(function (x) { return x.domain === loggedEvent.domain; });
                if (typeof domain === 'undefined') {
                    domain = { totalRequests: 0, subdomain: subDomain };
                    topDomain.records.push(domain);
                    ++topDomain.totalDomains;
                    ++client.totalDomains;
                }
                $.extend(domain, loggedEvent);
                if (categoryObj !== false) {
                    domain.category = categoryObj;

                    var category = topDomain.categories.find(function (x) { return x === domain.category; });
                    if (typeof category === 'undefined') {
                        topDomain.categories.push(categoryObj);

                        // add category to the requester object if not already added
                        category = client.categories.find(function (x) { return x === domain.category; });
                        if (typeof category === 'undefined') {
                            client.categories.push(domain.category);
                        }
                    }

                    if (categoryObj.requestors.indexOf(client) === -1) {
                        categoryObj.requestors.push(client);
                    }
                }
                ++domain.totalRequests;
                ++topDomain.totalRequests;
                ++client.totalRequests;
                if (client.lastRequestTime <= loggedEvent.time) {
                    topDomain.lastRequestTime = loggedEvent.time;
                    client.lastRequestTime = loggedEvent.time;
                    client.lastDomain = topDomain;
                }
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
                        subdomain: subDomain,
                        totalRequestors: 0,
                        totalRequests: 0,
                        lastRequestTime: loggedEvent.time,
                        records: [],
                        expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }
                    };
                    topDomain.records.push(domain);
                }
                var requestor = domain.records.find(function (x) { return x.key === loggedEvent.requestor; });
                if (typeof requestor === 'undefined') {
                    requestor = {
                        key: loggedEvent.requestor,
                        lastRequestTime: loggedEvent.time,
                        totalRequests: 0,
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
                if (categoryObj !== false) {
                    var catTopDomainName = getTopDomain(loggedEvent.domain);

                    var catTopDomain = categoryObj.records.find(function (x) { return x.key === catTopDomainName; });
                    if (typeof catTopDomain === 'undefined') {
                        catTopDomain = {
                            records: [],
                            requestors: [],
                            key: catTopDomainName,
                            lastRequestTime: loggedEvent.time,
                            lastRequestor: requestor,
                            expand: { hidden: true, sort: { orderBy: 'time', orderReverse: true }, limit: 20 }
                        };
                        categoryObj.records.push(catTopDomain);
                    } else if (catTopDomain.lastRequestTime <= loggedEvent.time) {
                        catTopDomain.lastRequestor = requestor;
                        catTopDomain.lastRequestTime = loggedEvent.time;
                    }

                    if (catTopDomain.records.indexOf(domain) === -1) {
                        catTopDomain.records.push(domain);
                    }

                    if (catTopDomain.requestors.indexOf(client) === -1) {
                        catTopDomain.requestors.push(client);
                    }

                    domain.category = categoryObj;
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
                if (requestor.lastRequestTime <= loggedEvent.time) {
                    requestor.lastRequestTime = loggedEvent.time;
                    domain.lastRequestTime = loggedEvent.time;
                    domain.lastRequestor = requestor;
                    topDomain.lastRequestTime = loggedEvent.time;
                    topDomain.lastRequestor = requestor;

                    if (typeof domain.description !== 'undefined' && domain.description.length) {
                        topDomain.description = domain.description;
                    }
                }
                toBeFilledWithDescription.push(domain);
                toBeFilledWithDescription.push(topDomain);

                if (isNewDomain || typeof domain.description === 'undefined') {
                    if (dnsmasq.settings.retrieve_website_description_log_files === true || !(loggedEvent.imported === true)) {
                        domain.description = "";
                        getDescription();
                    }
                }

                function getDescription() {
                    var description = dnsmasq.descriptions[loggedEvent.domain];

                    if (typeof description === 'object') {
                        description.push(toBeFilledWithDescription);
                        return;
                    } else if (typeof description === 'undefined') {
                        var queue = [];
                        dnsmasq.descriptions[loggedEvent.domain] = queue;
                        queue.push(toBeFilledWithDescription);
                        dnsmasq.descriptions.requests.push(loggedEvent.domain);
                    } else {
                        $.each(toBeFilledWithDescription, function (index, obj) {
                            obj.description = description;
                        });
                    }
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
            importData: function () {
                var $this = this;

                $scope.loading_data = true;
                $scope.OldData = atob($scope.OldData.split(',')[1]);
                $this.applyData($scope.OldData.split('\n'));
                $scope.loading_data = false;
            },
            loadData: function () {
                var $this = this;

                $scope.loading_data = true;

                $.get($this.settings.OldDataUrl).done($this.applyData).always(function () {
                    $scope.loading_data = false;
                });
            },
            applyData: function (data) {
                if (typeof data === 'undefined' || data.length <= 0) {
                    return;
                }

                if (dnsmasq.settings.reset_data_when_load_log_files === true) {
                    dnsmasq.clearData();
                }

                $scope.OldData = data;
                processSavedData();
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

                $.post(dnsmasq.settings.HostnameResolveUrl + '/' + ipAddress, function (data) {
                    // remove the domain name at the end of the hostname
                    if (data !== null && data.endsWith(dnsmasq.settings.DomainName)) {
                        data = data.substring(0, data.length - dnsmasq.settings.DomainName.length - 1);
                    }

                    dnsmasq.hostnames[ipAddress] = data;

                    if (data !== ipAddress && data.length) {
                        $scope.$apply(function () {
                            $.each(queue, function (index, obj) {
                                obj.hostname = data;

                                if (typeof obj.hostnames === 'undefined') {
                                    obj.hostnames = [];
                                }
                                var hostname = obj.hostnames.find(function (x) { return x.name === data; });
                                if (typeof hostname === 'undefined') {
                                    obj.hostnames.push({ name: data, time: new Date() });
                                }
                            });
                        });
                    }
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
                .filter(function (e) { return e === 0 || e; })
                // trim the tokens
                .map(function (e) { return $.trim(e); });
            var baseIndex = 4; // the index of the start of the command data

            if (split.length <= baseIndex) {
                // print the line as is
                dnsmasq.dataAdd({
                    time: new Date(),
                    message: line
                });

                return;
            }

            // find the start index of the command
            for (var i = 0; i <= split.length; ++i) {
                var token = split[i];
                if (token && token.endsWith(':')) {
                    baseIndex = i + 1;
                    break;
                }
            }

            var timestamp = getDateTime(split);
            var loggerName = split[baseIndex - 1].slice(0, -1); // remove the ':' at the end of the name

            // write to the raw data table
            //-------------------------------------
            if (!imported || dnsmasq.settings.show_raw_data_when_import) {
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

            var queryKey = "query[A]";
            var cmd = split[baseIndex];

            // DHCP
            if (loggerName.startsWith('dnsmasq-dhcp')) {
                if (split[baseIndex + 1].startsWith('DHCPACK')) {
                    var ip = split[baseIndex + 2];
                    var mac = split[baseIndex + 3];
                    var hostindex = baseIndex + 4;
                    var hostname = split.length >= hostindex ? split[hostindex] : '';
                    var client = dnsmasq.queries.find(function (x) { return x.key === ip; });
                    var hostnameObj = null; // will be assigned if client exists

                    if (typeof client !== 'undefined') {
                        if (typeof client.hostnames === 'undefined') {
                            client.hostnames = [];
                        }
                        hostnameObj = client.hostnames.find(function (x) { return x.name === hostname || x.mac === mac; });
                        if (typeof hostnameObj === 'undefined') {
                            hostnameObj = { mac: mac, name: hostname };
                            client.hostnames.push(hostnameObj);
                        }
                        hostnameObj.mac = mac;
                        hostnameObj.time = timestamp;
                    }

                    if (typeof hostname !== 'undefined' && hostname.length) {
                        dnsmasq.hostnames[ip] = hostname;
                    }

                    if (typeof mac !== 'undefined' && mac.length) {
                        var vendor = dnsmasq.vendors[mac];
                        var hostnameExists = typeof hostnameObj !== 'undefined';

                        if (typeof vendor === 'object' && hostnameExists) {
                            vendor.push(hostnameObj);
                        } else if (typeof vendor === 'undefined') {
                            var queue = [];
                            if (hostnameExists) {
                                queue.push(hostnameObj);
                            }
                            dnsmasq.vendors[mac] = queue;
                            dnsmasq.vendors.requests.push(mac);
                        } else if (hostnameExists) {
                            hostnameObj.vendor = vendor;
                        }
                    }
                }
            }

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
            } else if (query !== null && query.domain === split[baseIndex + 1]) {
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
        setInterval(function () { dnsmasq.queriesOptions.resolveNames(); }, 15 * 60 * 1000);

        // query for the website description which processes 10 request at a time
        setInterval(function () {
            if (dnsmasq.descriptions.processingCount < 10) {
                processDescription();
            }
        }, 100);

        // query for the device's vendor information and it will process once per second
        setInterval(processVendorInfo, 1000);

        // load old data if any
        $timeout(processSavedData);

        function processVendorInfo() {
            var requests = dnsmasq.vendors.requests;
            var url = dnsmasq.settings.GetVendorInfoUrl;

            if (requests.length <= 0) {
                return;
            }

            if (typeof url === 'undefined') {
                return;
            }

            var mac = requests.pop(); // get the last item in the queue
            var queue = dnsmasq.vendors[mac];

            if (typeof queue !== 'object') {
                return;
            }

            $.get(url, { mac: mac }).done(function (data) {
                if (typeof data !== 'undefined' && data.length > 1) {
                    dnsmasq.vendors[mac] = data;

                    if (typeof data !== 'undefined') {
                        $.each(queue, function (index, client) {
                            if (client !== null) {
                                client.vendor = data;
                            }
                        });
                    }
                }
            });
        }

        function processDescription() {
            if (dnsmasq.settings.disable_website_description) {
                return;
            }

            var requests = dnsmasq.descriptions.requests;
            var url = dnsmasq.settings.GetDescriptionUrl;

            if (requests.length <= 0) {
                return;
            }

            if (typeof url === 'undefined') {
                return;
            }

            var domain = requests.pop(); // get the last item in the queue
            var queue = dnsmasq.descriptions[domain];

            if (typeof queue !== 'object') {
                return;
            }

            ++dnsmasq.descriptions.processingCount;

            $.get(url, { domain: domain }).done(function (data) {
                if (typeof data !== 'object') {
                    return;
                }

                var result = [];

                if (data.icon === null) {
                    data.icon = "https://" + domain + "/favicon.ico";
                }
                result.push("<img style='width:20px' src='");
                result.push(data.icon);
                result.push("' alt='' /> ");

                if (data.description !== null) {
                    result.push(data.description);
                } else if (data.title !== null) {
                    result.push(data.title);
                }

                data = result.join('');
                dnsmasq.descriptions[domain] = data;

                if (typeof data !== 'undefined') {
                    $.each(queue, function (index, subqueue) {
                        $.each(subqueue, function (index, obj) {
                            obj.description = data;
                        });
                    });
                }
            }).always(function () {
                --dnsmasq.descriptions.processingCount;
            });
        }

        function processSavedData() {
            if ($scope.OldData === null || typeof $scope.OldData !== 'object') {
                return;
            }

            // process multiple lines for each time
            // interval to improve data throughput
            var NUMBER_OF_LINES_PER_INTERVAL = 10;

            // need to reverse the array to process correctly
            // the data with time in increasing position because
            // we retrieve each line using pop() which returns
            // the last line of the array
            $scope.OldData = $scope.OldData.reverse();

            $scope.OldDataCount = $scope.OldData.length;
            $scope.OldDataLoadedCount = 0;

            var interval = setInterval(function () {
                var i = 0;

                for (i = 0; i < NUMBER_OF_LINES_PER_INTERVAL; i++) {
                    process();
                }
            });

            function process() {
                var data = $scope.OldData;

                if (data.length > 0) {
                    var loggedEvent = data.pop(); // get the last line
                    System.loggedEvent({ Message: loggedEvent, hidden: true });
                    $scope.OldDataLoadedCount++;
                } else {
                    clearInterval(interval);
                    $scope.$apply(function () {
                        $scope.OldData = [];
                        $scope.OldDataCount = 0;
                        $scope.OldDataLoadedCount = 0;
                    });
                }
            }
        }
    }]);

    System.angular.directive('fileReader', ['$q', function ($q) {
        var slice = Array.prototype.slice;

        return {
            restrict: 'A',
            require: '?ngModel',
            link: function (scope, element, attrs, ngModel) {
                if (!ngModel) { return; }

                ngModel.$render = function () { };

                element.bind('change', function (e) {
                    var target = e.target;

                    $q.all(slice.call(target.files, 0).map(readFile))
                    .then(function (values) {
                        if (target.multiple) ngModel.$setViewValue(values);
                        else ngModel.$setViewValue(values.length ? values[0] : null);
                        element.val(null); // clear the input when done
                    });

                    function readFile(file) {
                        var deferred = $q.defer();

                        var reader = new FileReader();
                        reader.onload = function (e) {
                            deferred.resolve(e.target.result);
                        };
                        reader.onerror = function (e) {
                            deferred.reject(e);
                        };
                        reader.readAsDataURL(file);

                        return deferred.promise;
                    }

                }); //change

            } //link
        }; //return
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
            template: "{{title}}<a ng-hide=\"options.expand.sort.orderBy != orderBy\" class=\"pull-right\"><span class=\"glyphicon\" ng-class=\"options.expand.sort.orderReverse ? 'glyphicon-triangle-bottom' : 'glyphicon-triangle-top'\" aria-hidden=\"true\"></span></a>",
            link: function (scope, element, attr) {
                element.on('click', function (event) {
                    var options = scope.options.expand.sort;
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