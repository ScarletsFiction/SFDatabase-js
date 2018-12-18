// `select`, `insert`, etc is similar with the browser version
var SFDatabase = require("./ScarletsFiction-Database.js");

var MySQLCredentials = {host:'localhost', user:'root', password:''};
var myDatabase = new SFDatabase('YourDatabaseName', MySQLCredentials, function(){
	setTimeout(function(){ // Wait until the class reference saved to myDatabase variable
	    if(myDatabase){
	        console.log('Connected!');

		    // Make sure the database already created (if exist, creation process will be skipped)
	        myDatabase.createTable('test', {'id':'number', 'name':'text'}, function(){
				databaseInitialized();
	        }, console.error);
	    } else {
	        console.log('Database Error!');
	    }
	}, 1);
});

function databaseInitialized(){
    console.log('Lets do something!');

	myDatabase.insert("test", {id:1, name:"abc"}, function(){
	    myDatabase.update("test", {'name':'zxc'}, {id:1}, function(rows){
		    myDatabase.select("test", ['name'], {id:1}, function(rows){
		        console.log("Result:", rows);

		        myDatabase.delete("test", {id:1}, function(){
		        	console.log("Data with id 1 was deleted");
		        }, console.error);
		    }, console.error);
	    }, console.error);
	}, console.error);
}