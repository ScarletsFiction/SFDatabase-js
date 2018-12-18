if(!isNode && !options.websql){
	IDBStructure(function(){
		// Fallback to IndexedDB
		WebSQLStructure();
	});
}

function IDBStructure(initError){
	IDBQueryBuilder();

	//action = readwrite, readonly
	scope.getObjectStore = function(tableName, action, errorCallback){
  		var transaction = scope.db.transaction(tableName, action);
  		transaction.onerror = errorCallback;
  		return transaction.objectStore(tableName);
	}
}