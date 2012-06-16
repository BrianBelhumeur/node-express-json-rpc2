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

module.exports = function jsonrpc2(){
	return function jsonrpc2(req, res, next) {
		var requestedProcList = req.body || req.query,
			i = 0,
            reqCount, request, procList, procLen,
			isBatch = true,
			processComplete = false,
			requestList = {},
			responseList = [],
			/** @constant */
			ERROR_CODES = {
				'PARSE_ERROR': -32700,
				'INVALID_REQUEST': -32600,
				'METHOD_NOT_FOUND': -32601,
				'INVALID_PARAMS': -32602,
				'INTERNAL_ERROR': -32603
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
			makeErrorObject = function ( err, id, data ) {
				var code, errorObj = {
					jsonrpc: '2.0'
				};

				code = ERROR_CODES[ err ] || ERROR_CODES[ 'INTERNAL_ERROR' ];

				errorObj.id = ( id ) ? id : null;
				errorObj.error = {
					code: code,
					message: ERROR_MESSAGES[ code ]
				};

				if ( typeof data !== 'undefined' ) {
					errorObj.error.data = data;
				}

				return errorObj;
			},
			/**
			 * Adds the requested RPC method to a list for execution a method handler added in the routes
			 * @param {Object} procedure RPC request object with properties 'jsonrpc', 'method' and optionally 'params' and 'id'
			 */
			addRequest = function ( procedure ) {
				var method = procedure.method;

				if ( typeof method !== 'string' || procedure.jsonrpc !== '2.0' ) {
					responseList.push( makeErrorObject( 'INVALID_REQUEST', procedure.id ) );
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

				if ( typeof methodList  === 'undefined' ) {
					return;
				}

				delete requestList[ method ];

				len = methodList.length;

				// handle method queue
				for ( ; i < len; i += 1 ) {
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
				var response = {
						jsonrpc: '2.0',
						id: id
					},
					code, message, data;

				// handle either result (success) or error
				if ( responseObj.result ) {
					response.result = responseObj.result;
				}
				else {
					if ( typeof responseObj.error === 'object' ) {
						code = responseObj.error.code;
						message = responseObj.error.message;
						data = responseObj.error.data;
					}
					else {
						response.error = {};
					}

					// code can be either numeric code or string equivalent
					if ( typeof code === 'number' ) {
						code = parseInt( code, 10 );
					}
					else {
						code = ERROR_CODES[ code ] || ERROR_CODES[ 'INTERNAL_ERROR' ];
					}

					// set correct response message if needed
					if ( typeof message === 'undefined' ) {
						message = ERROR_MESSAGES[ code ] || ERROR_MESSAGES[ ERROR_CODES[ 'INTERNAL_ERROR' ] ];
					}

					response.error.code = code;
					response.error.message = message;

					// send data if it's there
					if ( data ) {
						response.error.data = data;
					}
				}

				responseList.push( response );
			},
			handleNoRequests = function ( reason ) {
				processComplete = true;
				responseList = [ makeErrorObject( reason ) ];
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

				res.end( finalOutput );
			};

		if ( typeof requestedProcList === 'string' ) {
			try {
				JSON.parse( requestedProcList );
			}
			catch ( e ) {
				handleNoRequests( 'PARSE_ERROR' );
			}
		}
		else if ( typeof requestedProcList === 'object' ) {
			// single requests get put into an array for consistency
			requestedProcList = [ requestedProcList ];
			isBatch = false;
		}

		reqCount = requestedProcList.length;

		// batch request with empty array
		if ( ! reqCount ) {
			handleNoRequests( 'INVALID_REQUEST' );
		}

		if ( ! processComplete ) {
			// set up procedure request list
			for ( ; i < reqCount; i += 1 ) {
				addRequest( requestedProcList[i] );
			}

			// expose response handler
			res.rpc = handleRequest;
		}

		// requests are handled within routes
		next();

		// respond to unclaimed requests with a "Method not found" error
		for ( request in requestList ) {
			procList = requestList[ request ];
			procLen = procList.length;

			for ( i = 0; i < procLen; i += 1 ) {
				// notifications do not get ANY responses
				if ( procList[i].id ) {
					respond( procList[i].id, makeErrorObject( 'METHOD_NOT_FOUND' ) );
				}
			}
		}

		sendResponse();
	};
};
