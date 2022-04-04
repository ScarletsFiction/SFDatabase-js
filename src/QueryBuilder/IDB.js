function IDBQueryBuilder(){
	// Optimize with https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange
	// As a query when opening cursor https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/openCursor
	var IDBWhere = function(data, rules, ORCondition){
		var currentCondition = ORCondition ? false : true;
		for (let key in rules) { // All operation here are focus on performance
			var matches = key.match(/([a-zA-Z0-9_\.]+)(\[(\>\=?|\<\=?|\!|\<\>|\>\<|\!?~)\])?/);
			var check = matches[1].toLowerCase();
			if(check === 'AND' || check === 'OR') continue;

			var rule = rules[key];
			var operationCondition = true;

			// Recurse again
			if(matches[1] === 'AND'){
				operationCondition = IDBWhere(data, rules[key], false);
			}

			// Recurse again
			else if(matches[1] === 'OR'){
				operationCondition = IDBWhere(data, rules[key], true);
			}

			else if(matches[3] === undefined){ // Equal to
				if(rule.constructor === Array){
					if(rule.includes(data[matches[1]]) === false)
						operationCondition = false; // When nothing match
				}
				else if(data[matches[1]] != rule)
					operationCondition = false; // When "not equal to"
			}

			else if(matches[3] === '!'){ // Not equal to
				if(rule.constructor === Array){
					if(rule.includes(data[matches[1]]))
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

			else if(matches[3].includes('~')){ // Data likes
				var likeCode = 1; // 1 = %value%, 2 = %value, 3 = value%
				var regexed = [];
				var rule_ = rule.constructor === Array ? rule : [rule];

				for (var a = 0; a < rule_.length; a++) {
					var temp = rule_[a];
					if(temp.slice(0, 1) === '%' && temp.slice(-1) === '%'){
						likeCode = 1;
						temp = temp.slice(1, -1);
					}
					else if(temp.slice(0, 1) === '%'){
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

				if(matches[3].includes('!')){ // Data not like
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
		return matches[0] || '';
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
			for (let key in where) {
				let key_ = key.split('[');
				if(db[key_[0]] != null && (index === void 0 || (index != null && key_[0] === index))){
					range = rangeBuilder(key_, where[key]);
					break;
				}
			}
		}

		if(objectStore != null){
			if(range !== null){
				try{
					return objectStore.index(key).openCursor(range);
				}catch(e){return objectStore.openCursor();}
			}
			return objectStore.openCursor();
		}

		return range;
	}

	var prepareQuery = async function(tableName, action, where){
		return new Promise((resolve, reject) => {
			var objectStore = My.getObjectStore(tableName, action, function(e){
				reject(e.target ? e.target.error : e);
			});
			if(!objectStore) return reject("Internal error");

			var obj = {
				found:0, // For limiting
				processed:0 // For limiting
			};

			if(where.LIMIT != null){
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

			if(where.ORDER != null){
				var order = where.ORDER;
				delete where.ORDER;

				var range = null;

				if(typeof order === 'string'){ // ASC
					if(dbStructure[tableName] != null || dbStructure[tableName][order] != null)
						var range = findIndexRange(tableName, where, order);

					obj.request = objectStore.index(order).openCursor(range, 'next');
				}
				else {
					var key = Object.keys(order)[0];
					if(dbStructure[tableName] != null || dbStructure[tableName][key] != null)
						var range = findIndexRange(tableName, where, key);

					if(order[key] === 'ASC')
						obj.request = objectStore.index(key).openCursor(range, 'next');

					if(order[key] === 'DESC')
						obj.request = objectStore.index(key).openCursor(range, 'prev');
				}
			}

			// Not ordered
			else obj.request = findIndexRange(tableName, where, objectStore);

			resolve(obj);
		});
	}

	/*
		columns
		{columnName:(
			text, number
		)}
	*/
	My.createTable = async function(tableName, columns){
		if(onStructureInitialize === null)
			throw new Error("`createTable` is unavailable because the database version need to be changed. Try changing the database structure on first initialization, and increment the version.");

		if(My.db.objectStoreNames.contains(tableName))
			return;
	
		for (let column in columns) {
			var objectStore = My.db.createObjectStore(tableName, {keyPath: 'rowid', autoIncrement: true});

			if(column.slice(0, 1) !== '$')
				continue;
			let col = validateText(column);
			let val = columns[column];

			objectStore.createIndex(col, col, {unique: val.unique ?? false});
		}
	}

	My.insert = async function(tableName, object){
		await My.busy;
		return await new Promise((resolve, reject) => {
			var duplicated = false;
			var objectStore = My.getObjectStore(tableName, "readwrite", function(){
				if(!duplicated) reject(`"${tableName}" table was not found`);
			});

			if(!objectStore) return reject("Failed to retrieve objectStore for: "+tableName);
  
			var objectStoreRequest = objectStore.add(object);
  
			objectStoreRequest.onerror = function(){
				duplicated = true;
				reject(`"${tableName}": duplicate on unique columns`);
			};
  
			objectStoreRequest.onsuccess = function(ev){
				resolve(ev.target.result);
			};
		});
	}

	My.has = async function(tableName, where){
		await My.busy;
		return await new Promise(async (resolve, reject) => {
			var query = await prepareQuery(tableName, "readonly", where, reject);
			var request = query.request;

			request.onerror = reject;
			request.onsuccess = function(){
				var cursor = request.result;
				if(cursor){
					if(IDBWhere(cursor.value, where))
						return resolve(true);

					cursor.continue();
				}
				else resolve(false); // End of rows
			};
		});
	}

	function rangeBuilder(opt, val){
		if(val.constructor === String){
			if(val.length === 0)
				return null;

			val = val.slice(0, 1);
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
			return null;
		}
		return IDBKeyRange.only(val);
	}

	My.cursor = async function(tableName, where, onScanning, onError){
		await My.busy;

  		var objectStore = My.getObjectStore(tableName, where && where.WRITE ? "readwrite" : "readonly", onError);
		if(!objectStore) throw new Error("Failed to retrieve object store for: "+tableName);

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

  		req.onerror = onError;
  		req.onsuccess = onScanning;
  		return req;
	}

	My.get = async function(tableName, select, where){
		await My.busy;
		return await new Promise(async (resolve, reject) => {
			var query = await prepareQuery(tableName, "readonly", where, reject);
			var request = query.request;

			request.onerror = reject;
			request.onsuccess = function(){
				var cursor = request.result;
				if(cursor){
					var value = cursor.value;
					if(IDBWhere(value, where)){
						if(select === '*')
							return resolve(value);

						if(select.constructor === String)
							return resolve(value[select]);

						var temp = {};
						for (var i = 0; i < select.length; i++) {
							let ref = select[i];
							temp[ref] = value[ref];
						}

						return resolve(temp);
					}
					cursor.continue();
				}
				else resolve(null); // End of rows
			};
		});
	}

	My.select = async function(tableName, select, where){
		await My.busy;
		return await new Promise(async (resolve, reject) => {
			var query = await prepareQuery(tableName, "readonly", where, reject);
			var request = query.request;

			request.onerror = reject;
			query.result = []; // Will be returned from success callback

			var operation = function(value){
				if(select === '*'){
					query.result.push(value);
					return;
				}

				if(select.constructor === String){
					query.result.push(value[select]);
					return;
				}

				var temp = {};
				for (var i = 0; i < select.length; i++) {
					let ref = select[i];
					temp[ref] = value[ref];
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

							if(code === -1)
								return resolve(query.result);
							else if(code === 1)
								operation(value); // Get data
						}
						else operation(value);
					}
					cursor.continue();
				}
				else resolve(query.result); // End of rows
			};
		});
	}

	My.delete = async function(tableName, where){
		await My.busy;
		return await new Promise(async (resolve, reject) => {
			if(!where){
				var store = My.getObjectStore(tableName, "readwrite", reject).clear();
				store.onsuccess = resolve;
				store.onerror = reject;
			}

			var query = await prepareQuery(tableName, "readwrite", where, reject);
			var request = query.request;

			request.onerror = reject;
			request.onsuccess = function(){
				var cursor = request.result;
				if(cursor){
					var value = cursor.value;
					if(IDBWhere(value, where)){
						if(query.limit !== false){
							var code = IDBLimit(query);

							if(code === -1)
								return resolve(query.processed);
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
				else resolve(query.processed); // End of rows
			};
		});
	}

	My.update = async function(tableName, object, where){
		await My.busy;
		return await new Promise(async (resolve, reject) => {
			var query = await prepareQuery(tableName, "readwrite", where, reject);
			var request = query.request;

			var columns = Object.keys(object);
			var operation = function(cursor, value){
				for (var i = 0; i < columns.length; i++) {
					let temp = columns[i];
					value[temp] = object[temp];
				}
				cursor.update(value);
			}

			request.onerror = reject;
			request.onsuccess = function(){
				var cursor = request.result;
				if(cursor){
					var value = cursor.value;
					if(IDBWhere(value, where)){
						if(query.limit !== false){
							var code = IDBLimit(query);
							
							if(code === -1)
								return resolve(query.processed);
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
				else resolve(query.processed); // End of rows
			};
		});
	}

	My.drop = function(tableName){
		if(onStructureInitialize === null)
			return console.warn("`drop` is unavailable because the database version need to be changed. Try changing the database structure on first initialization, and increment the version.");

		My.db.deleteObjectStore(tableName);
	}

	My.closeDatabase = function(){
		My.db.close();
	}
}