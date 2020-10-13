var express = require("express")
var app = express();
var mysql = require("mysql");
var bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({extended: true}));
app.set("view-engine", "ejs");

var db = mysql.createConnection({
    host: 'community-pantry.c2b5rjt4aoog.us-east-1.rds.amazonaws.com',
    user: 'senioritis',
    password: 'commpantry',
    database: 'community_pantry'
});

db.connect(function(error){
    if(error){
        console.log("Error while connecting to Database");
    }else{
        console.log("Connected to Database")
    }
});

app.use(express.static("public"));

app.get("/", function(req, res){
    res.render("index.ejs");
});

app.post("/login", function(req, res){
    db.query("SELECT username, pWord FROM user", function(error, rows, fields){
        if(error){
            console.log(error);
        }else{
           for(var i=0; i<rows.length; i++){
               if(rows[i].username == req.body.username){
                   console.log("username match");
                   if(rows[i].pWord == req.body.pword){
                       console.log("password match");
                       res.send("Successful login");
                   }else{
                       console.log("incorrect passowrd");
                       res.redirect("/");
                   }
               }
           }
           res.send("No such user");
        }
    });
});

app.listen(3000, function(){
    console.log("Server running on port 3000")
});