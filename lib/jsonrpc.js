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

var q = require('q');

module.exports = (function(){
  var PARSE_ERROR = -32700,
    INVALID_REQUEST = -32600,
    METHOD_NOT_FOUND = -32601,
    INVALID_PARAMS = -32602,
    INTERNAL_ERROR = -32603;

  var jsonrpc = function () {
    return function jsonrpc (req, res, next) {
      var requestedProcList = req.body,
        i = 0,
        reqCount, request, procList, procLen,
        isBatch = true,
        bypassSetup = false,
        requestList = {},
        promiseResponseList = [],
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
            var deferred = q.defer();
            deferred.resolve(makeErrorObject( { code: INVALID_REQUEST, id: procedure.id } ));
            promiseResponseList.push( deferred.promise );
            return;
          }

          requestList[ method ] = requestList[ method ] || [];

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
          var methodList = requestList[ method ],
            len,
          // closure to remember the id of each request
            makeResponder = function( id, deferred ) {
              var deferred = q.defer();
              promiseResponseList.push( deferred.promise );
              if ( typeof id !== 'undefined' ) {
                return function ( response ) {
                  respond( id, response, deferred );
                };
              }
            };
          if ( !Array.isArray( methodList ) ) {
            return;
          }

          delete requestList[ method ];

          // handle method queue
          while ( method = methodList.shift() ) {
            // setup response callback if response is required
            handler(
              method.params,
              makeResponder( method.id )
            );
          }
        },
        respond = function (id, responseObj, deferred) {
          var response = {}, code, message, data;

          // .result means it's a success
          if ( responseObj.result ) {
            response = {
              jsonrpc: '2.0',
              id: id,
              result: responseObj.result
            };
          }
          // otherwise it's an error
          else {
            if ( typeof responseObj.error === 'object' ) {
              code = responseObj.error.code;
              message = responseObj.error.message;
              data = responseObj.error.data;
            }
            else if ( typeof ( code = parseInt( responseObj, 10 ) ) === 'number' ) {
              message = ERROR_MESSAGES[ code ];
            }
            else {
              code = INTERNAL_ERROR;
              message = ERROR_MESSAGES[ code ];
              data = responseObj;
            }

            response = makeErrorObject( { id: id, code: code, message: message, data: data } );
          }
          deferred.resolve(response);
          //sendResponse();
        },
        handleNoRequests = function ( code ) {
          bypassSetup = true;
          promiseResponseList = [ makeErrorObject( { code: code } ) ];
          res.rpc = function () {};
        },
        sendResponse = function () {
          var finalOutput;
          var contentLength, code;
          var deferred = q.defer();
          if ( promiseResponseList.length ) {
            if ( ! isBatch ) {
              promiseResponseList = promiseResponseList[0];
            }
            q.all(promiseResponseList).then(function(responseList) {
              finalOutput = JSON.stringify( responseList );
              // add JSONP callback if it exists
              if ( req.query && req.query.callback ) {
                finalOutput = req.query.callback + '(' + finalOutput + ');';
              }
              deferred.resolve(finalOutput);
            });
          } else {
            deferred.resolve();
          }
          deferred.promise.then(function(finalOutput) {
            contentLength = Buffer.byteLength( finalOutput || '');
            code = contentLength ? 200 : 204;

            res.writeHead( code,
              {
                'Content-Type': 'application/json',
                'Content-Length': contentLength
              }
            );

            res.end( finalOutput );
          });
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
            // empty array should not be treated as a batch
            isBatch = false;
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
              if ( typeof procList[i].id !== 'undefined' ) {
                var deferred = q.defer();
                respond( procList[i].id, makeErrorObject( { code: METHOD_NOT_FOUND } ), deferred );
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

  jsonrpc.PARSE_ERROR = PARSE_ERROR,
    jsonrpc.INVALID_REQUEST = INVALID_REQUEST,
    jsonrpc.METHOD_NOT_FOUND = METHOD_NOT_FOUND,
    jsonrpc.INVALID_PARAMS = INVALID_PARAMS,
    jsonrpc.INTERNAL_ERROR = INTERNAL_ERROR;

  return jsonrpc;
}());