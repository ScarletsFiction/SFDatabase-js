if(options.mysql) MySQLStructure();

function MySQLStructure(initError){
	SQLQueryBuilder();

	var mysql = require('mysql');
	My.db = mysql.createPool({
		host:options.host?options.host:'localhost',
		user:options.user?options.user:'root',
		password:options.password?options.password:'',
		database:databaseName
	});

	if(onConnected) My.db.on('connection', initFinish);
	if(!options.hideInitialization)
		console.log("Connecting to "+databaseName+" database");

	My.SQLQuery = function(query, values){
		return new Promise(function(resolve, reject){
			if(options.debug) options.debug(query, values);

			My.db.getConnection(function(err1, connection){
				if(err1) return reject(err1);

				connection.query(query, values, function(err, rows){
					connection.release();
					destroyObject(values);

					setTimeout(function(){ 
						if(!err) resolve(rows);
						else reject({msg: err.sqlMessage, query: err.sql, code:err.code});
					}, 0);
				});
			});
		});
	}

	// Test connection
	setTimeout(() => { My.SQLQuery('select 1', []) }, 1000);
}