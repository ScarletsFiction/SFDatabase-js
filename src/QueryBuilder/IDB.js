function IDBQueryBuilder(){
	// Optimize with https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange
	// As a query when opening cursor https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/openCursor
	var IDBWhere = function(data, rules, ORCondition){
		var currentCondition = ORCondition ? false : true;
		var rules_ = Object.keys(rules);
		for (var i = 0; i < rules_.length; i++){ // All operation here are focus on performance
			var matches = rules_[i].match(/([a-zA-Z0-9_\.]+)(\[(\>\=?|\<\=?|\!|\<\>|\>\<|\!?~)\])?/);
			var check = matches[1].toLowerCase();
			if(check === 'AND' || check === 'OR') continue;
			var rule = rules[rules_[i]];

			var operationCondition = true;

			// Recurse again
			if(matches[1] === 'AND'){
				operationCondition = IDBWhere(data, rules[rules_[i]], false);
			}

			// Recurse again
			else if(matches[1] === 'OR'){
				operationCondition = IDBWhere(data, rules[rules_[i]], true);
			}

			else if(matches[3] === undefined){ // Equal to
				if(rule instanceof Array){
					if(rule.indexOf(data[matches[1]]) === -1)
						operationCondition = false; // When nothing match
				}
				else if(data[matches[1]] != rule)
					operationCondition = false; // When "not equal to"
			}

			else if(matches[3] === '!'){ // Not equal to
				if(rule instanceof Array){
					if(rule.indexOf(data[matches[1]]) !== -1)
					operationCondition = false; // When something match
				}
				else if(data[matches[1]] == rule)
					operationCondition = false; // When "equal to"
			}

			else if(matches[3] === '>'){ // Greater than
				if(data[matches[1]] <= rule)
					operationCondition = false; // When "lower or equal to"
			}

			else if(matches[3] === '>='){ // Greater or equal
				if(data[matches[1]] < rule)
					operationCondition = false; // When "lower than"
			}

			else if(matches[3] === '<'){ // Lower than
				if(data[matches[1]] >= rule)
					operationCondition = false; // When "more than or equal"
			}

			else if(matches[3] === '<='){ // Lower or equal
				if(data[matches[1]] > rule)
					operationCondition = false; // When "more than"
			}

			else if(matches[3] === '><'){ // Between 2 value
				if(data[matches[1]] <= rule[0] || data[matches[1]] >= rule[1])
					operationCondition = false; // When "not between 2 value or equal"
			}

			else if(matches[3] === '=><='){ // Between 2 value
				if(data[matches[1]] < rule[0] || data[matches[1]] > rule[1])
					operationCondition = false; // When "not between 2 value"
			}

			else if(matches[3] === '<>'){ // Not between than 2  value
				if(data[matches[1]] >= rule[0] || data[matches[1]] <= rule[1])
					operationCondition = false; // When "between 2 value or equal"
			}

			else if(matches[3] === '<=>'){ // Not between than 2  value
				if(data[matches[1]] > rule[0] || data[matches[1]] < rule[1])
					operationCondition = false; // When "between 2 value"
			}

			else if(matches[3].indexOf('~') !== -1){ // Data likes
				var likeCode = 1; // 1 = %value%, 2 = %value, 3 = value%
				var regexed = [];
				var rule_ = rule instanceof Array ? rule : [rule];

				for (var i = 0; i < rule_.length; i++) {
					var temp = rule_[i];
					if(temp[0] === '%' && temp.slice(-1) === '%'){
						likeCode = 1;
						temp = temp.slice(1, -1);
					}

					else if(temp[0] === '%'){
						likeCode = 2;
						temp = temp.slice(1);
					}

					else if(temp.slice(-1) === '%'){
						likeCode = 3;
						temp = temp.slice(0, -1);
					}

					temp = temp.replace(regexEscape, '\\$&');

					if(likeCode === 2)
						temp = temp+'$';

					else if(likeCode === 3)
						temp = '^'+temp;

					regexed.push(temp);
				}

				var exist = data[matches[1]].match(RegExp(regexed.join('|'), 'i'));

				if(matches[3].indexOf('!') !== -1){ // Data not like
					if(exist) operationCondition = false; // When "have match"
				}

				else if(!exist){ // Data like
					operationCondition = false; // When "not match"
				}
			}

			if(ORCondition){ // OR
				currentCondition = currentCondition || operationCondition;
			}

			else if(!operationCondition){ // AND
				currentCondition = false;
				break;
			}
		}
		return currentCondition;
	}

	var regexEscape = /[-\/\\^$*+?.()|[\]{}]/g;
	var validateText = function(text){
		if(typeof text !== 'string') return text;
		var matches = text.match(/[a-zA-Z0-9_\.]+/);
		return matches[0]||'';
	}

	var IDBLimit = function(query){
		query.found++;
		query.processed++;

		if(query.found >= query.startFrom){
			if(query.processed <= query.limit)
				return 1; // Continue
			else
				return -1; // End
		}

		return 0;
	}

	var prepareQuery = function(objectStore, where){
		var obj = {
			found:0, // For limiting
			processed:0 // For limiting
		};

		if(where.LIMIT !== undefined){
			if(typeof where.LIMIT === 'number'){
				obj.startFrom = 0;
				obj.limit = where.LIMIT;
			}
			else{
				obj.startFrom = where.LIMIT[0];
				obj.limit = where.LIMIT[1];
			}
		}
		else obj.limit = false;

		if(where.ORDER !== undefined){
			if(typeof where.ORDER === 'string') // ASC
				obj.cursor = objectStore.index(where.ORDER).openCursor(null, 'next');
			else {
				for(var key in where.ORDER){
					if(where.ORDER[key] === 'ASC')
						obj.cursor = objectStore.index(key).openCursor(null, 'next');

					if(where.ORDER[key] === 'DESC')
						obj.cursor = objectStore.index(key).openCursor(null, 'prev');
					break;
				}
			}
		}

		// Not ordered
		else obj.cursor = objectStore.openCursor();

		delete where.LIMIT;
		delete where.ORDER;
		
		return obj;
	}

	/*
		columns
		{columnName:(
			text, number
		)}
	*/
	scope.createTable = function(tableName, columns, successCallback, errorCallback){
		if(scope.db.objectStoreNames.contains(tableName))
			return successCallback(scope);

		var columns_ = Object.keys(columns);
		try{
			var objectStore = scope.db.createObjectStore(tableName, {keyPath:'rowid', autoIncrement:true});
			for(var i = 0; i < columns_.length; i++){
				var col = validateText(columns_[i]);
				if(columns[columns_[i]] instanceof Array && columns[columns_[i]].length >= 2)
					objectStore.createIndex(col, col, {unique: columns[columns_[i]][1] === 'unique'});
				else
					objectStore.createIndex(col, col, {unique: false});
			}
			if(successCallback)
				successCallback(scope);
		} catch(e) {
			if(errorCallback)
				errorCallback(e);
		}
	}

	scope.insert = function(tableName, object, successCallback, errorCallback){
		var duplicated = false;
  		var objectStore = scope.getObjectStore(tableName, "readwrite", function(){
  			if(!duplicated && errorCallback)
  				errorCallback('table not found');
  		});
  		var objectStoreRequest = objectStore.add(object);

  		if(errorCallback)
	  		objectStoreRequest.onerror = function(){
	  			duplicated = true;
	  			errorCallback('duplicate on unique columns');
	  		};
  		if(successCallback)
	  		objectStoreRequest.onsuccess = function(ev){
	  			successCallback(ev.target.result);
	  		};
	}

	scope.select = function(tableName, select, where, successCallback, errorCallback){
  		var objectStore = scope.getObjectStore(tableName, "readonly", errorCallback);
  		var query = prepareQuery(objectStore, where);
		query.cursor.onerror = errorCallback;
		query.result = []; // Will be returned from success callback

  		var operation = function(value){
      		var temp = {};
      		for (var i = 0; i < select.length; i++) {
      			temp[select[i]] = value[select[i]];
      		}
      		query.result.push(temp);
  		}

		query.cursor.onsuccess = function(event){
      		var cursor = event.target.result;
        	if(cursor){
      			var value = cursor.value;
      			if(IDBWhere(value, where)){
      				if(query.limit !== false){
      					var code = IDBLimit(query);

      					if(code === -1){
      						operation(value); // Get last data
      						successCallback(query.result);
      						return;
      					}
      					else if(code === 1)
      						operation(value); // Get data
      				}

      				else operation(value);
      			}
		    	cursor.continue();
		    }

		    // End of rows
		    else successCallback(query.result);
		};
	}

	scope.delete = function(tableName, where, successCallback, errorCallback){
  		var objectStore = scope.getObjectStore(tableName, "readwrite", errorCallback);
  		var query = prepareQuery(objectStore, where);
		query.cursor.onerror = errorCallback;

		query.cursor.onsuccess = function(event){
      		var cursor = event.target.result;
        	if(cursor){
      			var value = cursor.value;
      			if(IDBWhere(value, where)){
      				if(query.limit !== false){
      					var code = IDBLimit(query);
      					
      					if(code === -1){
      						cursor.delete(); // Delete last data
      						successCallback(query.processed);
      						return;
      					}
      					else if(code === 1)
      						cursor.delete(); // Delete data
      				}

      				else cursor.delete();
      			}
		    	cursor.continue();
		    }

		    // End of rows
		    else successCallback(query.processed);
		};
	}

	scope.update = function(tableName, object, where, successCallback, errorCallback){
  		var objectStore = scope.getObjectStore(tableName, "readwrite", errorCallback);
  		var query = prepareQuery(objectStore, where);
		openCursor.onerror = errorCallback;

		var columns = Object.keys(object);
		var operation = function(cursor, value){
      		for (var i = 0; i < columns.length; i++) {
      			value[columns[i]] = object[columns[i]];
      		}
      		cursor.update(value);
		}

		openCursor.onsuccess = function(event){
      		var cursor = event.target.result;
        	if(cursor){
      			var value = cursor.value;
      			if(IDBWhere(value, where)){
      				if(query.limit !== false){
      					var code = IDBLimit(query);
      					
      					if(code === -1){
      						operation(cursor, value); // Update last data
      						successCallback(query.processed);
      						return;
      					}
      					else if(code === 1)
      						operation(cursor, value); // Update data
      				}

      				else operation(cursor, value);
      			}
		    	cursor.continue();
		    }

		    // End of rows
		    else successCallback(query.processed);
		};
	}

	scope.drop = function(tableName, successCallback, errorCallback){
		scope.closeDatabase();
		onStructureInitialize = function(){
			try{
				scope.db.deleteObjectStore(tableName);
			}catch(e){}
		}
		scope.initializeTable(successCallback, errorCallback);
	}

	scope.closeDatabase = function(){
		scope.db.close();
	}
}