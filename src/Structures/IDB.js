if(!isNode && !options.websql){
	var iDBError = function(ev){
		console.error((ev.target && ev.target.error.message) || ev);
	}

	IDBStructure(function(e){
		if(typeof IDBOpenDBRequest !== 'function'){
			// Fallback to WebSQL
			console.warn("Fallback to WebSQL", e);
			return WebSQLStructure();
		}

		iDBError(e);
	});
}

function IDBStructure(initError){
	IDBQueryBuilder();

	if(!window.indexedDB)
  		window.indexedDB = window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
	if(!window.IDBTransaction)
		window.IDBTransaction = window.webkitIDBTransaction || window.msIDBTransaction;
	if(!window.IDBKeyRange)
		window.IDBKeyRange = window.webkitIDBKeyRange || window.msIDBKeyRange;

	if(!window.indexedDB || !window.IDBTransaction || !window.IDBKeyRange){
		if(initError) initError('IndexedDB was not found');
		return;
	}

	scope.busy = false;
	scope.storage = 'indexeddb';
	scope.reopen = function(){
		onStructureInitialize = function(){
			if(!options.websql){ // IndexedDB
				var db = scope.db.objectStoreNames;
				for (var i = 0; i < db.length; i++) {
					if(options.structure[db[i]] === void 0)
						scope.drop(db[i]);
				}
			}

			onStructureInitialize = null;
		};

		scope.db = window.indexedDB.open(databaseName, options.idbVersion || 1);
		scope.db.onupgradeneeded = scope.db.onversionchange = onVersionChange;
		scope.db.onerror = iDBError;
		scope.db.onsuccess = function(ev){
			if(scope.db.result){
				scope.db = scope.db.result;
				scope.db.onerror = iDBError;
			}

			initFinish(scope);
		};
	}

	scope.reopen();
	function onVersionChange(ev){
		if(scope.db.result)
			scope.db = scope.db.result;

		scope.busy = [];
		checkStructure(function(){
			if(!scope.busy)
				return;

			for (var i = 0; i < scope.busy.length; i++) {
				scope.busy[i][0].apply(null, scope.busy[1]);
			}

			scope.busy = false;
		});
	}

	//action = readwrite, readonly
	scope.getObjectStore = function(tableName, action, errorCallback){
		try{
  			var transaction = scope.db.transaction(tableName, action);
		}catch(e){
			if(errorCallback) errorCallback(e)
			return;
		}
  		transaction.onerror = errorCallback || iDBError;
  		return transaction.objectStore(tableName);
	}
}