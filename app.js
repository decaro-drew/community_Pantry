var express = require("express")
var app = express();
var mysql = require("mysql");
var bodyParser = require("body-parser");
var session = require('client-sessions');
var upload = require('express-fileupload');
var busboy = require('connect-busboy');
var path = require('path');
var url = require('url');
const { isNull } = require("util");

app.use(bodyParser.urlencoded({extended: true}));
app.set('views', __dirname + '/views');
app.set("view engine", "ejs");
//var publicDir = require('path').join(__dirname,'/public'); 
app.use(express.static(path.join(__dirname,'public'))); 
app.use(bodyParser.json());
app.use(upload());
app.use(busboy());

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



app.use(session({
    cookieName: 'session',
    secret: 'promise_me_you_wont_tell_anyone',
    duration: 30 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
    httpOnly: true,
    secure: true,
    ephemeral: true
}));

app.use(function(req, res, next) {
    if (req.session && req.session.user) { 
          user = req.session.user;    
          //console.log(user); 
          req.user = user;
          delete req.user.password; // delete the password from the session
          req.session.user = user;  //refresh the session value
          res.locals.user = user;
        
        // finishing processing the middleware and run the route
        next();
    } else {
      next();
    }
  });
/*
function requireLogin (req, res, next) {
    if (!req.user) {
      //res.redirect('/login');
    } else {
      next();
    }
};
*/

app.get("/home", function(req, res){
    function getShoppingListAndLikedRecipes(){
        return new Promise(function (resolve, reject){
            var dishes = new Array();
            db.query("Select shoppingList, likedRecipes from user where username = ?",[req.session.user], function(error, rows){
                if(error){
                    throw error;
                }
                else{
                    
                    if(rows[0].shoppingList == null && rows[0].likedRecipes == null){
                        lists = {
                            shoppingList : [],
                            likedRecipes : []
                        }
                    }
                    else if(rows[0].shoppingList == null){
                        lists = {
                            shoppingList : [],
                            likedRecipes : rows[0].likedRecipes.split(",")
                        }
                    }
                    else if(rows[0].likedRecipes == null){
                        lists = {
                            shoppingList : rows[0].shoppingList.split(", "),
                            likedRecipes : []
                        }
                    }
                    else{
                        lists = {
                            shoppingList : rows[0].shoppingList.split(", "),
                            likedRecipes : rows[0].likedRecipes.split(",")
                        }
                    }
                  
                    resolve(lists);
                }
                
            });
        })
    }

    function getUserRecipes(){
        return new Promise(function (resolve, reject){
            var dishes = new Array();
            db.query("Select * from recipe where username = ?",[req.session.user], function(error, rows){
                if(error){
                    throw error;
                }
                else{
                    for(i=0; i<rows.length; i++){
                        dish = {
                            id: rows[i].id,
                            name:rows[i].name,
                            picture: rows[i].picture,
                            snipbit: rows[i].snipbit,
                            cuisine: rows[i].cuisine,
                            username: rows[i].username
                        }
                        dishes[i] = dish;
                    }
                    resolve(dishes);
                }
                
            });
        })
    }

    function getLikedRecipe(id){ 
        return new Promise(function (resolve, reject){
            db.query("Select * from recipe where id = ?",[id], function(error, rows){
                if(error){
                    throw error;
                }
                else{
                    dish = {
                        id: rows[0].id,
                        name:rows[0].name,
                        picture: rows[0].picture,
                        snipbit: rows[0].snipbit,
                        cuisine: rows[0].cuisine,
                        username: rows[0].username
                    }
                    resolve(dish);
                }
                
            });
        })
    }


    function getBio(){ 
        return new Promise(function (resolve, reject){
            db.query("Select bio from user where username = ?",[req.session.user], function(error, rows){
                if(error){
                    throw error;
                }
                else{
                    resolve(rows[0].bio);
                }
                
            });
        })
    }


    async function compile(){
        var userRecipes = await getUserRecipes();
        var lists = await getShoppingListAndLikedRecipes();
        var shoppingList = lists.shoppingList;
        var bio = await getBio();
        
        var likedRecipes = [];
        if(lists.likedRecipes[0] != ''){
            for(var i=0; i <lists.likedRecipes.length; i++){
                likedRecipes[i] = await getLikedRecipe(lists.likedRecipes[i]);
            }
        }

        if(shoppingList[0] == '') shoppingList = [];

        keyWords = ["Chicken", "Beef", "Pork", "Lamb", "Fish", "Seafood", "Pasta", "Rice", "Stirfry", "Soup", "Stew", "Salad", "Vegeterian"];

        
        res.render("home.ejs", {user: req.session.user, mainUser: req.session.user, likedRecipes, userRecipes, shoppingList, keyWords, bio});
    }
    compile();
    
});

app.get("/user/:user", function(req, res){
    const {user} = req.params;
   // var user = url.parse(req.url, true).query.otherUser;
    function getShoppingListAndLikedRecipes(){
        return new Promise(function (resolve, reject){
            var dishes = new Array();
            db.query("Select likedRecipes from user where username = ?",[user], function(error, rows){
                if(error){
                    throw error;
                }
                else{     

                        if(rows[0].likedRecipes == null)
                            likedRecipes = [];
                        else
                            likedRecipes = rows[0].likedRecipes.split(",");
                        resolve(likedRecipes);
                    
                }
                
            });
        })
    }

    function getUserRecipes(){
        return new Promise(function (resolve, reject){
            var dishes = new Array();
            db.query("Select * from recipe where username = ?",[user], function(error, rows){
                if(error){
                    throw error;
                }
                else{
                    for(i=0; i<rows.length; i++){
                        dish = {
                            id: rows[i].id,
                            name:rows[i].name,
                            picture: rows[i].picture,
                            snipbit: rows[i].snipbit,
                        }
                        dishes[i] = dish;
                    }
                    resolve(dishes);
                }
                
            });
        })
    }

    function getLikedRecipe(id){ 
        return new Promise(function (resolve, reject){
            db.query("Select * from recipe where id = ?",[id], function(error, rows){
                if(error){
                    throw error;
                }
                else{
    
    
                    
                 
                        console.log(id);
                        dish = {
                            id: rows[0].id,
                            name:rows[0].name,
                            picture: rows[0].picture,
                            snipbit: rows[0].snipbit,
                        }
                        resolve(dish);
                                  
                }
                
            });
        })
    }


    async function compile(){
        var userRecipes = await getUserRecipes();
        var likes = await getShoppingListAndLikedRecipes();

        var likedRecipes = [];
        if(likes[0] != ''){
            for(var i=0; i <likes.length; i++){
                likedRecipes[i] = await getLikedRecipe(likes[i]);
            }
        }
        
        res.render("user.ejs", {user: req.session.user, targetUser: user, likedRecipes, userRecipes});
    }

    compile();
});

app.post("/settop10", function(req, res){
    var valid = true;
    ids = [req.body.first, req.body.second, req.body.third, req.body.fourth, req.body.fifth, req.body.sixth, req.body.seventh, req.body.eigth, req.body.ninth, req.body.tenth];
    db.query("SELECT id FROM recipe", function(error, rows){
        if(error){
            throw error;
        }
        ///console.log(rows.length);
        var max = rows[rows.length-1].id;
        var min = rows[0].id;
        console.log(max);
        console.log(min);
        for(var i = 0; i < ids.length; i++){
            var match = false;
            if(ids[i] == ''){
                valid = false;
                res.send("null value was entered");
                return;
            }
            for(var j = 0; j < rows.length; j ++){
                if(ids[i] == rows[j])
                    console.log("here");
                    match = true;
                    break;

            }
            if(!match){
                valid = false;
                res.send("recipe id entered does not exist")
                return;
            }
            /*
            if(ids[i] > max || ids[i] < min){
                console.log(ids[i]);
                console.log(max);
                console.log(min);
                valid = false;
                res.send("recipe id entered does not exist")
                return;
            }*/
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

    const dishes = new Array ();

    db.query("Select * from recipe, top10 WHERE recipe.id =top10.dishid order by positionId", function(error, rows){

        if(error){
            throw error;
        }
        else{
            //console.log("cool, alright");
             
            for(i=0; i<rows.length; i++){

                dish = {
                    id: rows[i].id,
                    name:rows[i].name,
                    picture: rows[i].picture,
                    snipbit: rows[i].snipbit,
                    cuisine: rows[i].cuisine,
                    username: rows[i].username
                }

                dishes[i] = dish;

            }
         
            res.render("top10.ejs", {dishes});
        }
        
    });
});


app.get("/search", function(req, res){

    proteins = ["Chicken", "Beef", "Pork", "Tuna", "Salmon"];
    veggies = ["Broccoli", "Asparagus", "Corn", "Spinach", "Garlic", "Chili Pepper", "Cucumber"];
    starches = ["Pasta", "Potatos", "Rice", "Couscous"];
    herbs = ["Cilantro", "Parseley", "Mint", "Basil", "Dill"];
    spices = ["Cumin", "Coriander", "Anese", "Cardamom", "Cinammon"];
    other = []

    res.render("search.ejs", {user: req.session.user, proteins, veggies, starches, herbs, spices, other});
});

app.get("/results/dish", function(req, res){

    var dishName = url.parse(req.url, true).query.dishName;

    var dishes = new Array();
    db.query("Select * from recipe where name = ?",[dishName], function(error, rows){
        if(error){
            throw error;
        }
        else{
            for(i=0; i<rows.length; i++){
                dish = {
                    id: rows[i].id,
                    name:rows[i].name,
                    picture: rows[i].picture,
                    snipbit: rows[i].snipbit,
                    cuisine: rows[i].cuisine,
                    username: rows[i].username
                }
                dishes[i] = dish;
            }
        }
        
        res.render("results.ejs", {user: req.session.user, message: "Results for " + dishName, dishes, userSearch: false});
    });
    
    
});

app.get("/results/cuisine", function(req, res){

    var cuisine = url.parse(req.url, true).query.cuisine;

    var dishes = new Array();
    db.query("Select * from recipe where cuisine = ?", [cuisine], function(error, rows){
        if(error){
            throw error;
        }
        else{
            for(i=0; i<rows.length; i++){
                dish = {
                    id: rows[i].id,
                    name:rows[i].name,
                    picture: rows[i].picture,
                    snipbit: rows[i].snipbit,
                    cuisine: rows[i].cuisine,
                    username: rows[i].username
                }
                dishes[i] = dish;
            }
        }
        
        res.render("results.ejs", {user: req.session.user, message: "Results for " + cuisine, dishes, userSearch: false});
    });
    
    
});


app.get("/results/users", function(req, res){
    var targetUser = url.parse(req.url, true).query.targetUser.toLowerCase();
    console.log(targetUser);
    db.query("SELECT * FROM user", function(err, rows){
        var exact = new Array();
        var indexZero = new Array();
        var others = new Array()
        for(var i = 0; i < rows.length; i++){
            if(rows[i].username.toLowerCase().includes(targetUser)){
                console.log(rows[i].username.toLowerCase());
                if(rows[i].username.toLowerCase() == targetUser)
                    exact.push(rows[i].username);
                else if(rows[i].username.toLowerCase().indexOf(targetUser) == 0)
                    indexZero.push(rows[i].username);
                else
                    others.push(rows[i].username);
            }
        }
        indexZero.sort(function(a,b){ return a.length - b.length});     
        others.sort(function(a,b){ return a.length - b.length});
        var userList = new Array();
        for(var i = 0; i < exact.length; i++)
            userList.push(exact[i]);
        for(var i = 0; i < indexZero.length; i++)
            userList.push(indexZero[i]);
        for(var i = 0; i < others.length; i++)
            userList.push(others[i]);
        userList = userList.filter(e => e !== "admin");
        userList = userList.filter(e => e !== req.session.user);  
        res.render("results.ejs", {user: req.session.user, message: "Here's who we found", userList});
    });

});

app.get("/results", function(req, res){
    //console.log("1,2, 3, 4".split(", "));
    var ingredientsTemp = url.parse(req.url, true).query;
    var ingredients = Object.keys(ingredientsTemp);
    var dishes = new Array();
    for(i = 0; i < ingredients.length; i++){
        ingredients[i] = ingredients[i].toLowerCase();
    }
    db.query("Select * from recipe", function(error, rows){
        if(error){
            throw error;
        }
        else{
            var counter = 0;
            var matches;
            for(i=0; i<rows.length; i++){
                lowerIng = rows[i].ingredients.toLowerCase();
                if(!rows[i].keywords)
                    lowerKeys = "";
                else
                    lowerKeys = rows[i].keywords.toLowerCase();
                matches = 0;
                for(j=0; j<ingredients.length; j++){
                   // lowerIng.includes(ingredients[j]) || 
                    if(lowerKeys.includes(ingredients[j])){
                        matches++;
                    }
                    else{
                        ingList = lowerIng.split(", ");
                        for(k = 0; k < ingList.length; k++){
                            if(ingredients[j] == ingList[k]){
                                matches++;
                                break;
                            }
                        }
                    }
                }
                if(matches > 0){
                    dish = {
                        id: rows[i].id,
                        name:rows[i].name,
                        picture: rows[i].picture,
                        snipbit: rows[i].snipbit,
                        cuisine: rows[i].cuisine,
                        uername: rows[i].username,
                        matches: matches,
                    }
                    dishes[counter] = dish;
                    counter++;
                }
            }
        }
        dishes.sort((a,b) => parseFloat(b.matches) - parseFloat(a.matches));
        res.render("results.ejs", {user: req.session.user, message: "Here's what you can make", dishes, userSearch: false});
    });
});



app.post("/saveRecipe/:id", function(req, res){
    const {id} = req.params;
    
    db.query("select likedRecipes from user where username = ?", [req.session.user], function(error, rows){
        if(error){
            throw error;
        }
        else{
            liked = rows[0].likedRecipes;
            newString = '';
            if(liked == '') newString = id;
            else newString = id + "," + liked;
            db.query("update user set likedRecipes = '" + newString + "' where username = ?", [req.session.user], function(error, rows){
                if(error){
                    throw error;
                }
                else{
                    res.redirect("/recipe/" + id)
                } 
            })
        }
    })
});

app.post("/unSaveRecipe/:id", function(req, res){
    const {id} = req.params;
    console.log(id);
    db.query("select likedRecipes from user where username = ?", [req.session.user], function(error, rows){
        if(error){
            throw error;
        }
        else{
            var likedRecipes = rows[0].likedRecipes.split(",");
            likedRecipes.splice(likedRecipes.indexOf(id), 1);
            var listAsString = likedRecipes.join(",");

            db.query("update user set likedRecipes = '" + listAsString + "' where username = ?", [req.session.user], function(error, rows){
                if(error){
                    throw error;
                }
                else{
                    res.redirect("/recipe/" + id)
                }
            })

        }
    })
});


app.post("/clearSavedRecipes", function(req, res){
    db.query("update user set likedRecipes = '' where username = ?", [req.session.user], function(error, rows){
        if(error){
            throw error;
        }
        else{
            res.redirect("/home")
        }
    })
});



app.post("/saveIngredients/:id/:ingredients", function(req, res){
    const {ingredients} = req.params;
    const {id} = req.params;
    db.query("select shoppingList from user where username = ?", [req.session.user], function(error, rows){
        if(error){
            throw error;
        }
        else{
            list = rows[0].shoppingList;
            newString = '';
            if(list == '') newString = ingredients;
            else newString = ingredients + ", " + list;
            db.query("update user set shoppingList = '" + newString + "' where username = ?", [req.session.user], function(error, rows){
                if(error){
                    throw error;
                }
                else{
                    res.redirect("/recipe/" + id)
                }
            })
        }
    })
});



app.post("/deleteIngredient/:index", function(req, res){
    const {index} = req.params;
    console.log(index);
    db.query("select shoppingList from user where username = ?", [req.session.user], function(error,rows) {
        if(error){
            throw error;
        }
        else{
            var shoppingList = rows[0].shoppingList.split(", ");
            shoppingList.splice(index, 1);
            var listAsString = shoppingList.join(", ");

            db.query("update user set shoppingList = '" + listAsString + "' where username = ?", [req.session.user], function(error, rows){
                if(error){
                    throw error;
                }
                else{
                    res.redirect("/home");
                }
            })
        }
    })
});

app.post("/clearShoppingList", function(req, res){
    db.query("update user set shoppingList = '' where username = ?", [req.session.user], function(error, rows){
        if(error){
            throw error;
        }
        else{
            res.redirect("/home")
        }
    })
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
                var dishName = rows[0].name;
                var instructions = rows[0].instructions;
                var image = rows[0].picture;
                var ingredients = rows[0].ingredients.split(",");
                var ingredientString = rows[0].ingredients;
                var username = rows[0].username;
                var snipbit = rows[0].snipbit;
                var cuisine = rows[0].cuisine;

                db.query("SELECT likedRecipes FROM user WHERE username = ?", [req.session.user], function(error, rows){
                        if(error){
                            throw error;
                        }
                        else{
                            var saved = rows[0].likedRecipes.includes(id);
                            res.render("recipe.ejs", {user: req.session.user, saved, dishName, instructions, ingredients, ingredientString, image, id, snipbit, username, cuisine});
                        }
                });
                
        }      
    });
    
});



app.post("/login", function(req, res){
    if(req.body.username == "admin" && req.body.pword == "admin"){
        req.session.user = "admin";
        res.redirect("/admin");
    }
    else{
        db.query("SELECT username, pWord FROM user", function(error, rows, fields){
            var success = false;
            if(error){
                console.log(error);
            }else{
               for(var i=0; i<rows.length; i++){
                   if(rows[i].username == req.body.username){
                       //console.log("username match");
                       if(rows[i].pWord == req.body.pword){
                           //console.log("password match");
                           success = true;
                           req.session.user = req.body.username;
                           res.redirect("/home");
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
    db.query("SELECT MAX(id) as max FROM recipe", function(err, result){
        var keys = Object.keys(req.body);
        keys.splice(0,5);
        var keyString = keys.join(",")
        var file = req.files.image;
        file.name = (result[0].max+1).toString() + ".jpg";
        var imgName = "/recipe_images/"+file.name;
        if(file.mimetype == "image/jpeg" ||file.mimetype == "image/png"||file.mimetype == "image/gif" ){                               
            file.mv('public/recipe_images/'+file.name, function(err) {                      
                if (err)
                  return res.status(500).send(err);
                db.query("Insert into recipe (name, picture, cuisine, snipbit, ingredients, instructions, username, keywords) VALUES ('"+req.body.rName+"','"+imgName+"','"+req.body.cuisine+"','"+req.body.snipbit+"', '"+req.body.ingredients+"', '"+req.body.instructions+"', '"+req.session.user+"', '"+keyString+"')",function(err, result){   
                      if(err){
                          res.send("Error");
                      }
                      else{
                          id = result.insertId;
                          res.redirect("/recipe/" + id);
                      }
                  });           
            });
        } else {
          message = "This format is not allowed , please upload file with '.jpg'";
          res.render('index.ejs',{message: message});
        } 
    }); 	    
});

app.post("/updateProfilePhoto", function(req, res){
    var file = req.files.image;
    file.name = req.session.user + ".jpg";
   // var imgName = "/recipe_images/"+file.name;
    if(file.mimetype == "image/jpeg"){
        file.mv('public/profile_images/'+file.name, function(err){
            res.redirect("/home");
        });
    }
    else{
        console.log("error with file type. try again, but better");
        ///message = "This format is not allowed , please upload file with '.jpg'";
        res.redirect("/home");
    }
});

app.post("/updateBio", function(req, res){
    console.log(req.body.bio);
    db.query("update user set bio = ? where username = '"+req.session.user+"'",[req.body.bio], function(err, rows){
        if(err)
            throw err;
        else{
            res.redirect("/home");
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
        db.query("Insert into user (username, email, pWord, shoppingList, likedRecipes, bio) VALUES ('"+req.body.uName+"','"+req.body.email+"','"+req.body.pWord+"', '', '', '')",function(err, result){   
            if(err){
                res.send("Username already exists");
            }
            else{
                req.session.user = req.body.uName;
                res.redirect("/home");
            }
        });
    }
});

app.get("/admin", function(req, res){
    keyWords = ["Chicken", "Beef", "Pork", "Lamb", "Fish", "Seafood", "Pasta", "Rice"];
    res.render("admin.ejs", {message : "", keyWords});
});

app.post("/deleteuser", function(req, res){
    db.query("update recipe set username = 'admin' where username = ?",[req.body.username], function(err, result){   
        if(err){
            throw err;
        }
        else{
            db.query("delete from user where username = ?",[req.body.username], function(err, result){   
                if(err){
                    throw err;
                }
                else{
                   res.redirect("/admin");
               }
            });
        }
    });

});


app.get("/", function(req, res){
    res.render("index.ejs");
});


app.listen(3000, function(){
    console.log("Server running on port 3000")
});
