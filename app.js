var express = require("express")
var app = express();
var mysql = require("mysql");
var bodyParser = require("body-parser");
var session = require('client-sessions');
var upload = require('express-fileupload');
//var busboy = require('connect-busboy');
var path = require('path');
var url = require('url');
var fs = require('fs');
var httpMsgs = require('http-msgs')
const { isNull } = require("util");
const { get } = require("http");

app.use(bodyParser.urlencoded({extended: true}));
app.set('views', __dirname + '/views');
app.set("view engine", "ejs");
//var publicDir = require('path').join(__dirname,'/public'); 
app.use(express.static(path.join(__dirname,'public'))); 
app.use(bodyParser.json());
app.use(upload());
//app.use(busboy());

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

/**
 * This function allows the active user to be stored in the session's cookie
 * @param req data from request
 * @param res response
 * @param next middleware
 */
app.use(function(req, res, next) {
    if (req.session && req.session.user) { 
          user = req.session.user;    
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

/**
 * This function prevents caching
 * @param req data from request
 * @param res response
 * @param next middleware
 */
app.use(function (req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next()
});

/**
 * This function gets called in routes that require a user's session to be active. If a user session does not exist, the user gets redirected to the login page
 * @param req request
 * @param res response
 * @param next middleware
*/
function requireLogin(req, res, next) {
    if (!req.session.user) {
       res.redirect("/login");
    } else {
      next();
    }
};

/**
* This route generates the user's home page.
* @param req is the data coming from the request
* @param res is the response
*/
app.get("/home", requireLogin, function(req, res){
    /**
     * @returns shoppingList and id's of likedRecipes belonging to the active user
     */
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

    /**
     * @returns the recipes created by the active user
     */
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

    /**
     * @param id id of likedRecipe
     * @returns an object containing the fields of the likedRecipe
     */
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

    /**
     * @returns bio of the active user
     */
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

    /**
     * This function calls the above functions, forcing the program to wait until they are all finishing
     */
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

/**
 * This route generates pages owned by users other than the current active user
 * @param req request
 * @param res response
 */
app.get("/user/:user", function(req, res){
    const {user} = req.params;
    /**
     * @returns id's of likedRecipes belonging to the active user
     */
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
    /**
     * @returns the recipes created by the user we are viewing
     */
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
    /**
     * @param id id of likedRecipe
     * @returns an object containing the fields of the likedRecipe
     */
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
    /**
     * @returns bio of the user we are trying to view
     */
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

    /**
     * This function calls the above functions, forcing the program to wait until they are all finishing
     */
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

/**
 * Gets top 10 recipes.
 * @param {*} req request
 * @param {*} res response
 * @param {*} message the message will showed on the admin page after admin performs an action
 */
function getTop10(req, res, message){
    const dishes = new Array ();
    db.query("Select * from recipe, top10 WHERE recipe.id =top10.dishid order by positionId", function(error, rows){
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
            if(message){
                keyWords = ["Chicken", "Beef", "Pork", "Lamb", "Fish", "Seafood", "Pasta", "Rice", "Stirfry", "Soup", "Stew", "Salad", "Vegeterian"];
                for(var i = 0; i < dishes.length; i++){
                    dishes[i] = dishes[i].id;
                }
                res.render("admin.ejs", {message, keyWords, dishes});
            }
            else
                res.render("top10.ejs", {dishes, user: req.session.user});
        }
        
    });
}
/**
 * This route allows the admin user to enter the id values of recipes to create the top 10
 * @param req request
 * @param res response
 */
app.post("/settop10", function(req, res){
    var valid = true;
    ids = [req.body.first, req.body.second, req.body.third, req.body.fourth, req.body.fifth, req.body.sixth, req.body.seventh, req.body.eighth, req.body.ninth, req.body.tenth];
    db.query("SELECT id FROM recipe", function(error, rows){
        if(error){
            throw error;
        }
        for(var i = 0; i < ids.length; i++){
            var match = false;
            if(ids[i] == ''){
                valid = false;
                res.send("null value was entered");
                return;
            }
            for(var j = 0; j < rows.length; j ++){
                if(ids[i] == rows[j].id){
                    match = true;
                    break;
                }

            }
            if(!match){
                valid = false;
                getTop10(req, res, "Error: Recipe " + ids[i] + " does not exist");
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
            getTop10(req, res, "Success!");
            //res.redirect("/admin");
        }
    });  
});

/**
 * This route generates the top 10 page
 * @param req request
 * @param res response
 */
app.get("/top10", function(req, res){
    getTop10(req, res, "");
});

/**
 * This route generates the search page
 * @param req request
 * @param res response
 */
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

/**
 * Finds matches for the search term
 * @param name name of search term
 * @param rows the rows returned from DB query
 * @param type if we are searching for dishes or for users
 * @returns a list of matches for the search term
 */
function search(name, rows, type){
    var exact = new Array();
    var indexZero = new Array();
    var others = new Array()
    for(var i = 0; i < rows.length; i++){
        if(type == "dish"){
            if(rows[i].name.toLowerCase().includes(name)){
                dish = {
                        id: rows[i].id,
                        name:rows[i].name,
                        picture: rows[i].picture,
                        snipbit: rows[i].snipbit,
                        cuisine: rows[i].cuisine,
                        username: rows[i].username
                }
                if(rows[i].username.toLowerCase() == name){
                    exact.push(dish);
                }else if(rows[i].name.toLowerCase().indexOf(name) == 0){
                    indexZero.push(dish);
                }else{
                    others.push(dish);
                }     
            }
        }
        else if(type == "user"){
            if(rows[i].username.toLowerCase().includes(name)){                  
                user = {
                        username: rows[i].username,
                        bio: rows[i].bio,
                }
                if(rows[i].username.toLowerCase() == name){
                    exact.push(user);
                }else if(rows[i].username.toLowerCase().indexOf(name) == 0){
                    indexZero.push(user);
                }else{
                    others.push(user);
                }
                    
            }
        }               
    }
    if(type == "dish"){
        indexZero.sort(function(a,b){ return a.name.length - b.name.length});     
        others.sort(function(a,b){ return a.name.length - b.name.length});
    }
    else if(type == "user"){
        indexZero.sort(function(a,b){ return a.username.length - b.username.length});     
        others.sort(function(a,b){ return a.username.length - b.username.length});
    }
    var list = new Array();
    for(var i = 0; i < exact.length; i++)
        list.push(exact[i]);
    for(var i = 0; i < indexZero.length; i++)
        list.push(indexZero[i]);
    for(var i = 0; i < others.length; i++)
        list.push(others[i]);
    return list;
}

/**
 * Generates the result page when searching for a dish
 * @param req request
 * @param res response
 */
app.get("/results/dish", function(req, res){
    var dishName = url.parse(req.url, true).query.dishName;
    db.query("Select * from recipe", function(error, rows){
        if(error){
            throw error;
        }
        else{
            dishes = search(dishName, rows, "dish");
        }
        res.render("results.ejs", {user: req.session.user, message: "Results for " + dishName, dishes, userSearch: false});
    });
    
    
});

/**
 * Generates the result page when searching for another user
 * @param req request
 * @param res response
 */
app.get("/results/users", function(req, res){
    var targetUser = url.parse(req.url, true).query.targetUser.toLowerCase();
    db.query("SELECT * FROM user", function(err, rows){
        if(err){
            throw err;
        }
        else{
            var userList = search(targetUser, rows, "user");
            userList = userList.filter(e => e.username !== "admin");
            userList = userList.filter(e => e.username !== req.session.user);  
            res.render("results.ejs", {user: req.session.user, message: "Here's who we found", userList});  
        }
    });
});

/**
 * Generates the result page for searching a cusine
 * @param req request
 * @param res response
 */
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

/**
 * Generates result page when searching by ingredients
 * @param req request
 * @param res response
 */
app.get("/results", function(req, res){
    /**
     * Checks to see if ingredient A contains B by wrapping it around spaces, as opposed to it being just a substring
     * @param a the superset string
     * @param b the subset string
     * @returns true if A contains B by wrapping it around spaces. False if not
     */
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
    /**
     * makes sure ingredients searched won't find hits for edge cases
     * @param ingredient the ingredient that we are inspecting
     * @returns true if this ingredient falls under in edge case, which implies that we are not counting this string as a match. False if it is not an edge case
     */
    function edgeCases(ingredient){
        edges = ["chicken broth", "chicken stock", "beef broth", "beef stock"];
        for(var i = 0; i < edges.length; i++){
            if(ingredient == edges[i]){
                return true;
            }
        }
        return false;
    }
    /**
     * Checks if a string A is the singular form of string B
     * @param a a string we are testing
     * @param b a string we are testing
     * @returns true if string A is the singular form of string B, false if not
     */
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
            var keyMatches;
            for(i=0; i<rows.length; i++){              
                lowerIng = rows[i].ingredients.toLowerCase();
                if(!rows[i].keywords)
                    lowerKeys = "";
                else
                    lowerKeys = rows[i].keywords.toLowerCase();
                matches = 0;
                keyMatches = 0;
                for(j=0; j<ingredients.length; j++){
                    var found = false;
                    ingList = lowerIng.split(", ");
                    for(k = 0; k < ingList.length; k++){
                        if(ingredients[j] == ingList[k]){
                            matches++;
                            found = true;
                            break;
                        }
                        else if(ingList[k].includes(ingredients[j])) {
                            if(compare(ingList[k], ingredients[j])){
                                if(ingredients[j] == "chicken" || ingredients[j] == "beef"){
                                    if(!edgeCases(ingList[k])){
                                        matches++;
                                        found = true;
                                    }
                                }
                                else{
                                    matches++;
                                    found = true;
                                }
                                break;
                            }
                        }
                        else if(plurality(ingList[k], ingredients[j]) || plurality(ingList[k], ingredients[j])){
                            matches++;
                            found = true;
                            break;
                        }
                    }
                    if(!found && lowerKeys.includes(ingredients[j])){
                        keyMatches++;
                        break;
                    }

                }
                if(matches > 0 || keyMatches > 0){
                    dish = {
                        id: rows[i].id,
                        name:rows[i].name,
                        picture: rows[i].picture,
                        snipbit: rows[i].snipbit,
                        cuisine: rows[i].cuisine,
                        ingredients: rows[i].ingredients,
                        username: rows[i].username,
                        matches: matches,
                        keyMatches: keyMatches,
                    }
                    dishes[counter] = dish;
                    counter++;
                }
            }
        }
        var matchFromKeys = new Array();
        var matchFromIngs = new Array();
        for(var i = 0; i < dishes.length; i++){
            if(dishes.matches == 0)
                matchFromKeys.push(dishes[i]);
            else
                matchFromIngs.push(dishes[i]);
        }
        matchFromIngs.sort((a,b) => parseFloat(b.matches/b.ingredients.split(", ").length - parseFloat(a.matches/a.ingredients.split(", ").length)));
        matchFromKeys.sort((a,b) => b.keyMatches - a.keyMatches);
        dishes = matchFromIngs;
        for(var i = 0; i < matchFromKeys.length; i++)
            dishes.push(matchFromKeys[i]);
        res.render("results.ejs", {user: req.session.user, message: "Here's what you can make", dishes, userSearch: false});
    });
});

/**
 * Adds a recipe to the active user's liked recipes
 * @param req request
 * @param res response
 */
app.post("/saveRecipe", requireLogin, function(req, res){
    var id = req.body.id;
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

/**
 * Removes a recipe from the active user's liked recipes
 * @param req request
 * @param res response
 */
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

/**
 * Empties the active user's liked recipes
 * @param req request
 * @param res response
 */
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


/**
 * Adds the recipe's ingredienet list to the active user's shopping list
 * @param req request
 * @param res response
 */
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


/**
 * Removes selected ingredient from active user's ingredient list
 * @param req request
 * @param res response
 */
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

/**
 * Removes all ingredient from active user's ingredient list
 * @param req request
 * @param res response
 */
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

/**
 * Generates a recipe page
 * @param req request
 * @param res response
 */
app.get("/recipe/:id", function(req, res){
    const {id} = req.params;
    var success = false;
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


/**
 * Verifies a user's log in credentials. If they were on a recipe page, they will be redirected back to that page. Otherwise they are sent to the home page
 * @param {*} landing string that shows where the user will be directed to
 * @param {*} req request
 * @param {*} res response
 */
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
                       if(rows[i].pWord == req.body.pword){
                           success = true;
                           req.session.user = req.body.username;
                           res.redirect(landing);
                       }else{
                           success = true;
                           res.render("login.ejs", {message: "Incorrect Password", message2: "", id: landing.substring(8, landing.length)});
                       }
                   }
               }
               if(!success)
                    res.render("login.ejs", {message: "Username does not exist", message2: "", id: landing.substring(8, landing.length)});
            }
        });
    }
}

/**
 * logging in when the user was previously at a recipe page
 * @param req request
 * @param res response
 */
app.post("/login/:id", function(req, res){
    const {id} = req.params;
    loggingIn("/recipe/" + id, req, res);

});

/**
 * logging in
 * @param req request
 * @param res response
 */
app.post("/login", function(req, res){
    loggingIn("/home", req, res);
});

/**
 * A user creates a recipe
 * @param req request
 * @param res response
 */
app.post("/createRecipe/:username", function(req, res){
    db.query("SELECT MAX(id) as max FROM recipe", function(err, result){
        var keys = Object.keys(req.body);
        keys.splice(0,5);
        var keyString = keys.join(",")
        var file = req.files.image;
        var user = req.session.user;
        if(user == "admin") user = "Community Pantry";
        file.name = (result[0].max+1).toString() + ".jpg";
        var imgName = "/recipe_images/"+file.name;
        if(file.mimetype == "image/jpeg" ||file.mimetype == "image/png"||file.mimetype == "image/gif" ){                               
            file.mv('public/recipe_images/'+file.name, function(err) {                      
                if (err)
                  return res.status(500).send(err);
                db.query("Insert into recipe (name, picture, cuisine, snipbit, ingredients, instructions, username, keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [req.body.rName, imgName, req.body.cuisine, req.body.snipbit, req.body.ingredients, req.body.instructions, user, keyString], function(err, result){   
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
          res.redirect("/home");
        } 
    }); 	    
});

/**
 * A user updates their profile photo
 * @param req request
 * @param res response
 */
app.post("/updateProfilePhoto", function(req, res){
    var file = req.files.image;
    file.name = req.session.user + ".jpg";
    if(file.mimetype == "image/jpeg"){
        file.mv('public/profile_images/'+file.name, function(err){
            res.redirect("/home");
        });
    }
    else{
        console.log("Photo type not jpg");
        res.redirect("/home");
    }
});

/**
 * A user can change their bio
 * @param req request
 * @param res response
 */
app.post("/updateBio", function(req, res){
    db.query("update user set bio = ? where username = '"+req.session.user+"'",[req.body.bio], function(err, rows){
        if(err)
            throw err;
        else{
            res.redirect("/home");
        }
    });
});

/**
 * A user creating their account
 * @param req request
 * @param res response
 */
app.post("/createAccount", function(req, res){
    var valid = true;
    if(req.body.uName.length < 6 || req.body.uName.length > 20){
        res.render("login.ejs", {message: "", message2: "Username must be 6-20 characters", id: -1});
        valid = false;
    }
    else if(req.body.email.indexOf('@') == -1 || req.body.email.length == 0){
        res.render("login.ejs", {message: "", message2: "Invalid email address", id:-1});
        valid = false;
    }
    else if(req.body.pWord.length < 6 || req.body.pWord.length > 30){
        res.render("login.ejs", {message: "", message2: "Password must be 6-30 characters", id:-1});
        valid = false;
    }
    else if(req.body.cPword != req.body.pWord){
        res.render("login.ejs", {message: "", message2: "Passwords do not match", id:-1});
        valid = false;
    }
    else if(valid){
        db.query("Insert into user (username, email, pWord, shoppingList, likedRecipes, bio) VALUES (?, ?, ?, '', '', '')", [req.body.uName, req.body.email, req.body.pWord], function(err, result){   
            if(err){
                res.render("login.ejs", {message: "", message2: "This username already exists", id: -1});
            }
            else{
                req.session.user = req.body.uName;
                res.redirect("/home");
            }
        });
    }
});

/**
 * Generates the admin page
 * @param req request
 * @param res response
 */
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

/**
 * A user changing ownership of a recipe to admin
 * @param req request
 * @param res response
 */
app.post("/deleteRecipe/:id", function(req, res){
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

/**
 * An admin changing ownership of a recipe to admin
 * @param req request
 * @param res response
 */
app.post("/deleteRecipe", function(req, res){
    db.query("Select * FROM recipe where id = ?", [req.body.recipe], function(err, result){
        if(!result.length){
            getTop10(req, res, "Error: recipe " +req.body.recipe+ " does not exist");
        }
        else{
            db.query("Update recipe set username = 'Community Pantry' where id = '"+[req.body.recipe]+"'", function(err, result){
                if(err){
                    throw err;
                }
                else{
                   getTop10(req, res, "Success!");
                }
            })
        }    
    }) 
});

/**
 * An admin deleting a user account. If the user made recipes, they get switched to admin ownership
 * @param req request
 * @param res response
 */
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

                    path = "public/profile_images/" + req.body.username + ".jpg";
                    try{
                        fs.unlinkSync(path);
                    }catch(err){
                        console.log(err);
                    }

                    if(!result.affectedRows){
                        getTop10(req, res, "Error: user " +req.body.username+ " does not exist");
                    }
                    else
                        getTop10(req, res, "Success!");
                }
            });
        }
    });

});

/**
 * Ends the users session
 * @param req request
 * @param res response
 */
app.get('/logout', function(req, res) {
    req.session.reset();
    res.redirect('/search');
});

/**
 * Generates the login page when a user was previously at a recipe page
 * @param req request
 * @param res response
 */
app.get("/login/:id", function(req, res){
    res.render("login.ejs", {message: "", message2: "", id : req.params.id});
});

/**
 * Generates the login page
 * @param req request
 * @param res response
 */
app.get("/login", function(req, res){
    res.render("login.ejs", {message: "", message2: "", id:-1});
});

/**
 * Generates the search page
 * @param req request
 * @param res response
 */
app.get("/", function(req, res){
    res.redirect("/search");
});


app.listen(3000, function(){
    console.log("Server running on port 3000")
});

