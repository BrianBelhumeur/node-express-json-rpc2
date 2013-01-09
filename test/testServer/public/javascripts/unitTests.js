$(document).ready(function() {
	var RPC_ID = 0;

	QUnit.testStart = function() {
		RPC_ID++;
	};

	// default params for all AJAX calls
	$.ajaxSetup({
		url: 'http://localhost:3000/api',
		dataType: 'json',
		timeout: 1000,
		type: 'get',
		complete: function() {
			start();
		}
	});

	module('RPC call with positional parameters');
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

	module('RPC call with named parameters');
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

	module('Notifications');
	asyncTest('Notification without params returns no response', 1, function() {
		$.ajax({
			contentType: 'application/json; charset=UTF-8',
			data: JSON.stringify({
				jsonrpc: '2.0',
				method: 'notify'
			}),
			success: function(data, textStatus, jqXHR) {
				equal(data, null, 'No response.');
			}
		});
	});
	asyncTest('Notification with params returns no response', 1, function() {
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
				equal(data, null, 'No response.');
			}
		});
	});

	module('Error handling');
	asyncTest('Call of non-existant method', 1, function() {
		$.ajax({
			contentType: 'application/json; charset=UTF-8',
			data: JSON.stringify({
				jsonrpc: '2.0',
				method: 'thisMethodDoesNotExist',
				id: RPC_ID
			}),
			success: function(data, textStatus, jqXHR) {
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
	asyncTest('Call with invalid JSON', 1, function() {
		$.ajax({
			contentType: 'application/json; charset=UTF-8',
			data: '{"jsonrpc": "2.0", "method": "foobar, "params": "bar", "baz]',
			success: function(data, textStatus, jqXHR) {
				deepEqual(
					data, 
					{
						jsonrpc: '2.0',
						error: {
							code: -32700,
							message: 'Parse error'
						},
						id: null
					}, 
					'Response is correct.'
				);
			}
		});
	});
});