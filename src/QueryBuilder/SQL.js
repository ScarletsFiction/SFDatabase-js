function SQLQueryBuilder(){
	// structure must have `scope.SQLQuery`

	function validateText(text){
		var matches = text.match(/[a-zA-Z0-9_\.]+/i);
		return '`'+matches[0]+'`';
	}

	//{('AND', 'OR'), 'ORDER':{columnName:'ASC', 'DESC'}, 'LIMIT':[startIndex, rowsLimit]}

	// ex: ["AND"=>["id"=>12, "OR"=>["name#1"=>"myself", "name"=>"himself"]], "LIMIT"=>1]
		// Select one where (id == 12 && (name == "myself" || name == "himself"))
	scope.makeWhere = function(object, comparator, children){
		if(!object) return ['', []];
		var wheres = [];

		var objectData = [];
		var columns = Object.keys(object);
		var defaultConditional = ' AND ';
		var specialList = ['order', 'limit'];

		for(var i = 0; i < columns.length; i++){
			var value = object[columns[i]];

			var matches = columns[i].match(/([a-zA-Z0-9_\.]+)(\[(\>\=?|\<\=?|\!|\<\>|\>\<|\!?~)\])?/);
			var check = matches[1].toLowerCase();
			if(check==='and' || check==='or') continue;
			if(!children && specialList.indexOf(check)!==-1) continue;

			if(matches[3]){
				if((['>', '>=', '<', '<=']).indexOf(matches[3])!==-1)
				{
					if(!isNaN(value))
					{
						wheres.push(matches[1] + ' ' + matches[3] + ' ?');
						objectData.push(value);
						continue;
					}
					else {
						var msg = 'SQL where: value of ' + matches[1] + ' is non-numeric and can\'t be accepted';
						console.error(msg);
					}
				}
				else if(matches[3] === '!')
				{
					var type = value === null || value === undefined ? false : value.constructor;
					if(!type)
						wheres.push(matches[1] + ' IS NOT NULL');
					else{
						if(type === Array){
							var temp = [];
							for (var a = 0; a < value.length; a++) {
								temp.push('?');
							}
							wheres.push(matches[1] + ' NOT IN ('+ temp.join(', ') +')');
							objectData = objectData.concat(value);
						}

						else if(type === Number || type === Boolean || type === String){
							wheres.push(matches[1] + ' != ?');
							objectData.push(value);
						}

						else
							console.error('SQL where: value ' + matches[1] + ' with type ' + type.name + ' can\'t be accepted');
					}
				}
				else if (matches[3] === '~' || matches[3] === '!~')
				{
					if(value.constructor !== Array){
						value = [value];
					}

					var likes = [];
					for (var a = 0; a < value.length; a++) {
						likes.push(matches[1] + (matches[3] === '!~' ? ' NOT' : '') + ' LIKE ?');
						if(value.indexOf('%') === -1) value[a] = '%'+value[a]+'%';
						objectData.push(value[a]);
					}

                    wheres.push('('+likes.join(' OR ')+')');
				}
			} else {
				var type = value === null || value === undefined ? false : value.constructor;
				if(!type)
					wheres.push(matches[1] + ' IS NULL');
				else{
					if(type === Array){
						var temp = [];
						for (var a = 0; a < value.length; a++) {
							temp.push('?');
						}
						wheres.push(matches[1] + ' IN ('+ temp.join(', ') +')');
						objectData = objectData.concat(value);
					}

					else if(type === Number || type === Boolean || type === String){
						wheres.push(matches[1] + ' = ?');
						objectData.push(value);
					}

					else console.error('SQL where: value ' + matches[1] + ' with type ' + type.name + ' can\'t be accepted');
				}
			}
		}

		for (var i = 0; i < columns.length; i++) {
			if(columns[i]==='ORDER'||columns[i]==='LIMIT')
                continue;

			var test = columns[i].split('AND');
			var haveRelation = false;
			if(test.length === 2 && test[0] === ''){
				defaultConditional = ' AND ';
				haveRelation = true;
			}
			else{
				test = columns[i].split('OR');
				if(test.length === 2 && test[0] === ''){
					defaultConditional = ' OR ';
					haveRelation = true;
				}
			}
			if(haveRelation){
				var childs = scope.makeWhere(object[columns[i]], defaultConditional, true);
				wheres.push('('+childs[0]+')');
				objectData = objectData.concat(childs[1]);
			}
		}

		var options = '';
		if(object.ORDER){
			var columns = Object.keys(object.ORDER);
			var stack = [];
			for(var i = 0; i < columns.length; i++){
				var order = object.ORDER[columns[i]].toUpperCase();
				if(order !== 'ASC' && order !== 'DESC') continue;
				stack.push(validateText(columns[i]) + ' ' + order);
			}
			options = options + ' ORDER BY ' + stack.join(', ');
		}
		if(object.LIMIT){
			if(!isNaN(object.LIMIT[0]) && !isNaN(object.LIMIT[1])){
				options = options + ' LIMIT ' + object.LIMIT[1] + ' OFFSET ' + object.LIMIT[0];
			}
			else if(!isNaN(object.LIMIT)){
				options = options + ' LIMIT '+ object.LIMIT;
			}
		}

		var where_ = '';
		if(wheres.length!==0){
			if(!children)
				where_ = " WHERE ";
			where_ = where_ + wheres.join(comparator ? comparator : defaultConditional);
		}

		return [where_ + options, objectData];
	}

	scope.createTable = function(tableName, columns, successCallback, errorCallback){
		var columns_ = Object.keys(columns);
		for(var i = 0; i < columns_.length; i++){
			if(columns[columns_[i]].constructor === Array)
				columns_[i] = validateText(columns_[i]) + ' ' + columns[columns_[i]].join(' ').toUpperCase();
			else
				columns_[i] = validateText(columns_[i]) + ' ' + String(columns[columns_[i]]).toUpperCase();
		}
		var query = 'CREATE TABLE IF NOT EXISTS '+validateText(tableName)+' ('+columns_.join(', ')+')';

		scope.SQLQuery(query, [], successCallback, errorCallback);
	}

	//Select separated by comma
	scope.select = function(tableName, select, where, successCallback, errorCallback){
		var select_ = select;

		if(select !== '*'){
			if(select.constructor === String)
				select_ = [select];

			for(var i = 0; i < select_.length; i++){
				select_[i] = validateText(select_[i]);
			}
		}
		else select_ = false;

		var wheres = scope.makeWhere(where);
		var query = "SELECT " + (select_?select_.join(', '):select) + " FROM " + validateText(tableName) + wheres[0];

		scope.SQLQuery(query, wheres[1], function(data){
			if(data.length !== 0 && preprocessData(tableName, 'get', data[0])){
				for (var i = 1; i < data.length; i++) {
					preprocessData(tableName, 'get', data[i]);
				}
			}
			successCallback(data);
		}, errorCallback);
	}

	scope.has = function(tableName, where, successCallback, errorCallback){
		where.LIMIT = 1;
		var wheres = scope.makeWhere(where);
		var query = "SELECT 1 FROM " + validateText(tableName) + wheres[0];

		scope.SQLQuery(query, wheres[1], function(data){
			if(data.length !== 0)
				return successCallback(true);
			successCallback(false);
		}, errorCallback);
	}

	scope.get = function(tableName, select, where, successCallback, errorCallback){
		where.LIMIT = 1;
		scope.select(tableName, select, where, function(rows){
			if(rows.length === 0)
				successCallback(null);
			else if(select.constructor === Array)
				successCallback(rows[0]);
			else successCallback(rows[0][select]);
		}, errorCallback);
	}

	scope.delete = function(tableName, where, successCallback, errorCallback){
		if(where){
			var wheres = scope.makeWhere(where);
			var query = "DELETE FROM " + validateText(tableName) + wheres[0];
			scope.SQLQuery(query, wheres[1], successCallback, errorCallback);
		}
		else{
			var query = "TRUNCATE TABLE " + validateText(tableName);
			scope.SQLQuery(query, [], successCallback, function(msg){
				if(msg.indexOf('syntax error') !== -1) // WebSQL may not support truncate function
					scope.delete(tableName, [], successCallback, errorCallback);
			});
		}
	}

	scope.insert = function(tableName, object, successCallback, errorCallback){
		var objectName = [];
		var objectName_ = [];
		var objectData = [];
		var object_ = JSON.parse(JSON.stringify(object)); // Object copy before preprocessData
		var columns = Object.keys(object_);
		preprocessData(tableName, 'set', object_);
		for(var i = 0; i < columns.length; i++){
			objectName.push(validateText(columns[i]));
			objectName_.push('?');

			objectData.push(object_[columns[i]]);
		}
		var query = "INSERT INTO " + validateText(tableName) + " (" + objectName.join(', ') + ") VALUES (" + objectName_.join(', ') + ")";

		scope.SQLQuery(query, objectData, successCallback, errorCallback);
	}

	scope.update = function(tableName, object, where, successCallback, errorCallback){
		var wheres = scope.makeWhere(where);
		var objectName = [];
		var objectData = [];
		var object_ = JSON.parse(JSON.stringify(object)); // Object copy before preprocessData
		var columns = Object.keys(object_);
		preprocessData(tableName, 'set', object_);
		for(var i = 0; i < columns.length; i++){
			objectName.push(validateText(columns[i])+' = ?');
			objectData.push(object_[columns[i]]);
		}
		var query = "UPDATE " + validateText(tableName) + " SET " + objectName.join(', ') + wheres[0];
		scope.SQLQuery(query, objectData.concat(wheres[1]), successCallback, errorCallback);
	}

	scope.drop = function(tableName, successCallback, errorCallback){
		scope.SQLQuery("DROP TABLE "+validateText(tableName), [], successCallback, errorCallback);
	}

	scope.closeDatabase = function(){
		if(scope.polyfill) return;
		scope.db.close(function(){
			// Success
		}, function(error){
			var msg = "Error closing Database:" + error.message;
			if(errorCallback) errorCallback(msg);
			else console.error(msg);
		});
	}
}