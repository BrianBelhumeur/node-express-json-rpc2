This is a JSON-RPC v2 handler middleware for the Express library on [node.js](http://nodejs.org).

First, simply include node-express-JSON-RPC2 in your configure/use statements before app.router:

    var express = require('express'),
    	jsonrpc = require('node-express-JSON-RPC2');

    app.configure(function(){
    	...
    	app.use( express.jsonrpc() );
    	...
    	app.use( app.router );
    });

Then wihin a route, use res.rpc to handle a given method. Unless the request is a notification, a response
function will be passed in after the parameters to handle the response.

    app.post('/path/for/rpc/calls', function (req, res, next) {
    	// notification (no response expected)
    	res.rpc('notification_method', function (params) {
    		// do processing here
    	});
    
    	// non-notification (response expected)
    	res.rpc('method_name', function (params, respond) {
    		// do processing here
    
    		// if everything is OK return result object:
    		respond( { result: resultData } );
    
    		// if something is wrong, return an error code:
    		respond(jsonrpc.INVALID_PARAMS)
    		// OR an extended error object:
    		respond({
    			error: {
    				code: jsonrpc.INVALID_PARAMS,
    				message: 'You gave me invalid parameters!',
    				data: data
    			}
    		});
    	});
    });

The middleware provides standard error codes and messages defined by the [JSON-RPC version 2 spec](http://www.jsonrpc.org/specification)

You can reference error codes by static string. For example, you may:

    respond(jsonRPC.INVALID_REQUEST);

And your response will be converted to:

    {
    	error: {
    		code: -32600,
    		message: 'Invalid request'
    	}
    }

The error code constants for reference:

    Variable Name    Code     Message
    ------------------------------------------------
    PARSE_ERROR      -32700  'Parse error'
    INVALID_REQUEST  -32600  'Invalid request'
    METHOD_NOT_FOUND -32601  'Method not found'
    INVALID_PARAMS   -32602  'Invalid parameters'
    INTERNAL_ERROR   -32603  'Internal error'
