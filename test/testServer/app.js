/**
 * Module dependencies.
 */

var express = require('express'),
	jsonrpc = require('node-express-JSON-RPC2');

var app = module.exports = express.createServer();

// Configuration
app.configure(function(){
	//app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(jsonrpc());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});

app.configure('development', function () {
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
	app.use(express.errorHandler()); 
});

// Routes
app.get('/', function (req, res, next) {
	res.redirect('/index.html');
});

app.all('/api', function (req, res, next) {
	res.rpc('subtract', function (params, respond) {
		var result;

		if (Array.isArray(params)) {
			result = params[0] - params[1];	
		} else if (typeof params === 'object') {
			result = params['param1'] - params['param2'];
		}

		if (isNaN(result)) {
			respond(jsonrpc.INVALID_PARAMS);
		} else {
			respond({ result: result });
		}
	});

	res.rpc('sum', function (params, respond) {
		var result;

		if (Array.isArray(params)) {
			result = params.reduce(function(total, val){ return total + val; });	
		}

		if (isNaN(result) || typeof result === 'undefined') {
			respond(jsonrpc.INVALID_PARAMS);
		} else {
			respond({ result: result });
		}
	});

	res.rpc('get_data', function (params, respond) {
		respond({ result: ["hello", 5] });
	});

	res.rpc('notify', function (params) {
		// notification test, do nothing
	});
});

app.error(function( err, req, res, next) {
	console.log( err );
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
