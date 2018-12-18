if(!isNode && options.websql === undefined) options.websql = true;
if(options.websql){
	WebSQLStructure(function(){
		// Fallback to IndexedDB
		IDBStructure();
	});
}

function WebSQLStructure(initError){
	SQLQueryBuilder();

	var databaseTest = function(errorCallback){
		scope.initialized = true;
		scope.SQLQuery('select 1', [], function(data){
			scope.initialized = false;
			if(data.length) initFinish(scope);
		}, function(){
			scope.initialized = false;
			errorCallback();
		});
	}

	scope.SQLQuery = function(query, values, successCallback, errorCallback){
		if(!scope.initialized){
			scope.pending.push(function(){
				scope.SQLQuery(query, values, successCallback, errorCallback)
			});
			clearTimeout(pendingTimer);
			pendingTimer = setTimeout(resumePending, 1000);
			return;
		}

		if(options.debug) options.debug(query, values);

		scope.db.transaction(function(tx){
			tx.executeSql(query, values, function(tx, res){
				destroyObject(values);
	            values = query = null;

				if(successCallback){
					var readOnly = res && res.rows ? res.rows : res; // SQLResultSetRowList is immutable
					if(res && res.rowsAffected && !readOnly.length){
						successCallback(res.rowsAffected);
						readOnly = null;
						return;
					}
					if(readOnly.length){
						var result = {length:readOnly.length};
						for (var i = 0; i < readOnly.length; i++) {
							result[i] = readOnly[i];
						}
						readOnly = null;
						successCallback(result);
					}
					else successCallback([]);
	            }
			}, function(tx, error){
				var msg = 'Database Error: ' + error.message;
				destroyObject(values);
	            values = query = null;

				if(errorCallback) errorCallback(msg);
				else console.error(msg);
			});
		}, function(error){
			var msg = 'Database Transaction Error: ' + error.message;
			if(errorCallback) errorCallback(msg);
			else console.error(msg);
		});
	}

	function initializeTable(){
		if(options.websql){ // WebSQL
			if(window.sqlitePlugin){
				scope.db = window.sqlitePlugin.openDatabase({name: databaseName, location: 'default'});

				// Initialize sqlitePlugin
				databaseTest(function(error){
					console.error("Failed to initialize sqlitePlugin");
					window.sqlitePlugin = false;
					if(initError) initError();
				});
			}
			else if(window.openDatabase){
				scope.db = window.openDatabase(databaseName, "1.0", databaseName, 1024);
				databaseTest(function(error){
					console.error("Failed to initialize WebSQL");
					window.openDatabase = false;
					options.websql = false;
					if(initError) initError();
				});
			}
			else if(initError) initError();
		}
		else{
			console.error('WebSQL is not supported on this browser');
			if(initError) initError();
		}
	}

	initializeTable();
}