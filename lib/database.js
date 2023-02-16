var mysql=require('mysql2');
require('dotenv').config();

var connection=mysql.createPool({
   host:process.env.MYSQLHOST,
   user:process.env.MYSQLUSER,
   password:process.env.MYSQLPASSWORD,
   database:process.env.MYSQLDATABASE,
   port:process.env.MYSQLPORT
});

// connection.connect(function(error){
//     if(error) console.log(error);
// });

module.exports = connection; 