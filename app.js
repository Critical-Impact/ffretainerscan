#!/usr/bin/env node

var cheerio = require('cheerio');
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var _ = require('underscore');
var RedisStore = require('connect-redis')(session);



var app = express();
var store = new RedisStore();
app.use(express.static('public'));
app.use(session({
    store: store,
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true,
    cookie: {secure: false}
}));

/*
var items = jQuery("#retainer_baggage_tbody tr .ic_reflection_box").toArray();
alert("Now running script, please wait ya fucking drongo");
function loadItem(item) {
    if (items.length === 0) {
        jQuery("html").text(jQuery("html").html());
        alert("all done yo! copy whats now on the page into the app");
    } else {
        jQuery.ajax({
            cache: false,
            type: 'get',
            url: $(item).data('lazy_load_url'),
            dataType: 'html',
            success: function (data) {
                $(item).append(data);
                loadItem(items.pop());
            }
        });
    }
}
loadItem(items.pop());

var MyRequestsCompleted = (function () {
    var numRequestToComplete, requestsCompleted, callBacks, singleCallBack;

    return function (options) {
        if (!options) options = {};

        numRequestToComplete = options.numRequest || 0;
        requestsCompleted = options.requestsCompleted || 0;
        callBacks = [];
        var fireCallbacks = function () {
            alert("we're all complete");
            for (var i = 0; i < callBacks.length; i++) callBacks[i]();
        };
        if (options.singleCallback) callBacks.push(options.singleCallback);

        this.addCallbackToQueue = function (isComplete, callback) {
            if (isComplete) requestsCompleted++;
            if (callback) callBacks.push(callback);
            if (requestsCompleted == numRequestToComplete) fireCallbacks();
        };
        this.requestComplete = function (isComplete) {
            if (isComplete) requestsCompleted++;
            if (requestsCompleted == numRequestToComplete) fireCallbacks();
        };
        this.setCallback = function (callback) {
            callBacks.push(callBack);
        };
    };
})();
*/

function calculateConflicts(retainers)
{
    var allItems = {};
    _.each(retainers, function(retainer){
        _.each(retainer.items, function(item)
        {
            if (!_.has(allItems, item.name + (item.isHQ ? "_hq" : ""))) {
                allItems[item.name + (item.isHQ ? "_hq" : "")] = {
                    name: item.name,
                    isHQ: item.isHQ
                };
            }
            var current = allItems[item.name + (item.isHQ ? "_hq" : "")];
            if (!_.has(current, retainer.name)) {
                current[retainer.name] = 0;
            }
            current[retainer.name] += parseInt(item.quantity);
        })
    });

    _.each(allItems, function(item)
    {
        item.conflicts = -1;
        _.each(retainers, function(retainer)
        {
            if(typeof(item[retainer.name]) !== "undefined")
            {
                item.conflicts++;
            }
        });
    });
    return _.filter(allItems, function(item)
    {
        return item.conflicts != 0;
    })
}

function calculateConflicts2(retainers) {
    var conflicts = {};
    retainers = _.clone(retainers);
    _.each(retainers, function (retainer) {
        _.each(retainer.items, function (item2) {
            item2.scanned = false;
        });
        _.each(retainers, function (retainer2) {
            retainer[retainer2.name] = false;
        });
    });
    _.each(retainers, function (retainer) {
        console.log("Scanning " + retainer.name + "'s inventory");
        _.each(retainers, function (retainer2) {
            console.log(typeof(retainer2[retainer.name]));
            if (retainer2 !== retainer && retainer2[retainer.name] != true) {
                console.log("Comparing against " + retainer2.name + "'s inventory");
                _.each(retainer.items, function (item) {

                    _.each(retainer2.items, function (item2) {
                        if (item2.name == item.name && item2.isHQ == item.isHQ && item.scanned == false && item2.scanned == false) {
                            //If the item is already in the conflicts list
                            if (!_.has(conflicts, item.name + (item.isHQ ? "_hq" : ""))) {
                                conflicts[item.name + (item.isHQ ? "_hq" : "")] = {
                                    name: item.name,
                                    quantity: 0,
                                    isHQ: item.isHQ
                                };
                            }
                            var current = conflicts[item.name + (item.isHQ ? "_hq" : "")];
                            if (!_.has(current, retainer.name)) {
                                current[retainer.name] = 0;
                            }
                            if (!_.has(current, retainer2.name)) {
                                current[retainer2.name] = 0;
                            }
                            item.scanned = true;
                            item2.scanned = true;
                            current[retainer.name] += parseInt(item.quantity);
                            current[retainer2.name] += parseInt(item2.quantity);
                            console.log(current);
                        }
                    });
                });
            }
            retainer[retainer2.name] = true;
        });
    });
    return conflicts;
}

app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({extended: false, limit: '50mb'}))

app.get('/', function (req, res) {
    var sess = req.session;
    var retainers = sess.retainers ? sess.retainers : [];
    var conflicts = calculateConflicts(retainers);
    res.render('index', {title: 'Hey', retainers: retainers, conflicts: conflicts});
});

app.get('/clear-retainer-data',function (req,res)
{
    var sess = req.session;
    req.session.destroy();
    res.redirect('/');
});

app.post('/', function (req, res) {
    var body = req.body.html;
    var $ = cheerio.load(body);
    var sess = req.session;
    var retainers = sess.retainers ? sess.retainers : [];
    var items = $("#retainer_baggage_tbody tr");
    var retainerData = {};
    var newItems = [];
    var retainerName = $(".retainer--name p").text().replace(/["']/g, "");
    var isSame = _.find(retainers, function (retainer) {
        if (retainer.name == retainerName) {
            return true;
        }
        return false;
    });
    var hasRetainer = (typeof(isSame) === "undefined" ? false : true);
    console.log(retainers);
    console.log(hasRetainer);
    if (!hasRetainer) {
        retainerData.name = retainerName;
        items.each(function (key, trItem) {
            var itemName = $(trItem).find(".highlight").text();
            var quantity = $(trItem).find("td").text();
            var isHq = $(trItem).find("img[src*='hq.png']").length === 0 ? false : true;
            newItems.push({name: itemName, quantity: quantity, isHQ: isHq});
        });
        retainerData.items = newItems;
        retainers.push(retainerData);
        sess.retainers = retainers;
    }
    var conflicts = calculateConflicts(retainers);
    req.session.save(function (err) {
        res.render('index', {title: 'Hey', retainers: retainers, conflicts: conflicts});
    })

});

app.listen(8003, function () {
    console.log('Example app listening on port 3000!');
});
