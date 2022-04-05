// `select`, `insert`, etc is similar with the browser version
var SFDatabase = require("./../dist/sfdatabase.node.js");

var myDB = new SFDatabase('MyDatabaseName', {
	mysql: true,
	host: 'localhost',
	user: 'root',
	password: '',

	onInit: databaseInitialized
});

async function databaseInitialized(){
	console.log('Connected! Lets do something!');
	
	// Make sure the database already created (if exist, creation process will be skipped)
	await myDB.createTable('test', {'id':['int', 'primary key'], 'name':'text'});

	await myDB.insert("test", {id:1, name:"abc", words:'hey all'});
	await myDB.update("test", {'name':'zxc', data:{any:[1,2,3]}}, {id:1, OR:{name:'abc', 'name#1':'zxc'}});
	
	let rows = await myDB.select("test", ['name', 'data'], {OR:{id:321, 'words[~]':'hey'}, LIMIT:1});
	console.log("Result:", rows[0]);

	let affected = await myDB.delete("test", {'name[~]':"%xc"});
	console.log(affected+" data was deleted");
}