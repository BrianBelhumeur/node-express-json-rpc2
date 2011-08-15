/*  
Connect/Express JSON-RPC v2 handler
Copyright 2011 by Brian Belhumeur
	
Released under MIT license:
Copyright (c) 2011 Brian Belhumeur [Brian's last name]@gmail.com
	
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

module.exports = function jsonRPC2(){
	return function jsonRPC2(req, res, next) {
		var rpcList = req.body, 
			i, reqCount,
			key, proc, procLen,
			isBatch = true,
			responses = [],
			responseCount = 0;
			finalOutput = '',
			procedures = {},
			errorCodes = {
				'PARSE_ERROR': -32700,
				'INVALID_REQUEST': -32600,
				'METHOD_NOT_FOUND': -32601,
				'INVALID_PARAMS': -32602,
				'INTERNAL_ERROR': -32603
			},
			errorMessages = {
				'-32700': 'Parse error',
				'-32600': 'Invalid request',
				'-32601': 'Method not found',
				'-32602': 'Invalid parameters',
				'-32603': 'Internal error'
				//-32099 to -32000 are open for use
			},
			makeErrorObject = function ( err, id ) {
				var code;

				if ( errorCodes[ err ] ) {
					code = errorCodes[ err ];
				}

				id = ( id ) ? id : null;

				return {
					jsonrpc: '2.0',
					id: id,
					error: {
						code: code,
						message: errorMessages[ code ]
					}
				};
			},
			addProcedure = function ( procedure ) {
				var method = procedure.method;

				if ( method === 'undefined' || procedure.jsonrpc !== '2.0' ) {
					responses.push( makeErrorObject( 'INVALID_REQUEST', procedure.id ) );
				}

				if ( ! procedures[ method ] ) {
					procedures[ method ] = [];
				}

				procedures[ method ].push( procedure );
			},
			rpc = function (method, callback) {
				var i = 0,
					methods = procedures[ method ],
					len,
					retObj;

				// method queue will be handled by 'methods'
				delete procedures[ method ];

				if ( methods === 'undefined' ) {
					return;
				}

				len = methods.length;

				// handle method queue
				for ( ; i < len; i += 1 ) {
					method = methods.shift();

					// send response callback if response is required
					if ( method.id ) {
						responseCount++;

						callback(
							method.params,
							function ( response ) {
								respond( method.id, response );
							}
						);
					}
					else {
						retObj = callback( method.params );

					}
				}

				// finish now if no responses are expected
				if ( responseCount === 0 ) {
					sendResponses();
				}
			},
			respond = function (id, responseObj) {
				var response = {
						jsonrpc: '2.0',
						id: id
					},
					code, message;

				// handle either result or error
				if ( responseObj.result ) {
					response.result = responseObj.result;
				}
				else {
					// it's an error
					response.error = {};

					code = responseObj.error.code;
					message = responseObj.error.message;

					// determine the numeric return code
					if ( typeof code === 'string' ) {
						response.error.code =
							( errorCodes[ code ] )
							? errorCodes[ code ]
							: errorCodes[ 'INTERNAL_ERROR' ];
					}
					else if ( typeof code === 'number' && code >= -32700 && code <= -32000 ) {
						response.error.code = code;
					}
					else {
						// not sure what it is, call it an internal error
						response.error.code = errorCodes[ 'INTERNAL_ERROR' ];
					}

					// grab the code we settled on
					code = response.error.code;

					// set correct response message
					response.error.message =
						( errorMessages[ code ] )
						? errorMessages[ code ]
						: errorMessages[ errorCodes[ 'INTERNAL_ERROR' ] ];

					// send data if it's there
					if ( responseObj.error.data ) {
						response.error.data = responseObj.error.data;
					}
				}

				responses.push( response );

				responseCount--;

				if ( responseCount === 0 ) {
					sendResponses();
				}
			},
			sendResponses = function () {
				// send response(s)
				if ( responses.length > 0 ) {
					finalOutput = ( isBatch ) ? responses : responses[0];

					finalOutput = JSON.stringify( finalOutput );

					// add JSONP callback if extant
					if ( req.query && req.query.callback ) {
						finalOutput = req.query.callback + '( ' + finalOutput + ' );';
					}

					res.end( finalOutput );
				}
				else {
					res.end();
				}
			};

		//TODO handle case of invalid JSON being submitted

		// expose response handler
		res.rpc = rpc;

		// single requeusts get put into an array for consistency
		if ( ! Array.isArray( rpcList ) ) {
			rpcList = [ rpcList ];
			isBatch = false;
		}

		reqCount = rpcList.length;

		// handle batch request with empty array
		if ( reqCount === 0 ) {
			res.end( makeErrorObject( 'INVALID_REQUEST' ) );
		}

		// set up procedure structure for .rpc() calls
		for ( i = 0; i < reqCount; i += 1 ) {
			addProcedure( rpcList[i] );
		}

		// RPC calls are handled within routes
		next();

		// unclaimed requests get a "Method not found" error
		for ( key in procedures ) {
			proc = procedures[ key ];
			procLen = proc.length;

			for ( i = 0; i < procLen; i += 1 ) {
				if ( proc[i].id ) {
					respond( proc[i].id, { error: { code: 'METHOD_NOT_FOUND' } } );
				}
				else {
					// push a response manually since no response was expected
					responses.push( makeErrorObject( 'METHOD_NOT_FOUND' ) );
				}
			}
		}
	};
};
