/*
	ScarletsFiction Database Library
	A simple database library for browser and nodejs
	https://github.com/ScarletsFiction/SFDatabase-js
	
	Make sure you include this header on this script
*/

'use strict';
function SFDatabase(databaseName, options, onConnected){
	var My = this;
	My.db = null;
	My.pending = [];
	My.initialized = false;
	if(options.databaseStructure)
		console.warn('`options.databaseStructure` is deprecated, please use `options.structure` instead.');

	if(!options.structure)
		options.structure = options.databaseStructure;

	if(!options)
		options = {debug:false};

	var initFinish = function(){
		if(My.initialized) return;
		My.initialized = true;

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
		if(!My.db){
			clearTimeout(pendingTimer);
			pendingTimer = setTimeout(resumePending, 1000);
			return;
		}
		if(!My.pending.length) return;
		for (var i = 0; i < My.pending.length; i++) {
			My.pending[i]();
		}
		My.pending.splice(0);
	}

	var destroyObject = function(obj){
		if(!obj || typeof obj !== 'object') return;
		if(obj.constructor === Array)
			obj.splice(0);
		else {
			var objKeys = Object.keys(obj);
			for (var i = 0; i < objKeys.length; i++) {
				delete obj[objKeys[i]];
			}
		}
		obj = null;
	}

	My.preprocessTable = {}; // {tableName:{columnName:{set:function, get:function}}}}
	var preprocessData = function(tableName, mode, object){
		var found = false;
		if(!My.preprocessTable[tableName]) return found;

		var keys = Object.keys(My.preprocessTable[tableName]);
		for (var i = 0; i < keys.length; i++) {
			if(!object[keys[i]] || !My.preprocessTable[tableName][keys[i]][mode])
				continue;
			object[keys[i]] = My.preprocessTable[tableName][keys[i]][mode](object[keys[i]]);
			found = true;
		}
		return found;
	}

	var isNode = typeof process !== 'undefined' && process.execPath;
	if(!isNode){
		var onStructureInitialize = null;
		var checkStructure = async function(callback){
			let object = options.structure;

			if(onStructureInitialize){
				onStructureInitialize();
				onStructureInitialize = null;
			}

			for (const table in object) {
				await My.createTable(table, options.structure[table]);
			}

			if(!callback) initFinish(My);
			else callback();
		}
	}
	// Load all query builder from here