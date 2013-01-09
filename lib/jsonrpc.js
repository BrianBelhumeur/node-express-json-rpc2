/*
Connect/Express route-based JSON-RPC v2 handler
Copyright 2012 by Brian Belhumeur

Released under MIT license:
Copyright (c) 2012 Brian Belhumeur [Brian's last name]@gmail.com

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
*/

'use strict';

module.exports = function jsonrpc() {
	var PARSE_ERROR = -32700,
		INVALID_REQUEST = -32600,
		METHOD_NOT_FOUND = -32601,
		INVALID_PARAMS = -32602,
		INTERNAL_ERROR = -32603;

	return function jsonrpc(req, res, next) {
		var requestedProcList = req.body,
			i = 0,
			reqCount, request, procList, procLen,
			isBatch = true,
			bypassSetup = false,
			requestList = {},
			responseList = [],
			/** @constant */
			ERROR_CODES = {
				'PARSE_ERROR': PARSE_ERROR,
				'INVALID_REQUEST': INVALID_REQUEST,
				'METHOD_NOT_FOUND': METHOD_NOT_FOUND,
				'INVALID_PARAMS': INVALID_PARAMS,
				'INTERNAL_ERROR': INTERNAL_ERROR
			},
			/** @constant */
			ERROR_MESSAGES = {
				'-32700': 'Parse error',
				'-32600': 'Invalid request',
				'-32601': 'Method not found',
				'-32602': 'Invalid parameters',
				'-32603': 'Internal error'
				//-32099 to -32000 are open for use
			},
			makeErrorObject = function ( params ) {
				var id, code, message, data,
					errorObj = {
						jsonrpc: '2.0'
					};

				if ( typeof params === 'object' ) {
					id = ( typeof params.id !== 'undefined' ) ? params.id : null;
					code = parseInt( params.code, 10 );
					code = ( params.code >= -32700 && params.code <= -32000 )
						? code
						: INTERNAL_ERROR;
					message = params.message || ERROR_MESSAGES[ code ];
					data = params.data;
				}

				errorObj.id = id;
				errorObj.error = {
					code: code,
					message: message,
					data: data
				};

				return errorObj;
			},
			/**
			 * Adds the requested RPC method to a list for execution by a method handler added in the routes
			 * @param {Object} procedure RPC request object with properties 'jsonrpc', 'method' and optionally 'params' and 'id'
			 */
			addRequest = function ( procedure ) {
				var method = procedure.method;

				if ( typeof method !== 'string' || procedure.jsonrpc !== '2.0' ) {
					responseList.push( makeErrorObject( { code: INVALID_REQUEST, id: procedure.id } ) );
					return;
				}

				if ( ! requestList[ method ] ) {
					requestList[ method ] = [];
				}

				requestList[ method ].push( procedure );
			},
			/**
			 * Specifies the request handler for a given RPC method
			 * @param {String} RPC method name
			 * @param {Function} Function that will be invoked with RPC request parameters (or undefined if omitted) as
			 * first parameter and response function as second parameter if a response is expected
			 * @public
			 */
			handleRequest = function (method, handler) {
				var i = 0,
					methodList = requestList[ method ],
					len,
					makeResponder = function( id ) {
						return function ( response ) {
							respond( id, response );
						};
					};

				if ( typeof methodList === 'undefined' ) {
					return;
				}

				delete requestList[ method ];

				len = methodList.length;

				// handle method queue
				for ( ; i < len; i++ ) {
					method = methodList.shift();

					// setup response callback if response is required
					if ( method.id ) {
						handler(
							method.params,
							makeResponder( method.id )
						);
					}
					else {
						handler( method.params );
					}
				}
			},
			respond = function (id, responseObj) {
				var response = {}, code, message, data;

				// handle either result (success) or error
				if ( responseObj.result ) {
					response = {
						jsonrpc: '2.0',
						id: id,
						result: responseObj.result
					};
				}
				else {
					if ( typeof responseObj.error === 'object' ) {
						code = responseObj.error.code;
						message = responseObj.error.message;
						data = responseObj.error.data;
					}

					response = makeErrorObject( { id: id, code: code, message: message, data: data } );
				}

				responseList.push( response );
			},
			handleNoRequests = function ( code ) {
				bypassSetup = true;
				responseList = [ makeErrorObject( { code: code } ) ];
				res.rpc = function () {};
			},
			sendResponse = function () {
				var finalOutput;

				if ( responseList.length ) {
					if ( ! isBatch ) {
						responseList = responseList[0];
					}

					finalOutput = JSON.stringify( responseList );

					// add JSONP callback if it exists
					if ( req.query && req.query.callback ) {
						finalOutput = req.query.callback + '(' + finalOutput + ');';
					}
				}

				res.writeHead( 200, 
					{
						'Content-Type': 'application/json',
						'Content-Length': Buffer.byteLength( finalOutput || '' )
					}
				);

				res.end( finalOutput );
			},
			setup = function () {
				// single requests get put into an array for consistency
				if ( !Array.isArray( requestedProcList ) ) {
					requestedProcList = [ requestedProcList ];
					isBatch = false;
				}

				reqCount = requestedProcList.length;

				// batch request with empty array
				if ( ! reqCount ) {
					handleNoRequests( INVALID_REQUEST );
				}

				if ( ! bypassSetup ) {
					// set up procedure request list
					for ( i = 0; i < reqCount; i++ ) {
						addRequest( requestedProcList[i] );
					}
				}

				// requests are handled within routes
				next();

				// respond to unclaimed requests with a "Method not found" error
				for ( request in requestList ) {
					procList = requestList[ request ];
					procLen = procList.length;

					for ( i = 0; i < procLen; i++ ) {
						// notifications do not get ANY responses
						if ( procList[i].id ) {
							respond( procList[i].id, makeErrorObject( { code: METHOD_NOT_FOUND } ) );
						}
					}
				}

				sendResponse();
			}; // end of var declarations

		// expose response handler
		res.rpc = handleRequest;

		// make sure we are actually handling a JSON-RPC request
		if ( req.headers['content-type'] && req.headers['content-type'].indexOf( 'application/json' ) > -1 ) {
			// nothing in req.body
			if ( typeof requestedProcList === 'undefined' ) {
		    var buf = '';

		    if ( req.originalUrl.indexOf( '?' ) > -1 ) {
					try {
						requestedProcList = JSON.parse( decodeURIComponent( req.originalUrl.substr( req.originalUrl.indexOf( '?' ) + 1 ) ) );
					} catch (e) {
						handleNoRequests( PARSE_ERROR );
					}

					setup();
		    } else {
					req.setEncoding( 'utf8' );
					req.on( 'data', function (chunk) { buf += chunk } );
					req.on( 'end', function () {
						try {
							requestedProcList = req.body = JSON.parse( buf );
						} catch (e) {
							handleNoRequests( PARSE_ERROR );
						}

						setup();
					});
		    }

			} else {
				setup();
			}
		} else {
			// not a JSON-RPC request
			next();
		}
	};
};
