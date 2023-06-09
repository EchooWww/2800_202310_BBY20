// Importing modules and dependencies
require("./utils.js"); // Importing custom module from "./utils.js"
require("dotenv").config(); // Loading environment variables from ".env" file
const express = require("express"); // Importing Express framework
const session = require("express-session"); // Importing Express session module
const mongodb = require("mongodb"); // Importing MongoDB module
const MongoStore = require("connect-mongo"); // Importing MongoStore module for session storage
const bcrypt = require("bcrypt"); // Importing bcrypt module for password hashing
const port = process.env.PORT || 3030; // Setting the port number from environment variable or using default value 3030
const app = express(); // Creating an instance of the Express application
const Joi = require("joi"); // Importing Joi for input validation
const { ObjectId } = require("mongodb"); // Importing ObjectId from MongoDB for working with document IDs
const saltRounds = 12;

// Session Expiry time set to 1 hour
const expireTime = 1 * 60 * 60 * 1000;

app.set("view engine", "ejs"); // Set the view engine to EJS for rendering views/templates

//-------------------------------------------------------------------------

/* secret information section */

// MongoDB connection details
const mongodb_host = process.env.MONGODB_HOST; // MongoDB host address
const mongodb_user = process.env.MONGODB_USER; // MongoDB username
const mongodb_password = process.env.MONGODB_PASSWORD; // MongoDB password
const mongodb_database = process.env.MONGODB_DATABASE; // MongoDB database name

// Session secret keys
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET; // MongoDB session secret
const node_session_secret = process.env.NODE_SESSION_SECRET; // Node session secret

// API key for Google Maps
const map_api = process.env.GOOGLE_MAPS_API_KEY; // Google Maps API key

//-------------------------------------------------------------------------

/* Setting up Database connections to MongoDB */
var { database } = include("databaseConnection");

const userCollection = database.db(mongodb_database).collection("users"); // Accessing the "users" collection in the MongoDB database
const foodCollection = database
  .db(mongodb_database)
  .collection("fastfoodnutrition"); // Accessing the "fastfoodnutrition" collection in the MongoDB database

//-------------------------------------------------------------------------

// Navbar links
const url = require("url"); // Importing the "url" module
const navLinks = [
  { name: "Home", link: "/home", file: "icon-home" }, // Object representing a navbar link for the "Home" page
  { name: "Menu", link: "/restaurant", file: "icon-menu" }, // Object representing a navbar link for the "Menu" page
  { name: "Chat", link: "/chat", file: "icon-chatbot" }, // Object representing a navbar link for the "Chat" page
];

//-------------------------------------------------------------------------

/* Setting up Middleware */

// Middleware for global variables
app.use("/", (req, res, next) => {
  app.locals.navLinks = navLinks; // Makes the "navLinks" array available as a local variable in views/templates
  app.locals.currentURL = url.parse(req.url, false, false).pathname; // Stores the current URL path as a local variable in views/templates
  app.locals.searchList = searchList; // Makes the "searchList" variable available as a local variable in views/templates
  app.locals.compareList = compareList; // Makes the "compareList" variable available as a local variable in views/templates
  next(); // Calls the next middleware function
});

app.use(express.urlencoded({ extended: false })); // Middleware for parsing URL-encoded data
app.use(express.json()); // Middleware for parsing JSON data

app.use(express.static("app")); // Middleware for serving static files from the "app" directory

app.use("/img", express.static("./public/images")); // Middleware for serving static files from the "./public/images" directory under the "/img" URL path
app.use("/css", express.static("./public/css")); // Middleware for serving static files from the "./public/css" directory under the "/css" URL path

//-------------------------------------------------------------------------

// Creates a session store used to store session data in MongoDB
var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`, // MongoDB connection URL for the session store
  crypto: {
    secret: mongodb_session_secret, // Secret used for encrypting and signing session data
  },
});

// Middleware for session management in Express
app.use(
  session({
    secret: node_session_secret, // Secret used for signing the session ID cookie
    store: mongoStore, // Session store used to store session data in MongoDB
    saveUninitialized: false, // Indicates whether to save uninitialized sessions to the store
    resave: true, // Indicates whether to save the session back to the store, even if it wasn't modified
  })
);

//-------------------------------------------------------------------------

// Async Function to Calculate Tray Nutrition Total Banner
async function calculateTotals(username) {
  const userCollection = database.db(mongodb_database).collection("users"); // Access the "users" collection from the MongoDB database
  const user = await userCollection.findOne({ username: username }); // Find the user document with the specified username

  const trayItems = (user && user.trayItems) || []; // Retrieve the "trayItems" array from the user document, or use an empty array if it doesn't exist

  // Initialize variables for calculating totals
  let totalCalories = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFat = 0;

  trayItems.forEach((item) => {
    // Calculate totals by iterating over each item in the "trayItems" array
    totalCalories += item.calories;
    totalCarbs += item.total_carb;
    totalProtein += item.protein;
    totalFat += item.total_fat;
  });

  // Return the calculated totals and tray items as an object
  return {
    totalCalories,
    totalCarbs,
    totalProtein,
    totalFat,
    trayItems,
  };
}

/* GPT_Promt */
// Middleware function to calculate total nutritional value of tray
app.use(async (req, res, next) => {
  try {
    const username = req.session.username; // Retrieve the username from the session
    const totals = await calculateTotals(username); // Calculate the totals using the `calculateTotals` function
    Object.assign(res.locals, totals); // Assign the calculated totals to `res.locals` for access in the views
    next(); // Proceed to the next middleware
  } catch (error) {
    res.status(500).send("Internal Server Error"); // Return a 500 error response if an error occurs
  }
});

//-------------------------------------------------------------------------

// Route for root URL "/"
app.get("/", async (req, res) => {
  if (!req.session.authenticated) {
    // Check if the user is not authenticated (not logged in)
    res.render("index_before_login"); // Render the "index_before_login" view
    return; // Return to exit the function and prevent further execution
  } else {
    var username = req.session.username; // Retrieve the username from the session
    const result = await userCollection
      .find({ username: username })
      .project({
        firstName: 1,
        calorieNeeds: 1,
        protein: 1,
        carbs: 1,
        fat: 1,
      })
      .toArray(); // Find the user document with the specified username and retrieve specific fields

    res.render("home", {
      // Render the "home" view with the following variables
      name: result[0].firstName, // Pass the user's first name
      calorie_goal: result[0].calorieNeeds, // Pass the user's calorie goal
      carbs_goal: result[0].carbs, // Pass the user's carbs goal
      protein_goal: result[0].protein, // Pass the user's protein goal
      fat_goal: result[0].fat, // Pass the user's fat goal
      map_api: map_api, // Pass the Google Maps API key
    });
  }
});

//-------------------------------------------------------------------------

/* New User Creation Section */

// Route for rendering the signup form
app.get("/signup", (req, res) => {
  res.render("signup"); // Render the "signup" view
});

// Route for submitting the user registration form
app.post("/submitUser", async (req, res) => {
  var username = req.body.username;
  var firstName = req.body.firstName;
  var lastName = req.body.lastName;
  var email = req.body.email;
  var birthday = req.body.birthday;
  var password = req.body.password;
  compareList = [];

  // Validate user input for the registration form

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  if (!firstName) {
    return res.status(400).json({ error: "First name is required" });
  }

  if (!lastName) {
    return res.status(400).json({ error: "Last name is required" });
  }

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!birthday) {
    return res.status(400).json({ error: "Birthday is required" });
  }

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (username.length < 5 || username.length > 20) {
    return res
      .status(400)
      .json({ error: "Username must be between 5 and 20 characters" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  /* GPT_Promt_2 */
  // Check if username or email already exists in the database
  const existingUser = await userCollection.findOne({
    username: username,
  });
  const existingEmail = await userCollection.findOne({
    email: email,
  });

  if (existingUser) {
    // Render an error message indicating that the username or email is already taken
    return res.status(400).json({ error: "Username is already taken" });
  }
  if (existingEmail) {
    // Render an error message indicating that the username or email is already taken
    return res.status(400).json({ error: "Email already exists" });
  }

  // Schema validation using Joi
  const schema = Joi.object({
    username: Joi.string().alphanum().max(20).required(),
    firstName: Joi.string().max(20).required().allow(" "),
    lastName: Joi.string().max(20).required().allow(" "),
    email: Joi.string().max(30).required(),
    birthday: Joi.string()
      .regex(/^(\d{4})-(\d{2})-(\d{2})$/)
      .required(),
    password: Joi.string().max(20).required(),
  });

  const validationResult = schema.validate({
    username,
    firstName,
    lastName,
    email,
    birthday,
    password,
  });
  // If there are validation errors, log the errors and redirect back to the signup page
  if (validationResult.error != null) {
    res.json({ redirect: "/signup" });
    return;
  }
  var hashedPassword = await bcrypt.hash(password, saltRounds); // Hash the password using bcrypt
  await userCollection.insertOne({
    // Insert the user document into the userCollection
    username: username,
    firstName: firstName,
    lastName: lastName,
    email: email,
    birthday: birthday,
    password: hashedPassword,
    user_type: "user",
    compareItems: [],
    trayItems: [],
  });
  req.session.authenticated = true; // Set the session authenticated flag to true
  req.session.username = username; // Store the username in the session
  req.session.cookie.maxAge = expireTime; // Set the session cookie maxAge
  res.json({ redirect: "/security_questions" }); // Redirect to the security questions page
  return;
});

//-------------------------------------------------------------------------

/* Set Security Questions Section for New User*/

// Route for rendering the security questions form
app.get("/security_questions", (req, res) => {
  res.render("security_questions"); // Render the "security_questions" view
});

// Route for submitting the security answers form
app.post("/security_answers", async (req, res) => {
  const { question1, question2, question3 } = req.body; // Retrieve the answers from the request body
  const questions = [
    {
      question: "What is your mother's maiden name?",
      answer: await bcrypt.hash(question1, saltRounds), // Hash the answer using bcrypt
    },
    {
      question: "What was the name of your first pet?",
      answer: await bcrypt.hash(question2, saltRounds), // Hash the answer using bcrypt
    },
    {
      question: "What is your favorite color?",
      answer: await bcrypt.hash(question3, saltRounds), // Hash the answer using bcrypt
    },
  ];

  // Update the user document with the security questions and hashed answers
  await userCollection.updateOne(
    { username: req.session.username },
    {
      $set: {
        questions: questions,
      },
    },
    (err, result) => {
      if (err) {
        console.error(err);
      }
    }
  );

  res.redirect("/signup_profile"); // Redirect to the signup profile page
  return;
});

//-------------------------------------------------------------------------

/* Set Profile Preference for Nutritional Goal calculations */

// Route for rendering the signup_profile page
app.get("/signup_profile", (req, res) => {
  res.render("signup_profile");
});

// Function to calculate the BMR based on user input in the signup_profile form
function calculateBMR(sex, weight, height, birthday) {
  let BMR;
  let age = calculateAge(birthday);
  if (sex === "female") {
    BMR = 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;
  } else {
    BMR = 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
  }
  return BMR;
}

// Function to calculate the age based on user's birthday in the signup_profile form
function calculateAge(birthday) {
  const today = new Date();
  const birthDate = new Date(birthday);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

// function to calculate the calorie needs based on user input in the signup_profile form
function calculateCalorieNeeds(sex, birthday, height, weight, activity, goal) {
  let BMR = calculateBMR(sex, weight, height, birthday);
  let calorieNeeds;
  switch (activity) {
    case "sedentary":
      calorieNeeds = Math.round(BMR * 1.2);
      break;
    case "lightly-active":
      calorieNeeds = Math.round(BMR * 1.375);
      break;
    case "moderately-active":
      calorieNeeds = Math.round(BMR * 1.55);
      break;
    case "very-active":
      calorieNeeds = Math.round(BMR * 1.725);
      break;
    case "super-active":
      calorieNeeds = Math.round(BMR * 1.9);
      break;
    default:
      calorieNeeds = 0;
  }
  if (goal === "lose-weight") {
    calorieNeeds -= 300;
  } else if (goal === "gain-muscle") {
    calorieNeeds += 200;
  }
  return calorieNeeds;
}

// function to calculate the macronutrients based on user input in the signup_profile form
function calculateMacronutrients(calorieNeeds, goal) {
  let carbPercentage, proteinPercentage, fatPercentage;
  if (goal === "weight loss") {
    carbPercentage = 0.5;
    proteinPercentage = 0.3;
    fatPercentage = 0.2;
  } else if (goal === "muscle gain") {
    carbPercentage = 0.4;
    proteinPercentage = 0.35;
    fatPercentage = 0.25;
  } else {
    carbPercentage = 0.5;
    proteinPercentage = 0.2;
    fatPercentage = 0.3;
  }

  const protein = Math.round((calorieNeeds * proteinPercentage) / 4);
  const fat = Math.round((calorieNeeds * fatPercentage) / 9);
  const carbs = Math.round((calorieNeeds * carbPercentage) / 4);

  return { protein, fat, carbs };
}

// Route for processing the form submission from signup_profile page
app.post("/onboarding_goal", async (req, res) => {
  // Extracting the form data from the request body
  const { sex, height, weight, activity, goal } = req.body;
  // Retrieving the user from the user collection based on the session username
  const user = await userCollection.findOne({ username: req.session.username });
  // Extracting the birthday from the user object
  const birthday = user.birthday;
  // Calculating the calorie needs based on the form data and user's birthday
  const calorieNeeds = calculateCalorieNeeds(
    sex,
    birthday,
    height,
    weight,
    activity,
    goal
  );
  // Calculating the macronutrient values (protein, fat, carbs) based on weight, calorie needs, and goal
  const { protein, fat, carbs } = calculateMacronutrients(calorieNeeds, goal);
  // Updating the user document in the user collection with the new profile preferences
  await userCollection.updateOne(
    { username: req.session.username },
    {
      $set: {
        sex,
        height,
        weight,
        activity,
        goal,
        calorieNeeds,
        protein,
        fat,
        carbs,
      },
    },
    (err, result) => {
      if (err) {
        console.error(err);
      }
    }
  );
  // Rendering the onboarding_goal page and passing the calculated values as data
  res.render("onboarding_goal", {
    calorieNeeds,
    protein,
    fat,
    carbs,
  });
});

//-------------------------------------------------------------------------

/* Login Validation */

// Route for rendering the login page
app.get("/login", (req, res) => {
  res.render("login");
});

// Route for processing the login form submission
app.post("/loggingIn", async (req, res) => {
  // Extracting the username and password from the request body
  var username = req.body.username;
  var password = req.body.password;

  if (!username) {
    res.status(400).json({ error: "Please enter a username" });
    return;
  }
  if (!password) {
    res.status(400).json({ error: "Please enter a password" });
    return;
  }

  // Validation schema using Joi to ensure the username is alphanumeric and has a maximum length of 20 characters
  const schema = Joi.string().alphanum().max(20).required();
  const validationResult = schema.validate(username);

  // Checking if there is an error in the validation result
  if (validationResult.error != null) {
    res.status(400).json({ error: "Please enter a valid username" });
    return;
  }

  // Searching for the user in the user collection based on the username
  const result = await userCollection
    .find({ username: username })
    .project({ username: 1, password: 1, user_type: 1, _id: 1, firstName: 1 })
    .toArray();

  // Checking if a user with the given username exists
  if (result.length != 1) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  // Comparing the provided password with the hashed password stored in the user document
  if (await bcrypt.compare(password, result[0].password)) {
    // Setting session variables to store user information
    req.session.authenticated = true;
    req.session.username = result[0].username;
    req.session.firstName = result[0].firstName;
    req.session.user_type = result[0].user_type;
    req.session.cookie.maxAge = expireTime;
    res.json({ redirect: "/home" });
    return;
  } else {
    res.status(400).json({ error: "Incorrect password" });
    return;
  }
});

//-------------------------------------------------------------------------

/* Reset Password Section */

// Route for rendering the forgot password page
app.get("/forgot", (req, res) => {
  // Array of security questions
  const questions = [
    { question: "What is your mother's maiden name?" },
    { question: "What was the name of your first pet?" },
    { question: "What is your favorite color?" },
  ];
  res.render("forgot", { questions });
});

// Route for processing the password reset form submission
app.post("/reset_password", async (req, res) => {
  // Extracting the form data from the request body
  const { username, answer, questionIndex } = req.body;
  const newPassword = req.body.password;

  // Searching for the user in the user collection based on the username
  const user = await userCollection.findOne({ username: username });
  if (!user) {
    // User not found, redirecting to the forgot password page with an alert message
    res.status(400).json({ error: "User not found!" });
    return;
  }

  // Checking if the provided answer matches the stored answer for the selected security question
  const question = user.questions[questionIndex];
  const isAnswerMatch = await bcrypt.compare(answer, question.answer);
  if (!isAnswerMatch) {
    // Incorrect answer, redirecting to the forgot password page with an alert message
    res.status(400).json({ error: "Answer incorrect!" });

    return;
  }

  // Validating the new password using Joi
  const schema = Joi.object({
    newPassword: Joi.string().max(20).required(),
  });

  const validationResult = schema.validate({
    newPassword,
  });
  if (validationResult.error != null) {
    // Password validation failed, redirecting to the forgot password page
    res.redirect("/forgot");
    return;
  }

  // Hashing the new password
  var hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Updating the user's password in the user collection
  await userCollection.updateOne(
    { username: username },
    { $set: { password: hashedPassword } }
  );

  // Redirecting to the update page
  res.status(200).json({ success: "Password updated!" });
});

// Route for rendering the update page
app.get("/update", (req, res) => {
  res.render("update");
});

//-------------------------------------------------------------------------

/* Find Username Section */

// Route for rendering the find_username page
app.get("/find_username", (req, res) => {
  res.render("find_username");
});

// Route for processing the username search form submission
app.post("/username_search", async (req, res) => {
  // Extracting the form data from the request body
  var email = req.body.email;
  var firstName = req.body.firstName;
  var lastName = req.body.lastName;
  var birthday = req.body.birthday;

  // Validation schema using Joi to validate the form data
  const schema = Joi.object({
    email: Joi.string().max(30).required(),
    firstName: Joi.string().max(20).required().allow(" "),
    lastName: Joi.string().max(20).required().allow(" "),
    birthday: Joi.string()
      .regex(/^(\d{4})-(\d{2})-(\d{2})$/)
      .required(),
  });

  const validationResult = schema.validate({
    email,
    firstName,
    lastName,
    birthday,
  });

  // Checking if there is an error in the validation result
  if (validationResult.error != null) {
    res.redirect("/find_username");
    return;
  }

  // Searching for the user in the user collection based on the provided data
  const result = await userCollection
    .find({
      email: email,
      firstName: firstName,
      lastName: lastName,
      birthday: birthday,
    })
    .project({
      email: 1,
      firstName: 1,
      lastName: 1,
      birthday: 1,
      username: 1,
    })
    .toArray();

  // Checking the number of matching users
  if (result.length != 1) {
    // User not found, rendering the find_ID_error page with an error message
    res.status(400).json({ error: "Invalid user information" });
    return;
  } else {
    // Rendering the username_search page with the found user's data
    res.render("username_search", { result: result });
    return;
  }
});

// Route for rendering the username_search page
app.get("/username_search", (req, res) => {
  res.render("username_search");
});

//-------------------------------------------------------------------------

/* Display customized homepage based on user data */

// Route for rendering the home page
app.get("/home", async (req, res) => {
  // Extracting the username from the session
  var username = req.session.username;

  // Searching for the user in the user collection based on the username
  const result = await userCollection
    .find({ username: username })
    .project({
      firstName: 1,
      calorieNeeds: 1,
      protein: 1,
      carbs: 1,
      fat: 1,
    })
    .toArray();

  // Checking if the user is authenticated
  if (!req.session.authenticated) {
    // User is not authenticated, redirecting to the homepage ("/")
    res.redirect("/");
  } else {
    // User is authenticated, rendering the home page with the user's data
    res.render("home", {
      name: result[0].firstName,
      calorie_goal: result[0].calorieNeeds,
      carbs_goal: result[0].carbs,
      protein_goal: result[0].protein,
      fat_goal: result[0].fat,
      map_api: map_api,
    });
  }
});

//-------------------------------------------------------------------------

/* Profile page rendering and user profile modification handling */

// Route for rendering the profile page
app.get("/profile", async (req, res) => {
  // Checking if the user is authenticated
  if (!req.session.authenticated) {
    // User is not authenticated, redirecting to the homepage ("/")
    res.redirect("/");
  } else {
    // User is authenticated
    var username = req.session.username;

    // Searching for the user in the user collection based on the username
    const result = await userCollection
      .find({ username: username })
      .project({
        firstName: 1,
        lastName: 1,
        sex: 1,
        birthday: 1,
        height: 1,
        weight: 1,
        activity: 1,
        goal: 1,
        calorieNeeds: 1,
        protein: 1,
        carbs: 1,
        fat: 1,
      })
      .toArray();

    // Rendering the profile page with the user's data
    res.render("profile", {
      firstName: result[0].firstName,
      lastName: result[0].lastName,
      sex: result[0].sex,
      birthday: result[0].birthday,
      height: result[0].height,
      weight: result[0].weight,
      activity: result[0].activity,
      goal: result[0].goal,
      calorieNeeds: result[0].calorieNeeds,
      protein: result[0].protein,
      carbs: result[0].carbs,
      fat: result[0].fat,
    });
  }
});

// Route for updating the profile
app.post("/update_profile", async (req, res) => {
  // Extracting the updated profile data from the request body
  const { firstName, lastName, sex, birthday, height, weight, activity, goal } =
    req.body;

  // Calculating the new calorie needs and macronutrients based on the updated data
  const calorieNeeds = calculateCalorieNeeds(
    sex,
    birthday,
    height,
    weight,
    activity,
    goal
  );
  const { protein, fat, carbs } = calculateMacronutrients(calorieNeeds, goal);

  // Updating the user's profile in the user collection
  await userCollection.updateOne(
    { username: req.session.username },
    {
      $set: {
        firstName: firstName,
        lastName: lastName,
        sex: sex,
        birthday: birthday,
        height: height,
        weight: weight,
        activity: activity,
        goal: goal,
        calorieNeeds: calorieNeeds,
        protein: protein,
        fat: fat,
        carbs: carbs,
      },
    },
    (err, result) => {
      if (err) {
        console.error(err);
      }
    }
  );

  // Sending a JSON response indicating that the profile has been updated
  res.json({ message: "Profile updated" });
});

//-------------------------------------------------------------------------

// Route to retrieve and render a list of restaurants
app.get("/restaurant", async (req, res) => {
  // Check if the user is not authenticated (not logged in)
  if (!req.session.authenticated) {
    res.render("index_before_login"); // Render the "index_before_login" view
    return; // Return to exit the function and prevent further execution
  } else {
    const restaurantCollection = database
      .db(mongodb_database)
      .collection("restaurants");
    const restaurants = await restaurantCollection.find().toArray();

    // Render the "restaurant" view and pass the retrieved restaurants as data
    res.render("restaurant", { restaurants });
  }
});

// Route to retrieve and render a specific restaurant's menu
app.get("/menu/:restaurantName", async (req, res) => {
  try {
    const restaurantName = req.params.restaurantName;
    const restaurantCollection = database
      .db(mongodb_database)
      .collection("restaurants");
    const menuCollection = database
      .db(mongodb_database)
      .collection("fastfoodnutrition");

    // Retrieve the specific restaurant and its menu items
    const [restaurant, menu] = await Promise.all([
      restaurantCollection.findOne({ name: restaurantName }),
      menuCollection.find({ restaurant: restaurantName }).toArray(),
    ]);

    const username = req.session.username;

    // Render the "menu" view and pass the retrieved restaurant, menu items, and the username as data
    res.render("menu", { restaurant, menu, username });
  } catch (error) {
    // If an error occurs, send an error response with a status code of 500
    res.status(500).send("Internal Server Error");
  }
});

//-------------------------------------------------------------------------

/* Adding items to the user's tray, 
retrieving the tray count, 
rendering the user's tray with restaurant information, 
calculating tray totals, and 
removing items from the tray */

// Route to handle adding an item to the user's tray
app.post("/addItem", async (req, res) => {
  const itemId = req.body.itemId;
  const username = req.session.username;

  const userCollection = database.db(mongodb_database).collection("users");
  const menuCollection = database
    .db(mongodb_database)
    .collection("fastfoodnutrition");

  try {
    // Find the user based on the provided username
    const user = await userCollection.findOne({ username: username });
    const userId = user._id;

    // Check if the provided itemId and userId are valid MongoDB ObjectIDs
    if (
      !mongodb.ObjectId.isValid(itemId) ||
      !mongodb.ObjectId.isValid(userId)
    ) {
      return res.json({ success: false });
    }

    // Find the item based on the provided itemId
    const item = await menuCollection.findOne({
      _id: new mongodb.ObjectId(itemId),
    });

    // Add the item to the user's trayItems array using $push
    const updateResult = await userCollection.updateOne(
      { _id: new mongodb.ObjectId(userId) },
      { $push: { trayItems: item } }
    );

    if (updateResult.matchedCount > 0) {
      // If the update was successful, retrieve the updated user and send the updated trayItemCount
      const updatedUser = await userCollection.findOne({
        _id: new mongodb.ObjectId(userId),
      });
      const trayItemCount = updatedUser.trayItems.length;
      res.json({ success: true, trayItemCount: trayItemCount });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    res.json({ success: false });
  }
});

// Route to retrieve the number of items in the user's tray
app.get("/trayCount", async (req, res) => {
  const username = req.session.username;
  const userCollection = database.db(mongodb_database).collection("users");

  try {
    // Find the user based on the provided username
    const user = await userCollection.findOne({ username: username });
    const trayItemCount = user.trayItems.length;
    res.json({ trayItemCount: trayItemCount });
  } catch (error) {
    res.json({ trayItemCount: 0 });
  }
});

/* GPT_Promt */
// Route to render the user's tray with associated restaurant information
app.get("/mytray", async (req, res) => {
  const username = req.session.username;
  const userCollection = database.db(mongodb_database).collection("users");
  const restaurantCollection = database
    .db(mongodb_database)
    .collection("restaurants");

  try {
    // Find the user based on the provided username
    const user = await userCollection.findOne({ username: username });
    const trayItems = user.trayItems;

    // Retrieve the associated restaurant information for each tray item
    const trayItemsWithRestaurant = await Promise.all(
      trayItems.map(async (item) => {
        const restaurant = await restaurantCollection.findOne({
          name: item.restaurant,
        });
        return {
          ...item,
          restaurant,
        };
      })
    );

    // Render the "mytray" view with the trayItems and username as data
    res.render("mytray", { trayItems: trayItemsWithRestaurant, username });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// Route to calculate and retrieve totals for the items in the user's tray
app.get("/trayTotals", async (req, res) => {
  try {
    const username = req.session.username;
    const totals = await calculateTotals(username);

    // Send the calculated totals as a JSON response
    res.json(totals);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// Route to handle removing all items from the user's tray
app.post("/removeAllItems", async (req, res) => {
  const username = req.session.username;
  const userCollection = database.db(mongodb_database).collection("users");

  try {
    // Find the user based on the provided username
    const user = await userCollection.findOne({ username: username });
    const userId = user._id;

    // Check if the provided userId is a valid MongoDB ObjectID
    if (!mongodb.ObjectId.isValid(userId)) {
      return res.json({ success: false });
    }

    // Remove all items from the user's trayItems array using $set
    const updateResult = await userCollection.updateOne(
      { _id: new mongodb.ObjectId(userId) },
      { $set: { trayItems: [] } }
    );

    if (updateResult.matchedCount > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    res.json({ success: false });
  }
});

// Route to handle removing an item from the user's tray
app.post("/removeItem", async (req, res) => {
  const itemId = req.body.itemId;
  const itemIndex = req.body.itemIndex;
  const username = req.session.username;

  const userCollection = database.db(mongodb_database).collection("users");

  try {
    // Find the user based on the provided username
    const user = await userCollection.findOne({ username: username });
    const userId = user._id;

    // Check if the provided itemId and userId are valid MongoDB ObjectIDs
    if (
      !mongodb.ObjectId.isValid(itemId) ||
      !mongodb.ObjectId.isValid(userId)
    ) {
      return res.json({ success: false });
    }

    // Remove the item from the user's trayItems array at the specified index using $set
    const updatedTrayItems = [...user.trayItems];
    updatedTrayItems.splice(itemIndex, 1);

    const updateResult = await userCollection.updateOne(
      { _id: new mongodb.ObjectId(userId) },
      { $set: { trayItems: updatedTrayItems } }
    );

    if (updateResult.matchedCount > 0) {
      // If the update was successful, send a success response
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    res.json({ success: false });
  }
});

//-------------------------------------------------------------------------

// Route to handle filtering the searchList based on selected filters
app.get("/filter", async (req, res) => {
  // Get the checked filters from the query parameters
  const checkedFilters = Array.isArray(req.query.filter)
    ? req.query.filter
    : req.query.filter.split(",");
  const searchListCopy = app.locals.searchList.slice();

  // Filter the searchListCopy based on the checked filters
  const filteredList = searchListCopy.filter((item) => {
    for (const filter of checkedFilters) {
      switch (filter) {
        case "calorie":
          if (item.calories >= 400) {
            return false;
          }
          break;
        case "protein":
          if (item.protein * 4 <= item.calories * 0.3) {
            return false;
          }
          break;
        case "fat":
          if (item.total_fat * 9 >= item.calories * 0.2) {
            return false;
          }
          break;
        case "carb":
          if (item.total_carb * 4 >= item.calories * 0.26) {
            return false;
          }
          break;
      }
    }
    return true;
  });

  // Render the "filtered-page" view with the filteredList
  res.render("filtered_page", {
    filteredList,
  });
});

//-------------------------------------------------------------------------

// Initialize compareList and searchList variables
var compareList = [];
var searchList = [];

// Function to create the searchList array by querying the foodCollection
async function createSearchArray() {
  searchList = await foodCollection
    .find()
    .sort()
    .project({
      restaurant: 1,
      item: 1,
      calories: 1,
      total_fat: 1,
      total_carb: 1,
      protein: 1,
    })
    .toArray();
}
// Call the createSearchArray function to populate the searchList
createSearchArray();

// Route to render the item details page
app.get("/item/:restaurant/:item", async (req, res) => {
  var restaurant = req.params.restaurant;
  var item = req.params.item;
  var username = req.session.username;

  // Retrieve the user's goals from the userCollection
  const goals = await userCollection
    .find({ username: username })
    .project({
      calorieNeeds: 1,
      protein: 1,
      carbs: 1,
      fat: 1,
    })
    .toArray();

  // Retrieve the details of the selected item from the foodCollection
  const itemDetails = await foodCollection
    .find({ restaurant: restaurant, item: item })
    .project({
      _id: 1,
      calories: 1,
      cal_fat: 1,
      total_fat: 1,
      sat_fat: 1,
      trans_fat: 1,
      cholesterol: 1,
      sodium: 1,
      total_carb: 1,
      fiber: 1,
      sugar: 1,
      protein: 1,
      vit_a: 1,
      vit_c: 1,
      calcium: 1,
    })
    .toArray();

  // Render the "item" view with the item details and user's goals as data
  res.render("item", {
    restaurant: restaurant,
    item: item,
    id: itemDetails[0]._id,
    calories: itemDetails[0].calories,
    cal_fat: itemDetails[0].cal_fat,
    total_fat: itemDetails[0].total_fat,
    sat_fat: itemDetails[0].sat_fat,
    trans_fat: itemDetails[0].trans_fat,
    cholesterol: itemDetails[0].cholesterol,
    sodium: itemDetails[0].sodium,
    total_carb: itemDetails[0].total_carb,
    fiber: itemDetails[0].fiber,
    sugar: itemDetails[0].sugar,
    protein: itemDetails[0].protein,
    vit_a: itemDetails[0].vit_a,
    vit_c: itemDetails[0].vit_c,
    calcium: itemDetails[0].calcium,
    calorie_goal: goals[0].calorieNeeds,
    carbs_goal: goals[0].carbs,
    protein_goal: goals[0].protein,
    fat_goal: goals[0].fat,
  });
});

// Route to add an item to the compare list
app.get("/addCompare", async (req, res) => {
  let username = req.session.username;
  let itemID = req.query.compareID;

  // Find the item with the specified itemID in the foodCollection
  let item = await foodCollection.find({ _id: new ObjectId(itemID) }).toArray();

  // Retrieve the current compare list for the user
  compareList = await userCollection
    .find({ username: username })
    .project({ compareItems: 1 })
    .toArray();
  compareList = compareList[0].compareItems;

  if (compareList.length < 2) {
    // Add the item to the compare list in the userCollection
    await userCollection.updateOne(
      { username: username },
      { $push: { compareItems: item[0] } }
    );

    // Retrieve the updated compare list
    compareList = await userCollection
      .find({ username: username })
      .project({ compareItems: 1 })
      .toArray();
    compareList = compareList[0].compareItems;
  }

  res.redirect("back");
});

// Route to remove an item from the compare list
app.get("/removeCompare", async (req, res) => {
  let username = req.session.username;
  let itemID = req.query.compareID;

  // Find the item with the specified itemID in the foodCollection
  let item = await foodCollection.find({ _id: new ObjectId(itemID) }).toArray();

  // Remove the item from the compare list in the userCollection
  await userCollection.updateOne(
    { username: username },
    { $pull: { compareItems: { _id: new ObjectId(itemID) } } }
  );

  // Retrieve the updated compare list
  compareList = await userCollection
    .find({ username: username })
    .project({ compareItems: 1 })
    .toArray();
  compareList = compareList[0].compareItems;

  res.redirect("back");
});

// Route to render the compare page
app.get("/compare", async (req, res) => {
  var username = req.session.username;

  // Retrieve the user's goals from the userCollection
  const userGoals = await userCollection
    .find({ username: username })
    .project({
      calorieNeeds: 1,
      protein: 1,
      carbs: 1,
      fat: 1,
    })
    .toArray();

  // Render the "compare" view with the user's goals as data
  res.render("compare", {
    cal_goal: userGoals[0].calorieNeeds,
    carbs_goal: userGoals[0].carbs,
    protein_goal: userGoals[0].protein,
    fat_goal: userGoals[0].fat,
  });
});

//-------------------------------------------------------------------------

// OPENAI API Connection

// Importing necessary modules
const http = require("http").Server(app); // Creating an HTTP server using the app
const io = require("socket.io")(http); // Initializing Socket.IO using the HTTP server
app.use(express.json()); // Adding JSON middleware to parse incoming requests
const { Configuration, OpenAIApi } = require("openai"); // Importing OpenAI modules

// Creating a new OpenAI configuration object with API key
const config = new Configuration({
  apiKey: process.env.OPEN_AI_KEY, // Storing the API key from environment variable
});

// Creating an OpenAI instance with the configuration
const openai = new OpenAIApi(config);

// Socket.IO connection event
io.on("connection", (socket) => {
  // Socket.IO event for chat message
  socket.on("chat message", async (msg) => {
    // Handling chat message event
    const response = await openai.createCompletion({
      model: "text-davinci-003", // Model used for completion
      prompt: msg, // User's message as the prompt
      temperature: 1, // Controls the randomness of the generated text
      max_tokens: 100, // Maximum number of tokens in the generated response
    });

    // Emitting chat message event with generated response
    io.emit("chat message", response.data.choices[0].text);
  });
});

// Route to render the chat page
app.get("/chat", (req, res) => {
  res.render("chat");
});

//-------------------------------------------------------------------------

// Route for the "/easteregg" endpoint
app.get("/easteregg", (req, res) => {
  res.render("easteregg"); // Rendering the "easteregg" view/template
});

//-------------------------------------------------------------------------

// Route for the "/logout" endpoint
app.get("/logout", (req, res) => {
  req.session.destroy(); // Destroying the user's session
  res.redirect("/"); // Redirecting the user to the root ("/") endpoint
});

// Serving static files from the "public" directory
app.use(express.static(__dirname + "/public"));

// Route for handling all other routes (404 Not Found)
app.get("*", (req, res) => {
  res.status(404); // Setting the response status code to 404 (Not Found)
  res.render("404", { svgWidth: 500, svgHeight: 350 }); // Rendering the "404" view/template with data
});

http.listen(port, () => {
  console.log("Node application listening on port " + port);
});
