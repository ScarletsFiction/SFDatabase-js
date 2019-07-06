if(!isNode && !options.websql){
	IDBStructure(function(e){
		if(typeof IDBOpenDBRequest !== 'function'){
			// Fallback to WebSQL
			console.warn("Fallback to WebSQL", e);
			return WebSQLStructure();
		}

		console.error(e.target.error);
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
		scope.db.onerror = console.error;
		scope.db.onsuccess = function(ev){
			if(scope.db.result){
				scope.db = scope.db.result;
				scope.db.onerror = console.error;
			}

			initFinish(scope);
		};
	}

	scope.reopen();
	function onVersionChange(ev){
		if(scope.db.result)
			scope.db = scope.db.result;

		checkStructure(function(){});
	}

	//action = readwrite, readonly
	scope.getObjectStore = function(tableName, action, errorCallback){
		try{
  			var transaction = scope.db.transaction(tableName, action);
		}catch(e){
			if(errorCallback) errorCallback(e)
			return;
		}
  		transaction.onerror = errorCallback || console.error;
  		return transaction.objectStore(tableName);
	}
}