function SQLQueryBuilder(){
	// structure must have `My.SQLQuery`

	function validateText(text){
		var matches = text.match(/[a-zA-Z0-9_\.]+/i);
		return '`'+matches[0]+'`';
	}

	function copyObject(obj){
		let temp = {};
		deepCopy(temp, obj);
		return temp;
	}

	function deepCopy(target, source){
		for(var key in source){
			if(typeof source[key] === 'object'){
				if(source[key] instanceof Array)
					target[key] = [];
				else
					target[key] = {};

				deepCopy(target[key], source[key]);
				continue;
			}

			target[key] = source[key];
		}
	}

	//{('AND', 'OR'), 'ORDER':{columnName:'ASC', 'DESC'}, 'LIMIT':[startIndex, rowsLimit]}

	// ex: ["AND"=>["id"=>12, "OR"=>["name#1"=>"myself", "name"=>"himself"]], "LIMIT"=>1]
		// Select one where (id == 12 && (name == "myself" || name == "himself"))
	My.makeWhere = function(object, comparator, children){
		if(!object) return ['', []];
		var wheres = [];

		var objectData = [];
		var columns = Object.keys(object);
		var defaultConditional = ' AND ';
		var specialList = ['order', 'limit'];

		for(var i = 0; i < columns.length; i++){
			let key = columns[i];
			var value = object[key];

			var matches = key.match(/([a-zA-Z0-9_\.]+)(\[(\>\=?|\<\=?|\!|\<\>|\>\<|\!?~)\])?/);
			var check = matches[1].toLowerCase();
			if(check === 'and' || check === 'or') continue;
			if(!children && specialList.includes(check)) continue;

			if(matches[3]){
				if((['>', '>=', '<', '<=']).includes(matches[3])) {
					if(!isNaN(value)) {
						wheres.push(matches[1] + ' ' + matches[3] + ' ?');
						objectData.push(value);
						continue;
					}
					else {
						var msg = 'SQL where: value of ' + matches[1] + ' is non-numeric and can\'t be accepted';
						console.error(msg);
					}
				}
				else if(matches[3] === '!') {
					var type = value === null || value === undefined ? false : value.constructor;
					if(!type)
						wheres.push(matches[1] + ' IS NOT NULL');
					else {
						if(type === Array){
							var temp = [];
							for (var a = 0; a < value.length; a++) {
								temp.push('?');
							}
							wheres.push(matches[1] + ' NOT IN ('+ temp.join(',') +')');
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
				else if(matches[3] === '~' || matches[3] === '!~') {
					if(value.constructor !== Array){
						value = [value];
					}

					var likes = [];
					for (var a = 0; a < value.length; a++) {
						likes.push(matches[1] + (matches[3] === '!~' ? ' NOT' : '') + ' LIKE ?');
						if(value[a].includes('%') === false) value[a] = '%'+value[a]+'%';
						objectData.push(value[a]);
					}

                    wheres.push('('+likes.join(' OR ')+')');
				}
			}
			else {
				var type = value === null || value === undefined ? false : value.constructor;
				if(!type)
					wheres.push(matches[1] + ' IS NULL');
				else{
					if(type === Array){
						var temp = [];
						for (var a = 0; a < value.length; a++) {
							temp.push('?');
						}
						wheres.push(matches[1] + ' IN ('+ temp.join(',') +')');
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

		for(var i = 0; i < columns.length; i++) {
			let key = columns[i];
			if(key === 'ORDER' || key === 'LIMIT')
                continue;

			var test = key.split('AND');
			var haveRelation = false;
			if(test.length === 2 && test[0] === ''){
				defaultConditional = ' AND ';
				haveRelation = true;
			}
			else{
				test = key.split('OR');
				if(test.length === 2 && test[0] === ''){
					defaultConditional = ' OR ';
					haveRelation = true;
				}
			}
			if(haveRelation){
				var childs = My.makeWhere(object[key], defaultConditional, true);
				wheres.push('('+childs[0]+')');
				objectData = objectData.concat(childs[1]);
			}
		}

		var options = '';
		if(object.ORDER){
			let columns = object.ORDER;
			var stack = [];

			for (let column in columns) {
				var order = object.ORDER[columns].toUpperCase();
				if(order !== 'ASC' && order !== 'DESC') continue;
				stack.push(validateText(columns) + ' ' + order);
			}

			options = options + ' ORDER BY ' + stack.join(',');
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
			if(!children) where_ = " WHERE ";
			where_ = where_ + wheres.join(comparator ? comparator : defaultConditional);
		}

		return [where_ + options, objectData];
	}

	My.createTable = async function(tableName, columns){
		var columns_ = Object.keys(columns);
		for(var i = 0; i < columns_.length; i++){
			if(columns[columns_[i]].constructor === Array)
				columns_[i] = validateText(columns_[i]) + ' ' + columns[columns_[i]].join(' ').toUpperCase();
			else
				columns_[i] = validateText(columns_[i]) + ' ' + String(columns[columns_[i]]).toUpperCase();
		}
		var query = 'CREATE TABLE IF NOT EXISTS '+validateText(tableName)+' ('+columns_.join(',')+')';

		return await My.SQLQuery(query, []);
	}

	// Select separated by comma
	My.select = async function(tableName, select, where){
		var select_ = select;

		if(select !== '*'){
			if(select.constructor === String)
				select_ = [select];

			for(var i = 0; i < select_.length; i++){
				select_[i] = validateText(select_[i]);
			}
		}
		else select_ = false;

		var wheres = My.makeWhere(where);
		var query = "SELECT " + (select_ ? select_.join(',') : select) + " FROM " + validateText(tableName) + wheres[0];

		let data = await My.SQLQuery(query, wheres[1]);
		if(data.length !== 0 && preprocessData(tableName, 'get', data[0])){
			for (var i = 1; i < data.length; i++) {
				preprocessData(tableName, 'get', data[i]);
			}
		}

		return data;
	}

	My.has = async function(tableName, where){
		where.LIMIT = 1;
		var wheres = My.makeWhere(where);
		var query = "SELECT 1 FROM " + validateText(tableName) + wheres[0];

		let data = await My.SQLQuery(query, wheres[1]);
		return data.length !== 0;
	}

	My.get = async function(tableName, select, where){
		where.LIMIT = 1;
		let rows = await My.select(tableName, select, where);

		if(rows.length === 0)
			return null;
		else if(select.constructor === Array)
			return rows[0];
		else return rows[0][select];
	}

	My.delete = async function(tableName, where){
		if(where){
			var wheres = My.makeWhere(where);
			var query = "DELETE FROM " + validateText(tableName) + wheres[0];
			return await My.SQLQuery(query, wheres[1]);
		}
		else{
			var query = "TRUNCATE TABLE " + validateText(tableName);
			try {
				let result = await My.SQLQuery(query, []);
				return result;
			} catch(e) {
				if(e.message.includes('syntax error')) // WebSQL may not support truncate function
				My.delete(tableName, []);
			}
		}
	}

	My.insert = async function(tableName, object){
		var objectName = [];
		var objectName_ = [];
		var objectData = [];
		var object_ = copyObject(object); // Object copy before preprocessData

		preprocessData(tableName, 'set', object_);

		for (let key in object) {
			objectName.push(validateText(key));
			objectName_.push('?');
			objectData.push(object_[key]);
		}

		var query = "INSERT INTO " + validateText(tableName) + " (" + objectName.join(',') + ") VALUES (" + objectName_.join(',') + ")";
		return await My.SQLQuery(query, objectData);
	}

	My.update = async function(tableName, object, where){
		var wheres = My.makeWhere(where);
		var objectName = [];
		var objectData = [];
		var object_ = copyObject(object); // Object copy before preprocessData
		preprocessData(tableName, 'set', object_);

		for (let key in object) {
			objectName.push(validateText(key)+' = ?');
			objectData.push(object_[key]);
		}

		var query = "UPDATE " + validateText(tableName) + " SET " + objectName.join(',') + wheres[0];
		return await My.SQLQuery(query, objectData.concat(wheres[1]));
	}

	My.drop = async function(tableName){
		return await My.SQLQuery("DROP TABLE "+validateText(tableName), []);
	}

	My.closeDatabase = function(){
		if(My.polyfill) return;
		return new Promise(function(resolve, reject){
			My.db.close(resolve, function(error){
				reject("Error closing Database:" + error.message);
			});
		});
	}
}