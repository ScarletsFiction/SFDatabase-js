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
				if(data[matches[1]] != rules[rules_[i]])
					operationCondition = false; // When "not equal to"
			}

			else if(matches[3] === '!'){ // Not equal to
				if(data[matches[1]] == rules[rules_[i]])
					operationCondition = false; // When "equal to"
			}

			else if(matches[3] === '>'){ // Greater than
				if(data[matches[1]] <= rules[rules_[i]])
					operationCondition = false; // When "lower or equal to"
			}

			else if(matches[3] === '>='){ // Greater or equal
				if(data[matches[1]] < rules[rules_[i]])
					operationCondition = false; // When "lower than"
			}

			else if(matches[3] === '<'){ // Lower than
				if(data[matches[1]] >= rules[rules_[i]])
					operationCondition = false; // When "more than or equal"
			}

			else if(matches[3] === '<='){ // Lower or equal
				if(data[matches[1]] > rules[rules_[i]])
					operationCondition = false; // When "more than"
			}

			else if(matches[3] === '><'){ // Between 2 value
				if(data[matches[1]] <= rules[rules_[i]][0] || data[matches[1]] >= rules[rules_[i]][1])
					operationCondition = false; // When "not between 2 value or equal"
			}

			else if(matches[3] === '=><='){ // Between 2 value
				if(data[matches[1]] < rules[rules_[i]][0] || data[matches[1]] > rules[rules_[i]][1])
					operationCondition = false; // When "not between 2 value"
			}

			else if(matches[3] === '<>'){ // Not between than 2  value
				if(data[matches[1]] >= rules[rules_[i]][0] || data[matches[1]] <= rules[rules_[i]][1])
					operationCondition = false; // When "between 2 value or equal"
			}

			else if(matches[3] === '<=>'){ // Not between than 2  value
				if(data[matches[1]] > rules[rules_[i]][0] || data[matches[1]] < rules[rules_[i]][1])
					operationCondition = false; // When "between 2 value"
			}

			else if(matches[3].indexOf('~') !== -1){ // Data likes
				var likeCode = 1; // 1 = %value%, 2 = %value, 3 = value%
				var regexed = rules[rules_[i]];
				if(rules[rules_[i]][0] === '%' && rules[rules_[i]].slice(-1) === '%'){
					likeCode = 1;
					regexed = regexed.slice(1, -1);
				}

				else if(rules[rules_[i]].slice(0,1) === '%'){
					likeCode = 2;
					regexed = regexed.slice(1);
				}

				else if(rules[rules_[i]].slice(-1) === '%'){
					likeCode = 3;
					regexed = regexed.slice(0, -1);
				}
				
				regexed = regexed.replace(regexEscape, '\\$&');

				if(likeCode === 2)
					regexed = regexed+'$';

				else if(likeCode === 3)
					regexed = '^'+regexed;

				regexed = RegExp(regexed, 'i');

	 			if(matches[3].indexOf('!') !== -1){ // Data not like
					if(!data[matches[1]].match(regexed)){
						operationCondition = false; // When "found match"
					}
				}

				else if(!data[matches[1]].match(regexed)){
					operationCondition = false; // When "not found match"
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

	// The data order need more performance optimization
	var IDBDataOrder = function(ref, rules_, checkOnly){
		if(checkOnly){
			if(rules_['ORDER'] || rules_['LIMIT'])
				return true;
			return false;
		}

		var rules = Object.keys(rules_);
		for (var i = 0; i < rules.length; i++) {
			if(rules[i]=='ORDER') { // {column:(ASC, DESC)}
				var column = Object.keys(rules_['ORDER']);
				for (var i = 0; i < column.length; i++) {
					ref.data.sort(sorterByKey(column[i], rules_['ORDER'][column[i]]=='DESC'));
				}
			}
			else if(rules[i]=='LIMIT') { // (int)limit or [startFrom, limit]
				if(typeof rules_['LIMIT'] === 'number'){
					ref.data = ref.data.splice(0, rules_['LIMIT']);
				} else {
					ref.data = ref.data.splice(rules_['LIMIT'][0], rules_['LIMIT'][1]);
				}
			}
		}
		delete rules_.LIMIT;
		delete rules_.ORDER;
		if(Object.keys(rules_).length!=0)
			for (var i = ref.data.length - 1; i >= 0; i--) {
				if(!IDBWhere(ref.data[i], rules_)){
					ref.data.splice(i, 1);
				}
			}
	}

	var regexEscape = /[-\/\\^$*+?.()|[\]{}]/g;
	var validateText = function(text){
		if(typeof text !== 'string') return text;
		var matches = text.match(/[a-zA-Z0-9_\.]+/);
		return matches[0]||'';
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
  		var openCursor = objectStore.openCursor();
  		var ordered = IDBDataOrder(null, where, true);
  		var filteredData = [];
  		var orderedData = {data:[]};
  		var operation = function(value){
      		var temp = {};
      		for (var i = 0; i < select.length; i++) {
      			temp[select[i]] = value[select[i]];
      		}
      		filteredData.push(temp);
  		}
		openCursor.onerror = errorCallback;

		openCursor.onsuccess = function(event){
      		var cursor = event.target.result;
        	if(cursor){
      			var value = cursor.value;
      			if(ordered){
      				orderedData.data.push(value);
      			}
      			else if(IDBWhere(value, where)){
      				operation(value);
      			}
		    	cursor.continue();
		    } else {
		    	if(ordered){
      				IDBDataOrder(orderedData, where, false);
      				for (var i = 0; i < orderedData.data.length; i++) {
      					operation(orderedData.data[i]);
      				}
      			}
		    	successCallback(filteredData);
		    }
		};
	}

	scope.delete = function(tableName, where, successCallback, errorCallback){
  		var objectStore = scope.getObjectStore(tableName, "readwrite", errorCallback);
  		var openCursor = objectStore.openCursor();
  		var processed = 0;
  		var ordered = IDBDataOrder(null, where, true);
  		var orderedData = {data:[]};
		openCursor.onerror = errorCallback;

		openCursor.onsuccess = function(event){
      		var cursor = event.target.result;
        	if(cursor){
      			var value = cursor.value;
      			if(ordered){
      				orderedData.data.push(value);
      			}
      			else if(IDBWhere(value, where)){
      				processed++;
      				cursor.delete();
      			}
		    	cursor.continue();
		    }
		    else {
		    	if(ordered){
      				IDBDataOrder(orderedData, where, false);
      				for (var i = 0; i < orderedData.data.length; i++){
      					objectStore.delete(orderedData.data[i][objectStore.keyPath]);
      				}
      				if(successCallback)
      					successCallback(orderedData.data.length);
      			}
		    	else if(successCallback) successCallback(processed);
		    }
		};
	}

	scope.update = function(tableName, object, where, successCallback, errorCallback){
		var columns = Object.keys(object);
  		var objectStore = scope.getObjectStore(tableName, "readwrite", errorCallback);
  		var openCursor = objectStore.openCursor();
  		var processed = 0;
  		var ordered = IDBDataOrder(null, where, true);
  		var orderedData = {data:[]};
		openCursor.onerror = errorCallback;
		var operation = function(value){
      		for (var i = 0; i < columns.length; i++) {
      			value[columns[i]] = object[columns[i]];
      		}
      		processed++;
		}

		openCursor.onsuccess = function(event){
      		var cursor = event.target.result;
        	if(cursor){
      			var value = cursor.value;
      			if(ordered){
      				orderedData.data.push(value);
      			}
      			else if(IDBWhere(value, where)){
      				operation(value);
      				cursor.update(value);
      			}
		    	cursor.continue();
		    }
		    else {
		    	if(ordered){
      				IDBDataOrder(orderedData, where, false);
      				for (var i = 0; i < orderedData.data.length; i++) {
      					operation(orderedData.data[i]);
      					objectStore.put(orderedData.data[i]);
      				}
      			}

      			if(successCallback)
		        	successCallback(processed);
		    }
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