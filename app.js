var express = require("express")
var app = express();
var mysql = require("mysql");
var bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

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


app.get("/home", function(req, res){
    res.render("home.ejs");
});

app.post("/settop10", function(req, res){
    var valid = true;
    ids = [req.body.first, req.body.second, req.body.third, req.body.fourth, req.body.fifth, req.body.sixth, req.body.seventh, req.body.eigth, req.body.ninth, req.body.tenth];
    db.query("SELECT id FROM recipe", function(error, rows){
        if(error){
            throw error;
        }
        ///console.log(rows.length);
        var max = rows.length;
        for(var i = 0; i < ids.length; i++){
            if(ids[i] == ''){
                valid = false;
                res.send("null value was entered");
                return;
            }
            if(ids[i] > max || ids[i] < 1){
                valid = false;
                res.send("recipe id entered does not exist")
                return;
            }
        }
        if(valid){
            var sql = "Insert into top10 (positionId, dishId) VALUES ? ON DUPLICATE KEY UPDATE dishId = VALUES(dishId)";
            var vals = [
            [1, req.body.first],
            [2, req.body.second],
            [3, req.body.third],
            [4, req.body.fourth],
            [5, req.body.fifth],
            [6, req.body.sixth],
            [7, req.body.seventh],
            [8, req.body.eigth],
            [9, req.body.ninth],
            [10, req.body.tenth]
            ]
            db.query(sql, [vals], function(error, rows){
                if(error){
                    throw error;
                }
            });
            res.redirect("/top10");
        }
    });  
});

app.get("/top10", function(req, res){

    
    dish1 = {
        id: 1,
        name: "Dish 1",
        picture: "",
        snipbit: "This dish tastes real fucking good"
    }

    dish2 = {
        id: 2,
        name: "Dish 2",
        picture: "",
        snipbit: "Eating this for dinner will make you shut your pants"
    }

    dishes = [dish1, dish2];

    res.render("top10.ejs", {dishes});
});

app.get("/search", function(req, res){
    res.render("search.ejs");
});

app.get("/recipe/:id", function(req, res){
    const {id} = req.params;
    var success = false;
    //console.log(id);
    db.query("SELECT * FROM recipe WHERE id = ?", [id], function(error, rows){
        if(error){
            throw error;
        }
        else{
            if(rows.length > 0){
                success = true;
                var dishName = rows[0].name;
                var instructions = rows[0].instructions;
                console.log("here");
                ///ingredients = ["egg", "brocoli", "cumin"];
                ingredients = rows[0].ingredients.split(",");
                res.render("recipe.ejs", {dishName, instructions, ingredients});
            }
            else{
                console.log("hererere");
                ingredients = ["egg", "brocoli", "cumin"];
                res.render("recipe.ejs", {dishName: "nah", instructions: "just fucking make it bro", ingredients});
            }
 
            //var result = JSON.parse(JSON.stringify(rows[0]));
            //console.log(rows[0].name.toString());
            //dishName = rows[0].name.toString()
            
        }      
    });
    
});


app.post("/login", function(req, res){
    if(req.body.username == "admin" && req.body.pword == "admin"){
        res.render("admin.ejs");
    }
    else{
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
                           res.render("home.ejs")
                       }else{
                           console.log("incorrect password");
                           success = true;
                           res.redirect("/");
                       }
                   }
               }
               if(!success)
                    res.send("No such user");
            }
        });
    }
});

app.post("/createRecipe/:username", function(req, res){
    const {username} = req.params;
    db.query("Insert into recipe (name, picture, cuisine, snipbit, ingredients, instructions, username) VALUES ('"+req.body.rName+"','"+req.body.picture+"','"+req.body.cuisine+"','"+req.body.snipbit+"', '"+req.body.ingredients+"', '"+req.body.instructions+"', '"+username+"')",function(err, result){   
        if(err){
            res.send("Error");
        }
        else{
            id = result.insertId;
            res.redirect("/recipe/" + id);
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
                res.render("home.ejs");
            }
        });
    }
});


app.get("/", function(req, res){
    res.render("index.ejs");
});


app.listen(3000, function(){
    console.log("Server running on port 3000")
});


