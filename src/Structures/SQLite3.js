if(options.sqlite3) SQLite3Structure();

async function SQLite3Structure(initError){
	SQLQueryBuilder();

	My.db = options.sqlite3;
	if(!options.hideInitialization)
		console.log("Using SQLite database");

	My._isSQLite = true;

	My.SQLQuery = function(query, values, isSelect){
		return new Promise(function(resolve, reject){
			if(options.debug) options.debug(query, values);

			if(isSelect){
				My.db.all(query, values, function(err, rows){
					if(err && My.onError) My.onError(err);
					if(!err) resolve(rows);
					else reject({msg: err.message, query, code:err.code});
				});
				return;
			}

			My.db.run(query, values, function(err, rows){
				if(err && My.onError) My.onError(err);
				if(!err) resolve(rows);
				else reject({msg: err.message, query, code:err.code});
			});
		});
	}

	// Init structure if exist
	checkStructure(async () => {
		await My.SQLQuery('select 1', []);
		initFinish();
	});
}