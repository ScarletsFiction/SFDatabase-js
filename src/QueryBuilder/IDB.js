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

				for (var a = 0; a < rule_.length; a++) {
					var temp = rule_[a];
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

	var dbStructure = options.structure;

	var regexEscape = /[-\/\\^$*+?.()|[\]{}]/g;
	var validateText = function(text){
		if(typeof text !== 'string') return text;
		var matches = text.match(/[a-zA-Z0-9_\.]+/);
		return matches[0]||'';
	}

	var IDBLimit = function(query){
		query.found++;
		query.processed++;

		if(query.found > query.startFrom){
			if(query.processed <= query.limit)
				return 1; // Continue
			else
				return -1; // End
		}

		return 0;
	}

	function findIndexRange(tableName, where, index){
		var db = dbStructure[tableName];
		var objectStore = void 0;
		var range = null;

		if(index.constructor !== String){
			objectStore = index;
			index = void 0;
		}

		if(db){
			var keys = Object.keys(where);
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i].split('[');
				if(db[key[0]] !== void 0 && (index === void 0 || (index !== void 0 && key[0] === index))){
					range = rangeBuilder(key, where[keys[i]]);
					break;
				}
			}
		}

		if(objectStore !== void 0){
			if(range !== null)
				return objectStore.index(key).openCursor(range);
			return objectStore.openCursor();
		}

		return range;
	}

	var prepareQuery = function(tableName, action, where, errorCallback){
		var objectStore = scope.getObjectStore(tableName, action, function(e){
  			(errorCallback || console.error)(tableName, e.target ? e.target.error : e);
		});

		var obj = {
			found:0, // For limiting
			processed:0 // For limiting
		};

		if(!objectStore) return;

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
		delete where.LIMIT;

		if(where.ORDER !== undefined){
			var order = where.ORDER;
			delete where.ORDER;

			var range = null;

			if(typeof order === 'string'){ // ASC
				if(dbStructure[tableName] !== void 0 || dbStructure[tableName][order] !== void 0)
					var range = findIndexRange(tableName, where, order);

				obj.request = objectStore.index(order).openCursor(range, 'next');
			}
			else {
				var key = Object.keys(order)[0];
				if(dbStructure[tableName] !== void 0 || dbStructure[tableName][key] !== void 0)
					var range = findIndexRange(tableName, where, key);

				if(order[key] === 'ASC')
					obj.request = objectStore.index(key).openCursor(range, 'next');

				if(order[key] === 'DESC')
					obj.request = objectStore.index(key).openCursor(range, 'prev');
			}
		}

		// Not ordered
		else obj.request = findIndexRange(tableName, where, objectStore);

		return obj;
	}

	/*
		columns
		{columnName:(
			text, number
		)}
	*/
	scope.createTable = function(tableName, columns, successCallback, errorCallback){
		if(onStructureInitialize === null)
			return console.warn("`createTable` is unavailable because the database version need to be changed. Try changing the database structure on first initialization, and increment the version.");

		if(scope.db.objectStoreNames.contains(tableName)){
			if(successCallback) successCallback(scope);
			return;
		}

		var columns_ = Object.keys(columns);
		try{
			var objectStore = scope.db.createObjectStore(tableName, {keyPath:'rowid', autoIncrement:true});
			for(var i = 0; i < columns_.length; i++){
				if(columns_[i][0] !== '$')
					continue;

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
  			if(!duplicated)
  				(errorCallback || console.error)(tableName, 'table was not found');
  		});
  		if(!objectStore) return;

  		var objectStoreRequest = objectStore.add(object);

	  	objectStoreRequest.onerror = function(){
	  		duplicated = true;
	  		(errorCallback || console.error)('duplicate on unique columns');
	  	};

  		if(successCallback)
	  		objectStoreRequest.onsuccess = function(ev){
	  			successCallback(ev.target.result);
	  		};
	}

	scope.has = function(tableName, where, successCallback, errorCallback){
  		var query = prepareQuery(tableName, "readonly", where, errorCallback);
  		if(!query) return;
  		var request = query.request;

		request.onerror = errorCallback;
		request.onsuccess = function(){
      		var cursor = request.result;
        	if(cursor){
      			if(IDBWhere(cursor.value, where)){
		      		successCallback(true);
		      		return;
      			}
		    	cursor.continue();
		    }

		    // End of rows
		    else if(successCallback) successCallback(false);
		};
	}

	function rangeBuilder(opt, val){
		if(val.constructor === String){
			if(val.length === 0)
				return null;

			val = val[0];
		}

		if(val.constructor === Array && val[0].constructor === String)
			val = [val[0], val[1]];

		if(opt.length === 2){
			opt = opt[1];

			if(opt === '>]')
				return IDBKeyRange.upperBound(val);
			if(opt === '>=]')
				return IDBKeyRange.upperBound(val, true);
			if(opt === '<]')
				return IDBKeyRange.lowerBound(val);
			if(opt === '<=]')
				return IDBKeyRange.lowerBound(val, true);
			if(opt === '><]')
				return IDBKeyRange.bound(val[0], val[1]);
			if(opt === '>=<]')
				return IDBKeyRange.bound(val[0], val[1], true);
		}
		return IDBKeyRange.only(val);
	}

	scope.cursor = function(tableName, where, onScanning){
  		var objectStore = scope.getObjectStore(tableName, where && where.write ? "readwrite" : "readonly", console.error);
  		if(!objectStore) return;

		if(where){
			var direction = where.ORDER === 'desc' ? 'prev' : 'next';
			if(where.UNIQUE)
				direction += 'unique';

			delete where.ORDER;
			delete where.UNIQUE;

			var keys = Object.keys(where)[0];

			var range = null;
			if(keys){
				var opt = keys.split('[');
				objectStore = objectStore.index(opt[0]);
				var val = where[opt];
				range = rangeBuilder(opt, val);
			}

			var req = objectStore.openCursor(range, direction);
		}
  		else var req = objectStore.openCursor();

  		req.onerror = console.error;
  		req.onsuccess = onScanning;
  		return req;
	}

	scope.get = function(tableName, select, where, successCallback, errorCallback){
  		var query = prepareQuery(tableName, "readonly", where, errorCallback);
  		if(!query) return;

  		var request = query.request;
		request.onerror = errorCallback;
		request.onsuccess = function(){
      		var cursor = request.result;
        	if(cursor){
      			var value = cursor.value;
      			if(IDBWhere(value, where)){
		  			if(select === '*'){
		      			successCallback(value);
		  				return;
		  			}

      				if(select.constructor === String){
      					successCallback(value[select]);
      					return;
      				}

		      		var temp = {};
		      		for (var i = 0; i < select.length; i++) {
		      			temp[select[i]] = value[select[i]];
		      		}

		      		successCallback(temp);
		      		return;
      			}
		    	cursor.continue();
		    }

		    // End of rows
		    else if(successCallback) successCallback(null);
		};
	}

	scope.select = function(tableName, select, where, successCallback, errorCallback){
  		var query = prepareQuery(tableName, "readonly", where, errorCallback);
  		if(!query) return;

  		var request = query.request;
		request.onerror = errorCallback;
		query.result = []; // Will be returned from success callback

  		var operation = function(value){
  			if(select === '*'){
      			query.result.push(value);
  				return;
  			}

      		var temp = {};
      		for (var i = 0; i < select.length; i++) {
      			temp[select[i]] = value[select[i]];
      		}
      		query.result.push(temp);
  		}

		request.onsuccess = function(){
      		var cursor = request.result;
        	if(cursor){
      			var value = cursor.value;
      			if(IDBWhere(value, where)){
      				if(query.limit !== false){
      					var code = IDBLimit(query);

      					if(code === -1){
      						if(successCallback) successCallback(query.result);
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
		    else if(successCallback) successCallback(query.result);
		};
	}

	scope.delete = function(tableName, where, successCallback, errorCallback){
		if(!where){
			var store = scope.getObjectStore(tableName, "readwrite", errorCallback);
			store.onsuccess = successCallback;
			return store.clear();
		}

  		var query = prepareQuery(tableName, "readwrite", where, errorCallback);
  		if(!query) return;

  		var request = query.request;
		request.onerror = errorCallback;
		request.onsuccess = function(){
      		var cursor = request.result;
        	if(cursor){
      			var value = cursor.value;
      			if(IDBWhere(value, where)){
      				if(query.limit !== false){
      					var code = IDBLimit(query);
      					
      					if(code === -1){
      						if(successCallback) successCallback(query.processed);
      						return;
      					}
      					else if(code === 1)
      						cursor.delete(); // Delete data
      				}

      				else {
      					query.processed++;
      					cursor.delete();
      				}
      			}
		    	cursor.continue();
		    }

		    // End of rows
		    else if(successCallback) successCallback(query.processed);
		};
	}

	scope.update = function(tableName, object, where, successCallback, errorCallback){
  		var query = prepareQuery(tableName, "readwrite", where, errorCallback);
  		if(!query) return;

  		var request = query.request;
		request.onerror = errorCallback;

		var columns = Object.keys(object);
		var operation = function(cursor, value){
      		for (var i = 0; i < columns.length; i++) {
      			value[columns[i]] = object[columns[i]];
      		}
      		cursor.update(value);
		}

		request.onsuccess = function(){
      		var cursor = request.result;
        	if(cursor){
      			var value = cursor.value;
      			if(IDBWhere(value, where)){
      				if(query.limit !== false){
      					var code = IDBLimit(query);
      					
      					if(code === -1){
      						if(successCallback) successCallback(query.processed);
      						return;
      					}
      					else if(code === 1)
      						operation(cursor, value); // Update data
      				}

      				else {
      					query.processed++;
      					operation(cursor, value);
      				}
      			}
		    	cursor.continue();
		    }

		    // End of rows
		    else if(successCallback) successCallback(query.processed);
		};
	}

	scope.drop = function(tableName, successCallback, errorCallback){
		if(onStructureInitialize === null)
			return console.warn("`drop` is unavailable because the database version need to be changed. Try changing the database structure on first initialization, and increment the version.");

		scope.db.deleteObjectStore(tableName);
	}

	scope.closeDatabase = function(){
		scope.db.close();
	}
}