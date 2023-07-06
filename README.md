[![Written by](https://img.shields.io/badge/Written%20by-ScarletsFiction-%231e87ff.svg)](LICENSE)
[![Software License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)

# SFDatabase-js
SFDatabase-js is a database library that can help you build a SQL Query and execute it to the server from Nodejs or local browser with WebSQL. It will fallback to IndexedDB or LocalStorage for saving the database if running on browser. [Check the example here](https://jsbin.com/fedoyiviro/edit?js,console).

## Getting started for Node.js
First, you should install [mysqljs](https://github.com/mysqljs/mysql/) and `sfdatabase-js`
```sh
$ npm i sfdatabase-js

# Optional if you want to use MySQL or SQLite for your database
$ npm i mysqljs/mysql
$ npm i sqlite3
```

## Sample Usage
```js
var MyDB = new SFDatabase('MyDB', {

    // For MySQL on Node.js
    mysql: true,
    host:'localhost',
    user:'root',
    password:'',

    // For SQLite on Node.js
    sqlite3: new (require('sqlite3').Database)('./test.db'),
    // Your database table's structure [optional]
    structure:{/*
        TableName:{
            id: ['integer', 'primary', 'autoincrement'],
            ColumnName: 'integer',
        },
    */},

    hideInitialization:true, // Keep silent after connected to DB

    // Debug SQL query if needed
    debug(query, data){
        console.log("Query: "+query, data);
    },

    onError: console.error,

    // You can also preprocess your data before or after the SQL Query is executed
    // This is optional
    preprocessTable: {
        test:{ // Table name
            data:{ // Column name
                set:JSON.stringify, // On insert or update
                get:JSON.parse // On select
            }
        }
    },

    onInit(){
        console.log("Database was connected!");
    }
});
```

## Getting started for Browser
Add this into your HTML's header.
```xml
<script src="https://cdn.jsdelivr.net/npm/sfdatabase-js@1.3.2/dist/SFDatabase.min.js"></script>
```

Before you use the database, you need to create the table first.
```js
// Let's begin the initialization
var MyDB = new SFDatabase('MyDBName', {
    // Set this to true if you want to use WebSQL
    // Only some browser may support WebSQL
    // Set to false if you want to use IndexedDB
    websql: false,

    // When you have changed the DBStructure you need to update this version
    idbVersion:1,

    // Your database table's structure
    structure:{
        // TableName:{ TableStructure },
        UsersInfo:{
            $user_id: ['number', 'unique'], // indexed user_id
            $username: 'text', // indexed username
            name: 'text',

            // When using IndexedDB you can store almost any data types
            // To improve performance and memory you shouldn't store a big Object
            // instead you should spread it as table's structure
            data: 'Object', // you can store like {my: 'object'}

            // When using IndexedDB you can also store data without
            // declaring the structure, but declaring the table name is a must
        },
        Settings:{
            $name: ['text', 'unique'], // indexed name
            value:'text',
        },
    },

    // Debug WebSQL query if needed
    debug(query, data){
        console.log("Query: "+query, data);
    },

    onInit(){
        // MyDB_was_initialize(MyDB);

        // Maybe add some feature to make something easier
        Object.assign(MyDB, myFeature);
        MyDB.setSettings("It's", "ready", function(){
            MyDB.getSettings("It's", console.log)
        });
    }
});

var myFeature = {
    getSettings(name, callback){
        //       TableName  Get Column   Where    Success Callback
        this.get('Settings', 'value', {name:name}, function(data){
            callback(data);
        });
    },
    setSettings(name, value){
        let that = this;
        //       TableName      Where     Success Callback
        this.has('Settings', {name:name}, function(exist){
            if(exist === false)
                that.insert('Settings', {name:name, value:value});
                   //       TableName           Data
            else
                that.update('Settings', {value:value}, {name:name});
                   //       TableName       Data           Where
        });
    }
};
```

## Available Function

```js
// If you use IndexedDB you don't need .createTable
// onSuccess and onError callback are optional

// CREATE TABLE IF NOT EXISTS test (id NUMBER, name TEXT, data TEXT, words TEXT)
// createTable(tableName, structure, onSuccess, onError);
await MyDB.createTable('test', {
    id:['number', 'unique'],
    name:'text',
    data:'text',
    words:'text'
});

// INSERT INTO test (id, name, words) VALUES (?, ?, ?)
// insert(tableName, fields, onSuccess, onError);
await MyDB.insert("test", {
    id:1,
    name:"abc",
    words:'hey'
});

// UPDATE test
//      SET name = ?, data = ?
//      WHERE (id = ? AND (name = ? OR name = ?))
// update(tableName, fields, where, onSuccess, onError);
await MyDB.update("test", {
    // Fields
    name:'zxc',
    data:{
        any:[1,2,3]
    }
}, {
    // Where
    AND:{
        id:1,
        OR:{
            name:'abc',
            'name#1':'zxc'
        }
    }
});

// SELECT name, data FROM test
//      WHERE (id = ? OR (words LIKE ?))
//      LIMIT 1
// select(tableName, GetFieldsData, where, onSuccess, onError);
let result = await MyDB.select("test", ['name', 'data'], {
    OR:{
        id:321,
        'words[~]':'hey'
    },
    LIMIT:1
});

// SELECT name FROM test
//      WHERE (rowid = ? AND (name = ? OR name = ?) AND (id IN (?, ?, ?) OR data IS NOT NULL))
let results = await MyDB.select("test", 'name', {
    AND:{
        rowid:1,
        OR:{name:'abc', 'name#1':'zxc'},
        'OR#1':{id:[1,2,null], 'data[!]':null}
    }
});

// DELETE FROM test WHERE (name LIKE ?)
// delete(tableName, where, onSuccess, onError);
await MyDB.delete("test", {'name[~]':"%xc"}, console.warn);

// TRUNCATE TABLE test
await MyDB.delete("test", 0, console.warn);

// Drop table
await MyDB.drop("test", console.warn);
```

## Contribution
If you want to help in SFDatabase-js library, please fork this project and edit on your repository, then make a pull request to here. This library can be improved by making some code more efficient.

## License
MIT license.