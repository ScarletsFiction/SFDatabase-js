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

	My.busy = false;
	My.storage = 'indexeddb';
	My.reopen = function(){
		onStructureInitialize = function(){
			if(!options.websql){ // IndexedDB
				var db = My.db.objectStoreNames;
				for (var i = 0; i < db.length; i++) {
					if(options.structure[db[i]] === void 0)
						My.drop(db[i]);
				}
			}

			onStructureInitialize = null;
		};

		My.db = window.indexedDB.open(databaseName, options.idbVersion || 1);
		My.db.onupgradeneeded = My.db.onversionchange = onVersionChange;
		My.db.onsuccess = function(ev){
			if(My.db.result){
				My.db = My.db.result;
			}

			initFinish(My);
		};
	}

	My.reopen();
	function onVersionChange(ev){
		if(My.db.result)
			My.db = My.db.result;

		My.busy = new Promise(resolve => {
			checkStructure(function(){
				if(!My.busy) return;
				resolve();
				My.busy = false;
			});
		});
	}

	//action = readwrite, readonly
	My.getObjectStore = function(tableName, action, errorCallback){
		try{
  			var transaction = My.db.transaction(tableName, action);
		}catch(e){
			if(errorCallback) errorCallback(e)
			return;
		}
  		transaction.onerror = errorCallback || iDBError;
  		return transaction.objectStore(tableName);
	}
}