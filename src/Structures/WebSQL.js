if(options.idbVersion == null){
	WebSQLStructure(function(){
		// Fallback to IndexedDB
		console.warn("Fallback to IndexedDB");
		IDBStructure();
	});
}

function WebSQLStructure(initError){
	SQLQueryBuilder();

	My.SQLQuery = function(query, values){
		return new Promise(function(resolve, reject){
			if(options.debug) options.debug(query, values);

			My.db.transaction(function(tx){
				tx.executeSql(query, values, function(tx, res){
					destroyObject(values);
					values = query = null;
	
					var readOnly = res && res.rows ? res.rows : res; // SQLResultSetRowList is immutable
					if(res && res.rowsAffected && !readOnly.length){
						resolve(res.rowsAffected);
						readOnly = null;
						return;
					}

					if(readOnly.length){
						var result = new Array(readOnly.length);
						for (var i = 0; i < readOnly.length; i++) {
							result[i] = readOnly[i];
						}

						readOnly = null;
						resolve(result);
					}
					else resolve([]);
				}, function(tx, error){
					destroyObject(values);
					values = query = null;
	
					if(error && My.onError) My.onError(error);
					reject('Database Error: ' + error.message);
				});
			}, function(error){
				if(error && My.onError) My.onError(error);
				reject('Database Transaction Error: ' + error.message);
			});
		});
	}

	function initializeTable(disablePlugin){
		if(!disablePlugin && window.sqlitePlugin){
			My.db = window.sqlitePlugin.openDatabase({name: databaseName, location: 'default'}, checkStructure, function(){
				console.error("Failed to initialize sqlitePlugin");
				setTimeout(function(){
					initializeTable(true);
				}, 500);
			});
		}
		else if(window.openDatabase){
			My.db = window.openDatabase(databaseName, "1.0", databaseName, 1024);
			if(My.db) setTimeout(checkStructure, 500);
		}
		else{
			console.error('WebSQL is not supported on this browser');
			if(initError) initError();
		}
	}

	initializeTable();
}