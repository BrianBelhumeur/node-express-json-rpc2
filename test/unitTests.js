$(document).ready(function(){
	var RPC_ID = 1;

	QUnit.testStart = function(){
		RPC_ID++;
	};

	// default params for all AJAX calls
	$.ajaxSetup({
		url: 'http://localhost:3000',
		dataType: 'json',
		timeout: 3000,
		type: 'post'
	});

	module('RPC call with positional parameters');
	asyncTest('42 - 23 equals 19', 2, function() {
		$.ajax({
			data: JSON.stringify({
				jsonrpc: '2.0',
				method: 'subtract',
				params: [42, 23],
				id: RPC_ID
			})
		}).always(function(jqXHR){
				equal(jqXHR.status, 200, 'HTTP return code is 200');
				deepEqual(jqXHR.data, {
					jsonrpc: '2.0',
					result: 19,
					id: RPC_ID
				});
				start();
			});
	});
	asyncTest('23 - 42 equals -19', 2, function() {
		$.ajax({
			data: JSON.stringify({
				jsonrpc: '2.0',
				method: 'subtract',
				params: [23, 42],
				id: RPC_ID
			})
		}).always(function(jqXHR){
				equal(jqXHR.status, 200, 'HTTP return code is 200');
				deepEqual(jqXHR.data, {
					jsonrpc: '2.0',
					result: -19,
					id: RPC_ID
				});
				start();
			});
	});
});