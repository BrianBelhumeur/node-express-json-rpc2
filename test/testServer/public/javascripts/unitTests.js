$(document).ready(function() {
	var RPC_ID = 0;
	var INVALID_REQUEST = {
		jsonrpc: '2.0',
		error: {
			code: -32600,
			message: 'Invalid request'
		},
		id: null
	};
	var INVALID_PARAMS = {
		jsonrpc: '2.0',
		error: {
			code: -32602,
			message: 'Invalid params'
		},
		id: null
	};
	var PARSE_ERROR = {
		jsonrpc: '2.0',
		error: {
			code: -32700,
			message: 'Parse error'
		},
		id: null
	};
	var METHODS = ['get', 'post'];
	var method, i = 0, len = METHODS.length;

	QUnit.testStart = function() {
		RPC_ID++;
	};

	for (; i < len; i += 1) {
		method = METHODS[i];

		// default params for all AJAX calls
		$.ajaxSetup({
			url: 'http://localhost:3000/api',
			dataType: 'json',
			timeout: 1000,
			type: method,
			complete: function() {
				start();
			}
		});

		module('RPC call with positional parameters - ' + method.toUpperCase());
		asyncTest('42 - 23 equals 19', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					jsonrpc: '2.0',
					method: 'subtract',
					params: [42, 23],
					id: RPC_ID
				}),
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						{
							jsonrpc: '2.0',
							result: 19,
							id: RPC_ID
						},
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('23 - 42 equals -19', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					jsonrpc: '2.0',
					method: 'subtract',
					params: [23, 42],
					id: RPC_ID
				}),
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						{
							jsonrpc: '2.0',
							result: -19,
							id: RPC_ID
						},
						'Response is correct.'
					);
				}
			});
		});

		module('RPC call with named parameters - ' + method.toUpperCase());
		asyncTest('42 - 23 equals 19', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					jsonrpc: '2.0',
					method: 'subtract',
					params: {
						param1: 42,
						param2: 23
					},
					id: RPC_ID
				}),
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						{
							jsonrpc: '2.0',
							result: 19,
							id: RPC_ID
						},
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('23 - 42 equals -19', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					jsonrpc: '2.0',
					method: 'subtract',
					params: {
						param1: 23,
						param2: 42
					},
					id: RPC_ID
				}),
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						{
							jsonrpc: '2.0',
							result: -19,
							id: RPC_ID
						},
						'Response is correct.'
					);
				}
			});
		});

		module('Notifications - ' + method.toUpperCase());
		asyncTest('Notification without params returns no response', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					jsonrpc: '2.0',
					method: 'notify'
				}),
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 204, 'HTTP return code is 204');
					equal(data, null, 'No response.');
				}
			});
		});
		asyncTest('Notification with params returns no response', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					jsonrpc: '2.0',
					method: 'notify',
					params: {
						first: {
							reason: 'just to see if sending params breaks something'
						},
						second: 'they should not, of course'
					}
				}),
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 204, 'HTTP return code is 204');
					equal(data, null, 'No response.');
				}
			});
		});
		asyncTest('Batch of notifications returns no response', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify([
			        {"jsonrpc": "2.0", "method": "notify", "params": [1,2,4]},
			        {"jsonrpc": "2.0", "method": "notify"}
		        ]),
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 204, 'HTTP return code is 204');
					equal(data, null, 'No response.');
				}
			});
		});

		module('Error handling - ' + method.toUpperCase());
		asyncTest('Call of non-existant method', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					jsonrpc: '2.0',
					method: 'thisMethodDoesNotExist',
					id: RPC_ID
				}),
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						{
							jsonrpc: '2.0',
							error: {
								code: -32601,
								message: 'Method not found'
							},
							id: RPC_ID
						},
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('Call with invalid parameters', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					jsonrpc: '2.0',
					method: 'subtract',
					params: {
						param1: 23,
						param2: 'qqq'
					},
					id: RPC_ID
				}),
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						{
							jsonrpc: '2.0',
							error: {
								code: -32602,
								message: 'Invalid parameters'
							},
							id: RPC_ID
						},
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('Call with invalid JSON', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: '{"jsonrpc": "2.0", "method": "foobar, "params": "bar", "baz]',
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						PARSE_ERROR,
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('Call with invalid request object', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: '{"jsonrpc": "2.0", "method": 1, "params": "bar"}',
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						INVALID_REQUEST,
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('Batch call, invalid JSON', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: '[{"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"}, {"jsonrpc": "2.0", "method"]',
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						PARSE_ERROR,
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('Call with an empty array', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: '[]',
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						INVALID_REQUEST,
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('Call with an invalid batch of one element', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: '[1]',
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						[INVALID_REQUEST],
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('Call with an invalid batch', 2, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: '[1,2,3]',
				success: function(data, textStatus, jqXHR) {
					equal(jqXHR.status, 200, 'HTTP return code is 200');
					deepEqual(
						data,
						[INVALID_REQUEST, INVALID_REQUEST, INVALID_REQUEST],
						'Response is correct.'
					);
				}
			});
		});
		asyncTest('Batch call with valid and invalid requests and notifications', 6, function() {
			$.ajax({
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify([
			        {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},
			        {"jsonrpc": "2.0", "method": "notify", "params": [7]},
			        {"jsonrpc": "2.0", "method": "subtract", "params": [42,23], "id": "2"},
			        {"foo": "boo"},
			        {"jsonrpc": "2.0", "method": "foo.get", "params": {"name": "myself"}, "id": "5"},
			        {"jsonrpc": "2.0", "method": "get_data", "id": "9"}
		        ]),
				success: function(data, textStatus, jqXHR) {
					var correctResponse = [
			        {"jsonrpc": "2.0", "result": 7, "id": "1"},
			        {"jsonrpc": "2.0", "result": 19, "id": "2"},
			        INVALID_REQUEST,
			        {"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": "5"},
			        {"jsonrpc": "2.0", "result": ["hello", 5], "id": "9"}
		            ],
		            i, j, dataLen, testLen;

					equal(jqXHR.status, 200, 'HTTP return code is 200');

					for (i = 0, dataLen = data.length; i < dataLen; i += 1){
						for (j = 0, testLen = correctResponse.length; j < testLen; j += 1){
							if ( data[i].id === correctResponse[j].id ){
								deepEqual(data[i], correctResponse[j], 'Response is correct.');
							}
						}
					}
				}
			});
		});
	}
});