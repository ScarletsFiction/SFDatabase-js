/*
	ScarletsFiction Database Library
	A simple database library for browser and nodejs
	https://github.com/ScarletsFiction/SFDatabase-js
	
	Make sure you include this header on this script
*/

'use strict';

// Ext-AlaSQL.js are required for browser only if the browser didn't support WebSQL
function SFDatabase(databaseName, options, onConnected){
	var scope = this;
	scope.db = null;
	scope.pending = [];
	scope.initialized = false;
	if(!options)
		options = {debug:false};

	var initFinish = function(){
		if(scope.initialized) return;
		scope.initialized = true;

		var async = onConnected ? onConnected(resumePending) : false;
		if(!async) resumePending();
	}

	var pendingTimer = -1;
	var resumePending = function(){
		if(!scope.db){
			clearTimeout(pendingTimer);
			pendingTimer = setTimeout(resumePending, 1000);
			return;
		}
		if(!scope.pending.length) return;
		for (var i = 0; i < scope.pending.length; i++) {
			scope.pending[i]();
		}
		scope.pending.splice(0);
	}

	var destroyObject = function(obj){
		if(!obj || typeof obj !== 'object') return;
		if(obj instanceof Array)
			obj.splice(0);
		else {
			var objKeys = Object.keys(obj);
			for (var i = 0; i < objKeys.length; i++) {
				delete obj[objKeys[i]];
			}
		}
		obj = null;
	}

	scope.preprocessTable = {}; // {tableName:{columnName:{set:function, get:function}}}}
	var preprocessData = function(tableName, mode, object){
		var found = false;
		if(!scope.preprocessTable[tableName]) return found;

		var keys = Object.keys(scope.preprocessTable[tableName]);
		for (var i = 0; i < keys.length; i++) {
			if(!object[keys[i]] || !scope.preprocessTable[tableName][keys[i]][mode])
				continue;
			object[keys[i]] = scope.preprocessTable[tableName][keys[i]][mode](object[keys[i]]);
			found = true;
		}
		return found;
	}

	// The code below could be similar with PHP version
	scope.validateText = function(text){
		var matches = text.match(/[a-zA-Z0-9_\.]+/i);
		return '`'+matches[0]+'`';
	}

	var isNode = typeof process !== 'undefined' && process.execPath;
	// Load all query builder from here