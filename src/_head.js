/*
	ScarletsFiction Database Library
	A simple database library for browser and nodejs
	https://github.com/ScarletsFiction/SFDatabase-js
	
	Make sure you include this header on this script
*/

'use strict';
function SFDatabase(databaseName, options){
	var My = this;
	My.db = null;

	let resolveBusy;
	My.busy = new Promise(r => resolveBusy = r);

	My.initialized = false;
	if(options.databaseStructure)
		console.warn('`options.databaseStructure` is deprecated, please use `options.structure` instead.');

	let onConnected = options.onInit;

	if(!options.structure)
		options.structure = options.databaseStructure;

	if(!options)
		options = {debug:false};

	var initFinish = function(){
		if(My.initialized) return;
		My.initialized = true;

		if(onConnected){
			setTimeout(function(){
				onConnected();
				resolveBusy();
			}, 1);
		}
		else resolveBusy();
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

			My._restructuring = true;
			for (const table in object) {
				await My.createTable(table, options.structure[table]);
			}
			My._restructuring = false;

			if(!callback) initFinish(My);
			else callback();
		}
	}
	// Load all query builder from here