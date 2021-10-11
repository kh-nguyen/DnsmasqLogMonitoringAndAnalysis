(function() {
    "use strict";

    System.angular.controller('DnsmasqController',
    ['$scope', '$element', '$http', '$timeout', function($scope, $element, $http, $timeout) {
        var controller = $($element);
        var model = controller.data('model');
        $.extend($scope, model);

        var abstractIgnore = {
            add: function() {
                var input = this.input;

                if (input === null) {
                    return;
                }

                input = $.trim(input);

                if (!this.data.find(function(x) { return x === input; })) {
                    this.data.push(input);
                }

                this.input = null;
            },
            remove: function(value) {
                this.data.splice(this.data.indexOf(value), 1);
            }
        };

        var abstractDescription = {
            hasDescription: function() {
                return (this.description && this.description.length > 1) ||
                    (this.title && this.title.length > 1) ||
                    (this.icon && this.icon.length > 1);
            }
    };

        var dnsmasqDefaultSourceName = 'default';
        var dnsmasqBase = {
            sourceName: dnsmasqDefaultSourceName,
            title: 'Dnsmasq Log Real-Time Monitoring And Analysis',
            limits: [5, 10, 20, 50, 100, 200, 500, 1000]
        };

        $scope.activeTabIndex = 0;
        $scope.setActiveTab = function (tabIndex) {
            $scope.activeTabIndex = tabIndex;
        };

        $scope.sources = [createDnsmasq(dnsmasqBase)];

        $(document).on("dnsmasq", function (event, line, loggedEvent) {
            if (typeof loggedEvent.source === 'undefined') {
                sendToAllSources(line);
            } else {
                // get dnsmasq object
                var dnsmasq = $scope.sources[0];
                if (dnsmasq.sourceName === dnsmasqDefaultSourceName) {
                    dnsmasq.sourceName = loggedEvent.source;
                } else {
                    dnsmasq = $scope.sources.find(o => o.sourceName === loggedEvent.source);

                    if (typeof dnsmasq === 'undefined') {
                        dnsmasq = createDnsmasq(dnsmasqBase);
                        dnsmasq.sourceName = loggedEvent.source;
                        $scope.sources.push(dnsmasq);
                    }
                }

                dnsmasq.processDnsmasq(event, line, loggedEvent.imported);
            }
        });

        function sendToAllSources(message) {
            $.each($scope.sources, function (index, dnsmasq) {
                dnsmasq.dataAdd({
                    time: new Date(),
                    message: message
                });
            });
        }

        function createDnsmasq(dnsmasqBase) {
            var dnsmasq = {};

            $.extend(true, dnsmasq, {
                startTime: new Date(),
                ignored: $.extend({
                    data: ['0.0.0.0'] // network nodes to be ignored
                }, abstractIgnore),
                ipAddresses: {},
                macAddresses: {},
                hostnames: {}, // resolved hostnames cache
                vendors: {
                    requests: []
                }, // resolved vendors cache
                icons: {}, // website's icon cache
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
                        data: ['Adware', 'Advertising'] // categories to be ignored
                    }, abstractIgnore),
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
                    resolveNames: refreshClientHostnames
                },
                resolvers: [],
                resolversOptions: {
                    expand: { hidden: true, sort: { orderBy: 'key', orderReverse: false } }, sum: { totalRequests: 0 }
                },
                domains: [],
                domainsOptions: {
                    expand: { hidden: false, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }
                },
                settings: {
                    bare_or_www_only: false,
                    disable_website_description: false,
                    reset_data_when_load_log_files: true,
                    retrieve_saved_data_when_load_log_files: true,
                    show_raw_data_when_import: false,
                    show_raw_data_dnsmasq_only: true
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
                    var REQUESTOR_MAX_RECORDS = 100;
                    var toBeFilledWithDescription = [];

                    if ($.inArray($.trim(loggedEvent.requestor), dnsmasq.ignored.data) >= 0) {
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

                    var topDomainKey = getTopDomain(loggedEvent.domain);
                    var subDomainKey = getSubDomain(loggedEvent.domain, topDomainKey);

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

                        networkResolve(loggedEvent.requestor, client);
                    }

                    var resolver = dnsmasq.resolvers.find(function (x) { return x.key === loggedEvent.resolver; });
                    if (typeof resolver === 'undefined') {
                        resolver = {
                            key: loggedEvent.resolver,
                            totalRequests: 0
                        };
                        dnsmasq.resolvers.push(resolver);

                        networkResolve(loggedEvent.resolver, resolver);
                    }
                    ++resolver.totalRequests;
                    ++dnsmasq.resolversOptions.sum.totalRequests;

                    var topDomain = dnsmasq.domains.find(function (x) { return x.key === topDomainKey; });
                    if (typeof topDomain === 'undefined') {
                        topDomain = {
                            key: topDomainKey,
                            icon: getIcon(topDomainKey),
                            info: getInfo(topDomainKey),
                            categories: [],
                            totalRequests: 0,
                            lastRequestTime: loggedEvent.time,
                            requestors: [],
                            records: [],
                            expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }
                        };
                        dnsmasq.domains.push(topDomain);

                        if (typeof topDomain.icon === 'undefined' && (!loggedEvent.imported || (loggedEvent.imported && !dnsmasq.settings.retrieve_saved_data_when_load_log_files))) {
                            dnsmasq.descriptions.requests.push({ domain: topDomainKey });
                        }
                    }
                    var domain = topDomain.records.find(function (x) { return x.key === loggedEvent.domain; });
                    if (typeof domain === 'undefined') {
                        domain = {
                            key: loggedEvent.domain,
                            subdomain: subDomainKey,
                            totalRequestors: 0,
                            totalRequests: 0,
                            icon: dnsmasq.icons[loggedEvent.domain],
                            lastRequestTime: loggedEvent.time,
                            records: [],
                            expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }
                        };
                        topDomain.records.push(domain);
                    }
                    var requestor = domain.records.find(function (x) { return x.client.key === loggedEvent.requestor; });
                    if (typeof requestor === 'undefined') {
                        requestor = {
                            client: client,
                            lastRequestTime: loggedEvent.time,
                            totalRequests: 0,
                            records: [loggedEvent],
                            expand: { hidden: true, sort: { orderBy: 'lastRequestTime', orderReverse: true }, limit: 20 }
                        };
                        domain.records.push(requestor);
                        ++domain.totalRequestors;

                        var topDomainRequestors = topDomain.requestors.find(function (x) { return x === loggedEvent.requestor; });
                        if (typeof topDomainRequestors === 'undefined') {
                            topDomain.requestors.push(loggedEvent.requestor);
                        }
                    }
                    if (categoryObj !== false) {
                        var catTopDomain = categoryObj.records.find(function (x) { return x.key === topDomainKey; });
                        if (typeof catTopDomain === 'undefined') {
                            catTopDomain = {
                                key: topDomainKey,
                                info: topDomain,
                                records: [],
                                requestors: [],
                                totalRequests: 0,
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

                        ++catTopDomain.totalRequests;

                        if (topDomain.categories.indexOf(categoryObj) === -1) {
                            topDomain.categories.push(categoryObj);
                        }

                        domain.category = categoryObj;
                    }
                    ++requestor.totalRequests;
                    ++domain.totalRequests;
                    ++topDomain.totalRequests;
                    {
                        // it is a new request only if the time difference is 60 seconds
                        var IsNewRecord = loggedEvent.time - requestor.lastRequestTime >= 60000;

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
                        topDomain.description = null;
                        toBeFilledWithDescription.push(topDomain);
                    }
                    toBeFilledWithDescription.push(domain);

                    // client info section
                    //-----------------------------------------------------
                    var clientTopDomain = client.records.find(function (x) { return x.key === topDomainKey; });
                    if (typeof clientTopDomain === 'undefined') {
                        clientTopDomain = {
                            key: topDomainKey,
                            info: topDomain,
                            lastRequestTime: loggedEvent.time,
                            expand: { hidden: true, sort: { orderBy: 'time', orderReverse: true }, limit: 20 },
                            records: [],
                            totalDomains: 0,
                            totalRequests: 0,
                            categories: []
                        };
                        client.records.push(clientTopDomain);
                        ++client.totalTopDomains;
                    }

                    var clientDomain = clientTopDomain.records.find(function (x) { return x.domain === loggedEvent.domain; });
                    if (typeof clientDomain === 'undefined') {
                        clientDomain = { totalRequests: 0, subdomain: subDomainKey };
                        clientTopDomain.records.push(clientDomain);
                        ++clientTopDomain.totalDomains;
                        ++client.totalDomains;
                    }
                    $.extend(clientDomain, loggedEvent);
                    if (categoryObj !== false) {
                        clientDomain.category = categoryObj;

                        var category = clientTopDomain.categories.find(function (x) { return x === clientDomain.category; });
                        if (typeof category === 'undefined') {
                            clientTopDomain.categories.push(categoryObj);

                            // add category to the requester object if not already added
                            category = client.categories.find(function (x) { return x === clientDomain.category; });
                            if (typeof category === 'undefined') {
                                client.categories.push(clientDomain.category);
                            }
                        }

                        if (categoryObj.requestors.indexOf(client) === -1) {
                            categoryObj.requestors.push(client);
                        }
                    }
                    ++clientDomain.totalRequests;
                    ++clientTopDomain.totalRequests;
                    ++client.totalRequests;
                    if (client.lastRequestTime <= loggedEvent.time) {
                        clientTopDomain.lastRequestTime = loggedEvent.time;
                        client.lastRequestTime = loggedEvent.time;
                    }
                    //-----------------------------------------------------

                    getDescription();

                    function getDescription() {
                        var domain = loggedEvent.domain;
                        var description = dnsmasq.descriptions[domain];

                        if ($.isArray(description)) {
                            Array.prototype.push.apply(description, toBeFilledWithDescription);
                            return;
                        } else if (typeof description === 'undefined') {
                            if (!(loggedEvent.imported === true)) {
                                dnsmasq.descriptions[domain] = toBeFilledWithDescription;
                                dnsmasq.descriptions.requests.push(domain);
                            }
                        } else {
                            if (typeof description === 'string' && description.length > 0) {
                                description = $.extend({
                                    domain: domain,
                                    topdomain: topDomainKey,
                                    subdomain: subDomainKey,
                                    icon: dnsmasq.icons[domain],
                                    description: description
                                }, abstractDescription);
                                dnsmasq.descriptions[domain] = description;
                            }
                            fillDescription(toBeFilledWithDescription, description);
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

                    function getIcon(key) {
                        var icon = dnsmasq.icons[key];
                        if (typeof icon === 'undefined') {
                            icon = dnsmasq.icons['www.' + key];
                        }
                        return icon;
                    }

                    function getInfo(key) {
                        var info = dnsmasq.descriptions[key];
                        if (typeof info === 'undefined') {
                            info = dnsmasq.descriptions['www.' + key];
                        }
                        if (typeof info === 'object') {
                            return info.description;
                        }
                        return info;
                    }
                },
                dataAdd: function (row) {
                    var data = dnsmasq.data;
                    var options = dnsmasq.dataOptions;
                    var chartData = dnsmasq.dataOptions.chart;

                    if (typeof options.expand.limit !== 'undefined' && data.length >= options.expand.limit) {
                        data.shift();
                    }

                    data.push(row);

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

                    $this.initializeLoadData(process);

                    function process() {
                        if ($this.settings.reset_data_when_load_log_files === true) {
                            dnsmasq.clearData();
                        }

                        dnsmasq.OldData = atob(dnsmasq.OldData.split(',')[1]);
                        applySaveData(dnsmasq.OldData.split('\n'));
                    }
                },
                loadData: function (fromDate) {
                    var $this = this;

                    $this.initializeLoadData(process);

                    function process() {
                        var parameters = {};

                        if (typeof fromDate !== 'undefined') {
                            parameters.fromDate = fromDate.format('YYYY-MM-DDTHH:mm:ssZ');
                        }

                        $.get($this.settings.GetLogFilesUrl, parameters).done(function (files) {
                            if (dnsmasq.settings.reset_data_when_load_log_files === true) {
                                dnsmasq.clearData();
                            }

                            dnsmasq.OldDataFiles = files.reverse();

                            processSavedFiles();
                        });
                    }
                },
                loadTodayData: function () {
                    this.loadData(moment().startOf('day'));
                },
                loadThreeDayData: function () {
                    this.loadData(moment().startOf('day').subtract(3, 'days'));
                },
                loadOneWeekData: function () {
                    this.loadData(moment().startOf('day').subtract(7, 'days'));
                },
                initializeLoadData: function (callback) {
                    var $this = this;

                    dnsmasq.loading_data = true;

                    // minimize all the tables to speed up loading
                    dnsmasq.dataOptions.expand.hidden = true;
                    dnsmasq.categoriesOptions.expand.hidden = true;
                    dnsmasq.queriesOptions.expand.hidden = true;
                    dnsmasq.domainsOptions.expand.hidden = true;
                    dnsmasq.resolversOptions.expand.hidden = true;

                    if ($this.settings.retrieve_saved_data_when_load_log_files === false) {
                        callback();

                        return;
                    }

                    // load all icons set if not done yet
                    if ($this.icons.loaded !== true) {
                        $.get($this.settings.GetIconsUrl).done(function (data) {
                            $.extend($this.icons, data);
                            $this.icons.loaded = true;
                            if (isDoneLoading()) {
                                callback();
                            }
                        });
                    }

                    // load all descriptions set if not done yet
                    if ($this.descriptions.loaded !== true) {
                        $.get($this.settings.GetDescriptionsUrl).done(function (data) {
                            $.extend($this.descriptions, data);
                            $this.descriptions.loaded = true;
                            if (isDoneLoading()) {
                                callback();
                            }
                        });
                    }

                    if (isDoneLoading()) {
                        callback();
                    }

                    function isDoneLoading() {
                        dnsmasq.loading_data_on_server = $this.icons.loaded !== true || $this.descriptions.loaded !== true;

                        return !dnsmasq.loading_data_on_server;
                    }
                },
                saveData: function () {
                    var blob = new Blob([JSON.stringify(dnsmasq)], { type: 'application/json' });
                    saveAs(blob, "dnsmasq.txt");
                },
                processDnsmasq: function (event, line, imported) {
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
                        sendToAllSources(line);

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

                    var queryKey = "query[";
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

                            updateClientInfo(client, mac, hostname, timestamp);

                            if (typeof hostname !== 'undefined' && hostname.length) {
                                if (typeof client !== 'undefined') {
                                    client.hostname = hostname;
                                }

                                if (dnsmasq.hostnames[ip] !== hostname) {
                                    dnsmasq.hostnames[ip] = hostname;

                                    // cache the name on the server
                                    $.post(dnsmasq.settings.HostnameResolveUrl + '/' + ip, { hostname: hostname });
                                }
                            }

                            requestVendorInfo(mac, hostnameObj);
                        }

                        return;
                    }

                    if (cmd.startsWith(queryKey)) {
                        var query = {};
                        query.type = "query";
                        query.time = timestamp;
                        query.domain = split[baseIndex + 1];
                        query.requestor = split[baseIndex + 3];
                        query.imported = imported;
                        queries.push(query);
                    } else {
                        var domain = split[baseIndex + 1];
                        var copula = split[baseIndex + 2];
                        var ipaddress = split[baseIndex + 3];

                        if (cquery !== null && copula === "is") {
                            cquery.ipaddress = ipaddress;
                            cquery.aliases.push(domain);

                            if (isIP(cquery.ipaddress)) {
                                dnsmasq.ipAddresses[cquery.domain] = cquery.ipaddress;
                            }

                            // if still cname then wait again
                            if (ipaddress === "<CNAME>") {
                                return;
                            }

                            dnsmasq.log(cquery);

                            cquery = null; // reset cname query when done
                        } else {
                            var nqueries = [];

                            $.each(queries, function (index, query) {
                                if (query.domain === domain) {
                                    if (cmd === "forwarded") {
                                        query.resolver = ipaddress;
                                    }
                                    else if (copula === "is") {
                                        if (cmd !== "reply") {
                                            query.resolver = cmd;
                                        }

                                        query.ipaddress = ipaddress;

                                        if (isIP(ipaddress)) {
                                            dnsmasq.ipAddresses[query.domain] = ipaddress;
                                        } else if (ipaddress === "<CNAME>") {
                                            query.aliases = [];
                                            cquery = query;
                                            return;
                                        }

                                        dnsmasq.log(query);
                                        return;
                                    }
                                } else {
                                    // if it is on the queue too long (5 seconds), remove it
                                    if (new Date() - query.time >= 5000) {
                                        dnsmasq.log(query);
                                        return;
                                    }
                                }

                                // re-query to wait for the next data line
                                nqueries.push(query);
                            });

                            queries = nqueries;
                        }
                    }

                    // refresh the view model
                    $scope.$apply();

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

                        date = moment(date.join(' '), 'YYYY MMM D HH:mm:ss');

                        // because of missing year info in the log, we assume
                        // future date value is for the time of the previous year
                        if (imported && date > new Date()) {
                            date.subtract(1, 'years');
                        }

                        return date;
                    }
                }
            }, dnsmasqBase, model.dnsmasq);

            // load category lists
            dnsmasq.categoriesOptions.load();

            dnsmasq.dataOptions.chart.initialize();

            var queries = [];
            var cquery = null;

            // send syslog message to the raw data table
            $(document).on("syslog", function (event, line) {
                if (dnsmasq.settings.show_raw_data_dnsmasq_only === true) {
                    return;
                }

                $scope.$apply(function () {
                    dnsmasq.dataAdd(line);
                });
            });

            // query for the website description which processes 10 request at a time
            setInterval(function () {
                if (dnsmasq.descriptions.processingCount < 10) {
                    processDescription();
                }
            }, 100);

            // query for the device's vendor information and it will process once per second
            setInterval(processVendorInfo, 1000);

            // refresh client's hostname every 60 minutes for any updates
            setInterval(refreshClientHostnames, 60 * 60 * 1000)

            // load old data if any
            $timeout(processSavedData);

            return dnsmasq;

            function networkResolve(ipAddress, storageObject, forceToResolve) {
                var requestsQueue = ipAddress;

                if ($.isArray(requestsQueue)) {
                    if (requestsQueue.length <= 0) {
                        return;
                    }

                    var request = requestsQueue.pop();

                    ipAddress = request.ipAddress;
                    storageObject = request.storageObject;
                    forceToResolve = request.forceToResolve;
                }

                ipAddress = $.trim(ipAddress);

                if (!isIP(ipAddress)) {
                    return ipAddress;
                }

                var hostname = dnsmasq.hostnames[ipAddress];
                var macAddress = dnsmasq.macAddresses[ipAddress];

                if ($.isArray(hostname)) {
                    if (hostname.indexOf(storageObject) < 0) {
                        hostname.push(storageObject);
                    }
                } else if (typeof hostname === 'undefined' || isIP(hostname) || forceToResolve) {
                    // start the loading indicator
                    $timeout(function () { storageObject.resolvingHostname = true; });

                    var hostnamesQueue = [];
                    dnsmasq.hostnames[ipAddress] = hostnamesQueue;
                    hostnamesQueue.push(storageObject);

                    $.get(dnsmasq.settings.HostnameResolveUrl + '/' + ipAddress, function (data) {
                        dnsmasq.hostnames[ipAddress] = data;

                        if (data !== ipAddress && data.length) {
                            $scope.$apply(function () {
                                $.each(hostnamesQueue, function (index, obj) {
                                    assignHostname(obj, data);
                                });
                            });
                        }

                        if ($.isArray(requestsQueue)) {
                            networkResolve(requestsQueue);
                        }
                    }).always(function () {
                        // stop the loading indicator when done
                        $timeout(function () { storageObject.resolvingHostname = false; }, 100);
                    });

                    assignHostname(storageObject, hostname);
                }

                if (macAddress === null || typeof macAddress === 'undefined') {
                    var macAddressesQueue = [];
                    dnsmasq.macAddresses[ipAddress] = macAddressesQueue;
                    macAddressesQueue.push(storageObject);

                    if (dnsmasq.settings.GetAllMacAddressesAndIpPairsUrl !== null) {
                        var url = dnsmasq.settings.GetAllMacAddressesAndIpPairsUrl;
                        dnsmasq.settings.GetAllMacAddressesAndIpPairsUrl = null;

                        $.get(url, function (data) {
                            $.each(data, function (index, macIpPair) {
                                macAddressesQueue = dnsmasq.macAddresses[macIpPair.ipAddress];

                                if ($.isArray(macAddressesQueue)) {
                                    $.each(macAddressesQueue, function (index, storageObject) {
                                        assignMacAddress(storageObject, macIpPair.macAddress);
                                        requestVendorInfo(storageObject.mac, storageObject);
                                    });
                                }

                                dnsmasq.macAddresses[macIpPair.ipAddress] = macIpPair.macAddress;
                            });
                        }).always(function () {
                            dnsmasq.settings.GetAllMacAddressesAndIpPairsUrl = url;

                            if ($.isArray(dnsmasq.macAddresses[ipAddress])) {
                                dnsmasq.macAddresses[ipAddress] = null;
                            }
                        });
                    }
                } else if (typeof macAddress === 'string') {
                    assignMacAddress(storageObject, macAddress);
                    requestVendorInfo(storageObject.mac, storageObject);
                } else if ($.isArray(macAddress)) {
                    if (macAddress.indexOf(storageObject) < 0) {
                        macAddress.push(storageObject);
                    }
                }

                function assignHostname(client, hostname) {
                    if (typeof hostname === 'undefined' || isIP(hostname)) {
                        return;
                    }

                    var domainNames = ['local', 'localdomain', dnsmasq.settings.DomainName];

                    // remove the domain name at the end of the hostname
                    $.each(domainNames, function (index, domainName) {
                        if (hostname !== null && hostname.endsWith(domainName)) {
                            hostname = hostname.substring(0, hostname.length - domainName.length - 1);
                        }
                    });

                    client.hostname = hostname;

                    if (typeof client.hostnames === 'undefined') {
                        client.hostnames = [];
                    }
                    var obj = client.hostnames.find(function (x) { return x.name === hostname; });
                    if (typeof obj === 'undefined') {
                        if (client.hostnames.length && typeof client.hostnames[0].name === 'undefined') {
                            client.hostnames[0].name = hostname;
                        } else {
                            client.hostnames.push({ name: hostname, time: new Date() });
                        }
                    }
                }

                function assignMacAddress(client, mac) {
                    if (typeof mac === 'undefined') {
                        return;
                    }

                    client.mac = mac;

                    if (typeof client.hostnames === 'undefined') {
                        client.hostnames = [];
                    }
                    var obj = client.hostnames.find(function (x) { return x.mac === mac; });
                    if (typeof obj === 'undefined') {
                        if (client.hostnames.length && typeof client.hostnames[0].mac === 'undefined') {
                            client.hostnames[0].mac = mac;
                        } else {
                            client.hostnames.push({ mac: mac, time: new Date() });
                        }
                    }
                }
            }

            function isIP(ipaddress) {
                if (ipaddress === null || typeof ipaddress === 'undefined') {
                    return false;
                }
                return ipaddress.split('.').length === 4;
            }

            function refreshClientHostnames() {
                var queue = [];

                $.each(dnsmasq.queries, function (index, client) {
                    queue.push({ ipAddress: client.key, storageObject: client, forceToResolve: true });
                });

                networkResolve(queue);
            }

            function updateClientInfo(client, mac, hostname, timestamp) {
                if (typeof client !== 'undefined') {
                    if (typeof client.hostnames === 'undefined') {
                        client.hostnames = [];
                    }
                    hostnameObj = client.hostnames.find(function (x) {
                        var nameLowerCase = typeof x.name === 'string' ? x.name.toLowerCase() : x.name;
                        var hostnameLowerCase = typeof hostname === 'string' ? hostname.toLowerCase() : hostname;
                        return nameLowerCase === hostnameLowerCase || x.mac === mac;
                    });
                    if (typeof hostnameObj === 'undefined') {
                        hostnameObj = { mac: mac, name: hostname };
                        client.hostnames.push(hostnameObj);
                    }
                    hostnameObj.mac = mac;
                    hostnameObj.time = timestamp;
                }
            }

            function requestVendorInfo(mac, client) {
                if (typeof mac !== 'undefined' && mac.length) {
                    var vendor = dnsmasq.vendors[mac];
                    var clientExists = client && typeof client !== 'undefined';

                    if ($.isArray(vendor) && client) {
                        if (vendor.indexOf(client) < 0) {
                            vendor.push(client);
                        }
                    } else if (typeof vendor === 'undefined') {
                        var queue = [];
                        if (clientExists) {
                            queue.push(client);
                        }
                        dnsmasq.vendors[mac] = queue;
                        dnsmasq.vendors.requests.push(mac);
                    } else if (clientExists) {
                        assignVendor(client, mac, vendor);
                    }
                }
            }

            function assignVendor(client, mac, vendor) {
                if (typeof client === 'undefined') {
                    return;
                }

                client.vendor = vendor;

                var hostname = client.hostnames.find(function (x) { return x.mac === mac; });
                if (typeof hostname !== 'undefined') {
                    hostname.vendor = vendor;
                }
            }

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
                                assignVendor(client, mac, data);
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

                if (typeof url === 'undefined') {
                    return;
                }

                if (requests.length <= 0) {
                    return;
                }

                var request = requests.pop(); // get the last item in the queue

                if (typeof request === 'undefined') {
                    return;
                }

                if (typeof request === 'string') {
                    var ipAddress = dnsmasq.ipAddresses[request];

                    if (ipAddress === '0.0.0.0') {
                        return;
                    }

                    request = { domain: request, ipAddress: ipAddress };
                }

                ++dnsmasq.descriptions.processingCount;

                $.get(url, request)
                    .done(processResponse).always(function () {
                        --dnsmasq.descriptions.processingCount;
                    });

                function processResponse(data) {
                    var domain = request.domain;
                    var topdomain = getTopDomain(domain);

                    data = $.extend({
                        domain: domain,
                        topdomain: topdomain,
                        subdomain: getSubDomain(domain, topdomain)
                    }, abstractDescription, data);

                    // the case of requesting for top domain info
                    if (data.subdomain === null || data.subdomain === 'www') {
                        var top = dnsmasq.domains.find(function (x) { return x.key === data.topdomain; });

                        if (typeof top !== 'undefined') {
                            if (typeof data.icon === 'string') {
                                top.icon = data.icon;
                            }

                            if (typeof data.description === 'string') {
                                top.info = data.description;
                            }
                        }
                    }

                    var queue = dnsmasq.descriptions[domain];

                    dnsmasq.descriptions[domain] = data;

                    if (!$.isArray(queue)) {
                        return;
                    }

                    fillDescription(queue, data);
                }
            }

            function fillDescription(queue, data) {
                $.each(queue, function (index, obj) {
                    obj.description = data.hasDescription() ? data : null;

                    if (typeof data.icon === 'string') {
                        dnsmasq.icons[data.domain] = data.icon;

                        if (data.subdomain === null || data.subdomain === 'www') {
                            obj.icon = data.icon;
                        }
                    }
                });
            }

            function processSavedFiles() {
                var files = dnsmasq.OldDataFiles;

                if (files === null || typeof files === 'undefined' || (files && files.length <= 0) || dnsmasq.OldDataCancel === true) {
                    $scope.$apply(function () {
                        dnsmasq.loading_data = false;
                        dnsmasq.OldDataFileInfo = null;
                        dnsmasq.OldDataFiles = null;
                        dnsmasq.OldDataCancel = false;
                    });

                    return;
                }

                var file = files.pop(); // get the last element

                $scope.$apply(function () {
                    dnsmasq.loading_data = true;
                    dnsmasq.OldDataFileInfo = file;
                });

                $.get(dnsmasq.settings.OldDataUrl, { fileName: file.name }).fail(function (msg) {
                    console.log('Load data failed with message: ' + JSON.stringify(msg));
                }).done(applySaveData);
            }

            function applySaveData(data) {
                if (typeof data === 'string') {
                    data = data.split('\n');
                }

                if (typeof data === 'undefined' || data.length <= 0) {
                    return;
                }

                dnsmasq.OldData = data;

                processSavedData();
            }

            function processSavedData() {
                if (dnsmasq.OldData === null || typeof dnsmasq.OldData !== 'object') {
                    return;
                }

                // process multiple lines for each time
                // interval to improve data throughput
                var NUMBER_OF_LINES_PER_INTERVAL = 1000;

                // need to reverse the array to process correctly
                // the data with time in increasing position because
                // we retrieve each line using pop() which returns
                // the last line of the array
                dnsmasq.OldData = dnsmasq.OldData.reverse();

                dnsmasq.OldDataCount = dnsmasq.OldData.length;
                dnsmasq.OldDataLoadedCount = 0;
                dnsmasq.loading_data = true;

                var interval = setInterval(function () {
                    var i = 0;

                    for (i = 0; i < NUMBER_OF_LINES_PER_INTERVAL; i++) {
                        process();
                    }
                });

                function process() {
                    if (dnsmasq.OldDataCancel === true) {
                        dnsmasq.OldDataCancel = false;
                        dnsmasq.OldData = [];
                    }

                    var data = dnsmasq.OldData;

                    if (data.length > 0) {
                        var loggedEvent = data.pop(); // get the last line
                        dnsmasq.processDnsmasq(null, loggedEvent, true);
                        dnsmasq.OldDataLoadedCount++;
                    } else {
                        clearInterval(interval);
                        $scope.$apply(function () {
                            dnsmasq.OldData = [];
                            dnsmasq.OldDataCount = 0;
                            dnsmasq.OldDataLoadedCount = 0;
                            dnsmasq.loading_data = false;
                        });
                        processSavedFiles();

                        // force to cancel the loop so that this block
                        // will not repeat multiple times
                        NUMBER_OF_LINES_PER_INTERVAL = 0
                    }
                }
            }

            function getTopDomain(domain) {
                var domainComponents = domain.split('.');

                if (domainComponents.length <= 1) {
                    return domain;
                }

                return domainComponents[domainComponents.length - 2]
                    + '.' + domainComponents[domainComponents.length - 1];
            }

            function getSubDomain(domain, topDomainKey) {
                if (typeof topDomainKey === 'undefined') {
                    topDomainKey = getTopDomain(domain);
                }

                return domain.length > topDomainKey.length
                    ? domain.substring(0, domain.length - topDomainKey.length - 1)
                    : null;
            }
        }
    }]);

    System.angular.directive('fileReader', ['$q', function($q) {
        var slice = Array.prototype.slice;

        return {
            restrict: 'A',
            require: '?ngModel',
            link: function(scope, element, attrs, ngModel) {
                if (!ngModel) { return; }

                ngModel.$render = function() { };

                element.bind('change', function(e) {
                    var target = e.target;

                    $q.all(slice.call(target.files, 0).map(readFile))
                        .then(function(values) {
                            if (target.multiple) ngModel.$setViewValue(values);
                            else ngModel.$setViewValue(values.length ? values[0] : null);
                            element.val(null); // clear the input when done
                        });

                    function readFile(file) {
                        var deferred = $q.defer();

                        var reader = new FileReader();
                        reader.onload = function(e) {
                            deferred.resolve(e.target.result);
                        };
                        reader.onerror = function(e) {
                            deferred.reject(e);
                        };
                        reader.readAsDataURL(file);

                        return deferred.promise;
                    }

                }); //change

            } //link
        }; //return
    }]);

    System.angular.directive('realTimeDataChart', function() {
        return {
            restrict: 'A',
            link: function(scope, element, attr) {
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

    System.angular.directive('sortDirection', function() {
        return {
            restrict: 'A',
            scope: { options: '=', orderBy: '@', title: '@' },
            template: "{{title}}<a ng-hide=\"options.expand.sort.orderBy != orderBy\" class=\"pull-right\"><span class=\"glyphicon\" ng-class=\"options.expand.sort.orderReverse ? 'glyphicon-triangle-bottom' : 'glyphicon-triangle-top'\" aria-hidden=\"true\"></span></a>",
            link: function(scope, element, attr) {
                element.on('click', function(event) {
                    var options = scope.options.expand.sort;
                    var orderBy = scope.orderBy;

                    scope.$apply(function() {
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

    System.angular.directive('toggleHidden', function() {
        return {
            restrict: 'A',
            scope: { options: '=' },
            template: "<a ng-click=\"options.hidden = !options.hidden\"><span class=\"glyphicon\" ng-class=\"options.hidden ? 'glyphicon-triangle-right' : 'glyphicon-triangle-bottom'\" aria-hidden=\"true\"></span></a>"
        };
    });

    System.angular.directive('domainsTemplate', function() {
        return {
            restrict: 'A',
            replace: true,
            scope: { domains: '=', dnsmasq: '=' },
            template: function() { return $('#dnsmasq-domains-template').html(); }
        };
    });

    System.angular.directive('tableOptionsTemplate', function() {
        return {
            restrict: 'A',
            replace: true,
            scope: { records: '=', options: '=', dnsmasq: '=' },
            template: function() { return $('#dnsmasq-table-options-template').html(); },
            link: function(scope, element, attr) { scope.Math = window.Math; }
        };
    });
}());