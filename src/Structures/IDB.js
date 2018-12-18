if(!isNode && !options.websql){
	IDBStructure(function(){
		// Fallback to IndexedDB
		WebSQLStructure();
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
		initError();
		return;
	}

	scope.storage = 'indexeddb';
	scope.db = window.indexedDB.open(databaseName, 1);
	scope.db.onerror = initError;

	scope.db.onupgradeneeded = scope.db.versionchange = function(ev){
		if(scope.db.result)
			scope.db = scope.db.result;
	};

	scope.db.onsuccess = function(ev){
		if(scope.db.result)
			scope.db = scope.db.result;
		
		checkStructure();
	};

	//action = readwrite, readonly
	scope.getObjectStore = function(tableName, action, errorCallback){
  		var transaction = scope.db.transaction(tableName, action);
  		transaction.onerror = errorCallback;
  		return transaction.objectStore(tableName);
	}
}