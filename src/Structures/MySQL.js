if(isNode && options.mysql === undefined) options.mysql = true;
if(options.mysql){
	MySQLStructure();
}

function MySQLStructure(initError){
	SQLQueryBuilder();

	var mysql = require('mysql');
	scope.db = mysql.createPool({
		host:options.host?options.host:'localhost',
		user:options.user?options.user:'root',
		password:options.password?options.password:'',
		database:databaseName
	});

	if(onConnected) scope.db.on('connection', initFinish);
	if(!options.hideInitialization)
		console.log("Connecting to "+databaseName+" database");

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

		scope.db.getConnection(function(err1, connection){
	        if(err1){
	            connection.release();
	            if(errorCallback) errorCallback(err1);
	            else console.error(err1);
	            return;
	        }

	        connection.query(query, values, function(err, rows){
	            connection.release();
	            destroyObject(values);
	            values = null;
	            query = null;

	            if(!err&&successCallback) setTimeout(function(){
	            	successCallback(rows);
	            }, 0);
	            else if(err) setTimeout(function(){
	            	var error = {msg:err.sqlMessage, query:err.sql, code:err.code};
		            if(errorCallback) errorCallback(error);
		            else console.error(error);
	            }, 0);
	        });
	    });
	}
}