// `select`, `insert`, etc is similar with the browser version
var SFDatabase = require("./../dist/SFDatabase.node.js");

var MySQLCredentials = {mysql:true, host:'localhost', user:'root', password:''};
var myDB = new SFDatabase('yourDatabaseName', MySQLCredentials, function(){
	console.log('Connected!');

	// Make sure the database already created (if exist, creation process will be skipped)
	myDB.createTable('test', {'id':['int', 'primary key'], 'name':'text'}, function(){
		databaseInitialized();
	}, console.error);
});

function databaseInitialized(){
    console.log('Lets do something!');

	myDB.insert("test", {id:1, name:"abc"}, function(){
	    myDB.update("test", {'name':'zxc'}, {id:1}, function(rows){
		    myDB.select("test", ['name'], {id:1}, function(rows){
		        console.log("Result:", rows);

		        myDB.delete("test", {id:1}, function(){
		        	console.log("Data with id 1 was deleted");
		        }, console.error);
		    }, console.error);
	    }, console.error);
	}, console.error);
}