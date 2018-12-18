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

		if(onConnected){
			setTimeout(function(){
				if(!onConnected(resumePending))
					resumePending();
			}, 1);
		}
		else resumePending();
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

	var isNode = typeof process !== 'undefined' && process.execPath;
	if(!isNode){
		var onStructureInitialize = null;
		var checkStructure = function(){
			var table = Object.keys(options.databaseStructure);

			var queued = table.length;
			var reduceQueue = function(){
				queued--;
				if(queued === 0) initFinish(scope);
			};

			setTimeout(function(){
				if(queued > 1)
					console.error("Failed to initialize database structure");
			}, 5000);

			for (var i = 0; i < table.length; i++) {
				scope.createTable(table[i], options.databaseStructure[table[i]], reduceQueue);
			}

			if(onStructureInitialize){
				onStructureInitialize();
				onStructureInitialize = null;
			}
		}
	}
	// Load all query builder from here