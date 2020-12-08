var express = require("express")
var app = express();
var mysql = require("mysql");
var bodyParser = require("body-parser");
var session = require('client-sessions');
var upload = require('express-fileupload');
var busboy = require('connect-busboy');
var path = require('path');
var url = require('url');
var httpMsgs = require('http-msgs')
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
    //duration: 30 * 60 * 1000,
    //activeDuration: 5 * 60 * 1000,
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

app.use(function (req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next()
});

function  requireLogin(req, res, next) {

    if (!req.session.user) {
       res.redirect("/login");
    } else {
      next();
    }
};


app.get("/home", requireLogin, function(req, res){
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

        res.render("home.ejs", {user: req.session.user, mainUser: req.session.user, likedRecipes, userRecipes, shoppingList, keyWords, bio, location: ""});
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
    
                        console.log(id);
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
            db.query("Select bio from user where username = ?",[user], function(error, rows){
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
        var likes = await getShoppingListAndLikedRecipes();
        var bio = await getBio();

        var likedRecipes = [];
        if(likes[0] != ''){
            for(var i=0; i <likes.length; i++){
                likedRecipes[i] = await getLikedRecipe(likes[i]);
            }
        }
        
        res.render("user.ejs", {user: req.session.user, targetUser: user, likedRecipes, userRecipes, bio});
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
            [8, req.body.eighth],
            [9, req.body.ninth],
            [10, req.body.tenth]
            ]
            db.query(sql, [vals], function(error, rows){
                if(error){
                    throw error;
                }
            });
            res.redirect("/admin");
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
         
            res.render("top10.ejs", {dishes, user: req.session.user});
        }
        
    });
});


app.get("/search", function(req, res){

    keyProteins = ["Chicken", "Eggs", "Turkey", "Beef", "Lamb", "Pork", "Fish", "Seafood"];
    chickens = ["Chicken breast", "Chicken thighs", "Chicken wings", "Chicken leg", "Chicken liver", "Ground Chicken", "Chicken sausage"];
    beefs = ["Flat iron", "Chuck roast", "Chuck short ribs", "Chuck eye roast", "Ribeye", "Prime rib", "Cowboy steak", "Short ribs", "Strip steak", "T-bone", "Porterhouse", "Filet mignon", "Sirloin", "Tri-tip", "London broil", "Top round", "Bottom round", "Flank steak", "Skirt steak", "Brisket"];
    porks = ["Bacon", "Pork chops", "Pork belly", "Ground Pork", "Ham", "Pork ribs", "Sausage", "Pork tenderloin"];
    lambs = ["Lamb leg", "Ground lamb", "Kabob", "Lamb chop", "Rack of lamb", "Lamb shank"];
    seafoods = ["Shrimp", "Clams", "Crab", "Scallop", "Squid", "Octopus", "Lobster", "Mussels", "Oysters"];
    fishes = ["Sea Bass", "Salmon", "Arctic char", "Tilapia", "Snapper", "Tuna", "Mahimahi", "Halibut", "Cod", "Swordfish", "Shark"];
    veggies = ["Artichoke", "Arugula", "Asparagus", "Bamboo Shoots", "Beets", "Broccoli", "Bok Choy", "Brussel Sprouts", "Green Cabbage", "Red Cabbage", "Carrot", "Cassava", "Cauliflower", "Celery", "Collard Greens", "Corn", "Cucumber", "Edamame", "Eggplant", "Garlic", "Ginger", "Green Beans", "Horseadish", "Kale", "Leeks", "Iceberg Lettuce", "Leaf Lettuce", "Romaine Lettuce", "Mushrooms", "Okra", "Onion", "Green Peas", "Snow Peas", "Green Pepper", "Red Pepper", "Sugar Snap Peas", "Red Potato", "Sweet Potato", "White Potato", "Pumpkin", "Radish", "Shallots", "Squash", "Spinach", "Swiss Chard", "Tomatillo", "Tomato", "Turnip", "Yam", "Zucchini"];
    fruits = ["Apple", "Apricot", "Avocado", "Banana", "Blackberries", "Blackcurrant", "Redcurrant", "Blueberries", "Cantaloupe", "Cherries", "Clementine", "Coconut", "Cranberries", "Dates", "Figs", "Grapefruit", "Grapes", "Guava", "Honeydew", "Plum", "Kiwi", "Lemon", "Lime", "Lychee", "Mandarin", "Mango", "Nectarine", "Olives", "Peach", "Pear", "Persimmon", "Dragonfruit", "Pineapple", "Plantain", "Pomegranate", "Raspberries", "Strawberries", "Tangerine", "Watermelon"];
    starches = ["Chickpeas", "Couscous", "Bagel", "Bread", "Beans", "Granola", "Oatmeal", "Pasta", "Spaghetti Pasta", "Fettuccine Pasta", "Angel Hair Pasta", "Macaroni Pasta", "Bow Ties Pasta", "Penne Pasta", "Ziti Pasta", "Linguine", "Lasagne", "Red Potato", "Sweet Potato", "White Potato", "Rice", "Black Rice", "Brown Rice", "White Rice", "Wild Rice", "Taco Shells", "Tortilla"];
    herbs = ["Anise", "Basil", "Bay Leaf", "Caper", "Caraway", "Cilantro", "Chives", "Daikon", "Dill", "Fennel", "Lavender", "Lemon Balm", "Lemongrass", "Marjoram", "Mint", "Oregano", "Parsley", "Rosemary", "Sage", "Tarragon", "Thyme", "Watercress"];
    spices = ["Allspice", "Anise", "Star anise", "Black pepper", "Caraway", "Cardamom", "Cayenne pepper", "Celery seed", "Chili pepper", "Cinnamon", "Clove", "Coriander", "Cumin", "Curry powder", "Fennel", "Fenugreek", "Garlic powder", "Horseradish", "Mustard seed", "Nutmeg", "Oregano", "Paprika", "Saffron", "Salt", "Sesame seed", "Sumac", "Turmeric", "Za'atar"];
    condiments = ["Aioli", "Barbecue sauce", "Butter", "Caramel", "Cheese", "Chili oil", "Cream", "Chocolate syrup", "Cocktail sauce", "Fish sauce", "Harissa", "Hoisin sauce", "Honey", "Horseradish", "Hot Sauce", "Hummus", "Ketchup", "Lemon juice", "Lime juice", "Maple syrup", "Mayonnaise", "Mirin", "Dijon Mustard", "Yellow Mustard", "Olive oil", "Oyster sauce", "Peanut butter", "Pesto", "Pico de gallo", "Relish", "Salsa", "Sesame oil", "Sour cream", "Soy sauce", "Steak sauce", "Sriracha sauce","White sugar", "Brown sugar", "Sweet Chili sauce", "Syrup", "Tahini", "Tobasco sauce", "Tartar sauce", "Teriyaki sauce", "Truffle oil", "Tzatziki", "Vanilla extract", "Balsamic vinegar", "White vinegar", "Red Wine vinegar", "Rice Vinegar", "Wasabi", "Whipped cream"]

    letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']

    res.render("search.ejs", {user: req.session.user, keyProteins, veggies, starches, herbs, spices, condiments, letters});
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
                
                if(rows[i].username.toLowerCase() == targetUser){
                    user = {
                        username: rows[i].username,
                        bio: rows[i].bio,
                    }
                    exact.push(user);
                }else if(rows[i].username.toLowerCase().indexOf(targetUser) == 0){
                    user = {
                        username: rows[i].username,
                        bio: rows[i].bio
                    }
                    indexZero.push(user);
                }else{
                    user = {
                        username: rows[i].username,
                        bio: rows[i].bio
                    }
                    others.push(user);
                }
                    
            }
        }
        indexZero.sort(function(a,b){ return a.username.length - b.username.length});     
        others.sort(function(a,b){ return a.username.length - b.username.length});
        var userList = new Array();
        for(var i = 0; i < exact.length; i++)
            userList.push(exact[i]);
        for(var i = 0; i < indexZero.length; i++)
            userList.push(indexZero[i]);
        for(var i = 0; i < others.length; i++)
            userList.push(others[i]);
        userList = userList.filter(e => e.username !== "admin");
        userList = userList.filter(e => e.username !== req.session.user);  
        res.render("results.ejs", {user: req.session.user, message: "Here's who we found", userList});
    });

});

app.get("/results", function(req, res){
    //checks to see if ingredient A contains B by wrapping it around spaces, as opposed to it being just a substring
    function compare(a, b){
        if(a.indexOf(b) == 0){
            if(a.charAt(b.length) == ' ')
                return true;
        }
        else if(a.indexOf(b) + b.length == a.length){
            if(a.charAt(a.indexOf(b) - 1 == ' '))
                return true;
        }
        else if(a.charAt(a.indexOf(b)-1) == ' ' && a.charAt(a.indexOf(b) + b.length) == ' '){
            return true;
        }
        return false;   
    }
    //makes sure ingredients searched won't find hits for edge cases
    function edgeCases(ingredient){
        edges = ["chicken broth", "chicken stock", "beef broth", "beef stock"];
        for(var i = 0; i < edges.length; i++){
            if(ingredient == edges[i]){
                return true;
            }
        }
        return false;
    }
    //if an ingredient in a recipe is the plural of an ingredient searched, then it should be a match
    function plurality(a, b){
        if(a.charAt(a.length-1) == 'y'){
            if(a.substring(0, a.length-2) + "ies" == b)
                return true;
        }
        else if(a + "s" == b){
            return true;
        }
        return false;
    }

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
                    if(lowerKeys.includes(ingredients[j]))
                        matches++;
                    else{
                        ingList = lowerIng.split(", ");
                        for(k = 0; k < ingList.length; k++){
                            if(ingredients[j] == ingList[k]){
                                matches++;
                                break;
                            }
                            else if(ingList[k].includes(ingredients[j])) {
                                if(compare(ingList[k], ingredients[j])){
                                    if(ingredients[j] == "chicken" || ingredients[j] == "beef"){
                                        if(!edgeCases(ingList[k]))
                                            matches++;
                                    }
                                    else
                                        matches++;
                                    break;
                                }
                            }
                            else if(plurality(ingList[k], ingredients[j]) || plurality(ingList[k], ingredients[j]))
                                matches++;
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
                        ingredients: rows[i].ingredients,
                        username: rows[i].username,
                        matches: matches,
                    }
                    dishes[counter] = dish;
                    counter++;
                }
            }
        }
        dishes.sort((a,b) => parseFloat(b.matches/b.ingredients.split(", ").length - parseFloat(a.matches/a.ingredients.split(", ").length)));
        res.render("results.ejs", {user: req.session.user, message: "Here's what you can make", dishes, userSearch: false});
    });
});


app.post("/saveRecipe", requireLogin, function(req, res){
    var id = req.body.id;
    console.log("save");
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
                    httpMsgs.sendJSON(req, res, {
                        from: ""
                    })
                } 
            })
        }
    })
});

app.post("/unSaveRecipe", requireLogin, function(req, res){
    var id = req.body.id;
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
                    httpMsgs.sendJSON(req, res, {
                        from: ""
                    })
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
            httpMsgs.sendJSON(req, res, {
                from: ""
            })
        }
    })
});



app.post("/saveIngredients", requireLogin, function(req, res){
    var id = req.body.id;
    var ingredients = req.body.ingredientString;
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
                    httpMsgs.sendJSON(req, res, {
                        from: ""
                    })
                }
            })
        }
    })
});



app.post("/deleteIngredient", function(req, res){
    var index = req.body.index;
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
                    httpMsgs.sendJSON(req, res, {
                        from: ""
                    })
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
            httpMsgs.sendJSON(req, res, {
                from: ""
            })
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
                if(!req.session.user){
                    res.render("recipe.ejs", {user: req.session.user, saved: false, dishName, instructions, ingredients, ingredientString, image, id, snipbit, username, cuisine});
                }else{
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
                
                
        }      
    });
    
});




function loggingIn(landing, req, res){
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
                           res.redirect(landing);
                       }else{
                           success = true;
                           res.render("login.ejs", {message: "Incorrect Password", message2: ""});
                       }
                   }
               }
               if(!success)
                    res.render("login.ejs", {message: "Username does not exist", message2: ""});
            }
        });
    }
}
app.post("/login/:id", function(req, res){
    const {id} = req.params;
    loggingIn("/recipe/" + id, req, res);

});

app.post("/login", function(req, res){
    loggingIn("/home", req, res);
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
                db.query("Insert into recipe (name, picture, cuisine, snipbit, ingredients, instructions, username, keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [req.body.rName, imgName, req.body.cuisine, req.body.snipbit, req.body.ingredients, req.body.instructions, req.session.user, keyString], function(err, result){   
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
        res.render("login.ejs", {message: "", message2: "Username must be at least 6 characters"});
        valid = false;
    }
    else if(req.body.email.indexOf('@') == -1 || req.body.email.length == 0){
        res.render("login.ejs", {message: "", message2: "Invalid email address"});
        valid = false;
    }
    else if(req.body.pWord.length < 6){
        res.render("login.ejs", {message: "", message2: "Password must be at least 6 characters"});
        valid = false;
    }
    else if(req.body.cPword != req.body.pWord){
        res.render("login.ejs", {message: "", message2: "Passwords do not match"});
        valid = false;
    }
    else if(valid){
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

    if(!req.session.user || req.session.user != "admin")
        res.redirect("/login");
    else{
        
    const dishes = new Array ();

    db.query("Select * from top10 order by positionId", function(error, rows){

        if(error){
            throw error;
        }
        else{
        
             
            for(i=0; i<rows.length; i++){

                dishes[i] = rows[i].dishId;

            }
            
            keyWords = ["Chicken", "Beef", "Pork", "Lamb", "Fish", "Seafood", "Pasta", "Rice", "Stirfry", "Soup", "Stew", "Salad", "Vegeterian"];

            res.render("admin.ejs", {message : "", keyWords, dishes});
        }
        
    }); 
    }

});

app.post("/deleteRecipe/:id", function(req, res){
    console.log(2);
    const {id} = req.params;
    db.query("Update recipe set username = 'Community Pantry' where id = '"+id+"'", function(err, result){
        if(err){
            throw err;
        }
        else{
            res.redirect("/home"); 
        }
    })
});

app.post("/deleteRecipe", function(req, res){
    console.log(1);
    console.log([req.body.recipe]);
    db.query("Update recipe set username = 'Community Pantry' where id = '"+[req.body.recipe]+"'", function(err, result){
        if(err){
            throw err;
        }
        else{
            res.redirect("/admin"); 
        }
    })
});


app.post("/deleteuser", function(req, res){
    db.query("update recipe set username = 'Community Pantry' where username = ?",[req.body.username], function(err, result){   
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

app.get('/logout', function(req, res) {
    req.session.reset();
    res.redirect('/search');
});

app.get("/login/:id", function(req, res){
    res.render("login.ejs", {message: "", message2: "", id : req.params.id});
});

app.get("/login", function(req, res){
    res.render("login.ejs", {message: "", message2: "", id: -1});
});

app.get("/", function(req, res){
    res.redirect("/search");
});


app.listen(3000, function(){
    console.log("Server running on port 3000")
});
