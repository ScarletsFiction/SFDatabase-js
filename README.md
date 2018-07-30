<a href="https://www.patreon.com/stefansarya"><img src="http://anisics.stream/assets/img/support-badge.png" height="20"></a>

[![Written by](https://img.shields.io/badge/Written%20by-ScarletsFiction-%231e87ff.svg)](LICENSE)
[![Software License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)

# SFDatabase
SFDatabase is a database library that can help you build a SQL Query and execute it to the server from Nodejs or local browser with WebSQL or AlaSQL.
AlaSQL is required for web browser that doesn't support WebSQL. It will fallback to IndexedDB or LocalStorage for saving the database.

For Nodejs, you should install [mysqljs](https://github.com/mysqljs/mysql/)
> $ npm i mysqljs/mysql

On Nodejs, connection pooling will be used. So it would need a single connection only for every query.

## Sample Usage

```js
// You can also preprocess your data before or after the SQL Query is executed
var preprocessTable = {
    test:{ // Table name
        data:{ // Column name
            set:JSON.stringify, // On insert or update
            get:JSON.parse // On select
        }
    }
};

var options = {
    debug:function(query, data){
        console.log("Query: "+query, data);
    }
};
// {host:'localhost', user:'root', password:''}; <- Required for NodeJS to login to MySQL

var myDatabase = new SFDatabase('YourDatabaseName', options, function(resumePending){
    // Wait until the class reference saved to myDatabase variable
    setTimeout(function(){
        console.log('Database Initialized!');
        myDatabase.preprocessTable = preprocessTable;

        // Make sure the database already created (if exist, creation process will be skipped)
        myDatabase.createTable('test', {id:'number', name:'text', data:'text', words:'text'}, function(){
            resumePending(); // Continue pending SQL query
            queryTest();
        }, console.error);
    }, 1);

    return true; // Pause pending SQL query (if false, it would resume after this function end)
});

// You should wait until myDatabase.initialized is set to true
// Any query that passed when not initialized will be pended
```

Available Function

```js
// CREATE TABLE IF NOT EXISTS test (id NUMBER, name TEXT, data TEXT, words TEXT)
// createTable(table, fields, onSuccess, onError);
myDatabase.createTable('test', {id:['number', 'unique'], name:'text', data:'text', words:'text'}, console.warn);

// INSERT INTO test (id, name, words) VALUES (?, ?, ?)
// createTable(table, fields, onSuccess, onError);
myDatabase.insert("test", {id:1, name:"abc", words:'hey'}, console.warn);

// UPDATE test SET name = ?, data = ? WHERE (id = ? AND (name = ? OR name = ?))
// createTable(table, fields, where, onSuccess, onError);
myDatabase.update("test", {'name':'zxc', data:{any:[1,2,3]}}, {AND:{id:1, OR:{name:'abc', 'name#1':'zxc'}}}, console.warn);

// SELECT name, data FROM test WHERE (id = ? OR (words LIKE ?)) LIMIT 1
// createTable(table, fields, where, onSuccess, onError);
myDatabase.select("test", ['name', 'data'], {OR:{id:321, 'words[~]':'hey'}, LIMIT:1}, console.warn);

// SELECT name FROM test WHERE (rowid = ? AND (name = ? OR name = ?) AND (id IN (?, ?, ?) OR data IS NOT NULL))
myDatabase.select("test", ['name'], {AND:{rowid:1, OR:{name:'abc', 'name#1':'zxc'}, 'OR#1':{id:[1,2,null], 'data[!]':null}}}, console.warn);

// DELETE FROM test WHERE (name LIKE ?)
// delete(table, where, onSuccess, onError);
myDatabase.delete("test", {'name[~]':"%xc"}, console.warn);

// TRUNCATE TABLE test
myDatabase.delete("test", 0, console.warn);
myDatabase.drop("test", console.warn);
```

## Contribution

If you want to help in SFDatabase library, please fork this project and edit on your repository, then make a pull request to here.

Keep the code simple and clear.

## License

SFDatabase is under the MIT license.

But don't forget to put the a link to this repository.
