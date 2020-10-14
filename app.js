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
//res.redirect to send to pages
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
        var success = false;
        if(error){
            console.log(error);
        }else{
           for(var i=0; i<rows.length; i++){
               if(rows[i].username == req.body.username){
                   console.log("username match");
                   if(rows[i].pWord == req.body.pword){
                       console.log("password match");
                       success = true;
                       res.send("Successful login");
                   }else{
                       console.log("incorrect passowrd");
                       res.redirect("/");
                   }
               }
           }
           if(!success)
                res.send("No such user");
        }
    });
});
app.post("/createAccount", function(req, res){
    var valid = true;
    if(req.body.uName.length < 6){
        res.send("Username must be at least 6 characters");
        valid = false;
    }
    if(req.body.email.indexOf('@') == -1 || req.body.email.length == 0){
        res.send("Invalid email address")
        valid = false;
    }
    if(req.body.pWord.length < 6){
        res.send("Password must be at least 6 characters");
        valid = false;
    }
    if(req.body.cPword != req.body.pWord){
        res.send("Passwords are not equal")
        valid = false;
    }
    if(valid){
        db.query("Insert into user (username, email, pWord) VALUES ('"+req.body.uName+"','"+req.body.email+"','"+req.body.pWord+"')",function(err, result){   
            if(err){
                res.send("Username already exists");
            }
            else{
                res.send("Account created");
            }
        });
    }
});

app.listen(3000, function(){
    console.log("Server running on port 3000")
});
