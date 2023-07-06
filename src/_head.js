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
	My.onError = options.onError;
	
	My.initialized = false;
	let onConnected = options.onInit;
	if(!options) options = {debug:false};

	var initFinish = function(){
		if(My.initialized) return;
		My.initialized = true;

		function resolve(){
			resolveBusy();
			for (let i=0; i < onInitWait.length; i++) 
				onInitWait[i]();

			onInitWait = null;
			_waitInit();
		}

		if(onConnected){
			setTimeout(function(){
				onConnected();
				resolve();
			}, 1);
		}
		else resolve();
	}

	let onInitWait = [];
	My.onInit = function(callback){
		if(My.initialized) return callback();
		onInitWait.push(callback);
	}

	let _waitInit;
	My.waitInit = new Promise(r => _waitInit = r);

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

	// {tableName:{columnName:{set:function, get:function}}}}
	My.preprocessTable = options.preprocessTable || {};
	var preprocessData = function(tableName, mode, object, isUpdate=false){
		var found = false;
		if(!My.preprocessTable[tableName]) return found;

		var keys = Object.keys(My.preprocessTable[tableName]);
		for (var i = 0; i < keys.length; i++) {
			if(!object[keys[i]] || !My.preprocessTable[tableName][keys[i]][mode])
				continue;
			object[keys[i]] = My.preprocessTable[tableName][keys[i]][mode](object[keys[i]], isUpdate);
			found = true;
		}
		return found;
	}

	var onStructureInitialize = null;
	var checkStructure = async function(callback){
		let object = options.structure;

		if(onStructureInitialize){
			onStructureInitialize();
			onStructureInitialize = null;
		}

		My._restructuring = true;
		try {
			for (var table in object) {
				await My.createTable(table, object[table]);
			}
		} catch(e) {
			console.error(e);
			throw e;
		}
		My._restructuring = false;

		if(!callback) initFinish(My);
		else callback();
	}

	// Load all query builder from here