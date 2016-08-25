#!/usr/bin/env node

var cheerio = require('cheerio');
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var _ = require('underscore');

var app = express();
app.use(express.static('public'));
app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false }
}));

function calculateConflicts(retainers)
{
    var conflicts = [];
    _.each(retainers,function(retainer)
    {
        _.each(retainer.items,function(item)
        {
            _.each(retainers,function(retainer2)
            {
                if(retainer2 !== retainer) {
                    _.each(retainer2.items, function (item2) {
                        if(item2.name == item.name && item2.isHQ == item.isHQ)
                        {
                            conflicts.push({name: item.name, retainer: retainer.name, isHQ: item.isHQ})
                        }
                    });
                }
            });
        })
    });
    return conflicts;
}

app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: false, limit:'50mb' }))

app.get('/', function (req, res) {
	var sess = req.session;
	var retainers = sess.retainers ? sess.retainers : [];
    var conflicts = calculateConflicts(retainers);
   res.render('index', { title: 'Hey',retainers: retainers, conflicts: conflicts});
});

app.post('/', function (req, res) {
  var body = req.body.html;
  var $ = cheerio.load(body);
  var sess = req.session;
  var retainers = sess.retainers ? sess.retainers : [];
  var items = $("#retainer_baggage_tbody tr");
  var retainerData = {};
  var newItems = [];
  var retainerName = $(".retainer--name p").text();
  var isSame = _.find(retainers, function(retainer)
  {
	  if(retainer.name == retainerName)
	  {
		  return true;
	  }
	  return false;
  });
  var hasRetainer = (typeof(isSame) === "undefined" ? false : true);
  console.log(retainers);
  console.log(hasRetainer);
  if(!hasRetainer)
  {
	  retainerData.name = retainerName;
	  items.each(function(key, trItem)
	  {
		  var itemName = $(trItem).find(".highlight").text();
		  var quantity = $(trItem).find("td").text();
          var isHq = $(trItem).find("img[src*='hq.png']").length === 0 ? false : true;
		  newItems.push({name: itemName, quantity: quantity, isHQ: isHq});
	  })
	  retainerData.items = newItems;
	  retainers.push(retainerData);
	  sess.retainers = retainers;
  }
    var conflicts = calculateConflicts(retainers);
	req.session.save(function(err) {
	  res.render('index', { title: 'Hey',retainers: retainers, conflicts: conflicts});
	})  
  
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
