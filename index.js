require("./utils.js");

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const saltRounds = 12;
const port = process.env.PORT || 3030;
const app = express();
const Joi = require("joi");
const cors = require("cors");

// Session Expiry time set to 1 hour
const expireTime = 1 * 60 * 60 * 1000;

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

var { database } = include("databaseConnection");

const userCollection = database.db(mongodb_database).collection("users");

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: false }));

app.use("/img", express.static("./public/images"));
app.use("/css", express.static("./public/css"));

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
  crypto: {
    secret: mongodb_session_secret,
  },
});

app.use(
  session({
    secret: node_session_secret,
    store: mongoStore, //default is memory store
    saveUninitialized: false,
    resave: true,
  })
);

app.get("/", (req, res) => {
  var name = req.query.user;
  if (!req.session.authenticated) {
    res.render("index_before_login");
    return;
  } else {
    res.render("index_after_login", { name: req.session.name });
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/submitUser", async (req, res) => {
  var username = req.body.username;
  var firstName = req.body.firstName;
  var lastName = req.body.lastName;
  var email = req.body.email;
  var birthday = req.body.birthday;
  var password = req.body.password;
  if (!username) {
    res.render("signup_error", { error: "Username" });
  }
  if (!firstName) {
    res.render("signup_error", { error: "First Name" });
  }
  if (!lastName) {
    res.render("signup_error", { error: "Last Name" });
  }
  if (!email) {
    res.render("signup_error", { error: "Email" });
  }
  if (!birthday) {
    res.render("signup_error", { error: "Birthday" });
  }
  if (!password) {
    res.render("signup_error", { error: "Password" });
  }
  const schema = Joi.object({
    username: Joi.string().alphanum().max(20).required(),
    firstName: Joi.string().max(20).required().allow(' '),
    lastName: Joi.string().max(20).required().allow(' '),
    email: Joi.string().max(30).required(),
    birthday: Joi.string().regex(/^(\d{4})-(\d{2})-(\d{2})$/).required(),
    password: Joi.string().max(20).required(),
  });

  const validationResult = schema.validate({ username, firstName, lastName, email, birthday, password });
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/signup");
    return;
  }
  var hashedPassword = await bcrypt.hash(password, saltRounds);
  await userCollection.insertOne({
    username: username,
    firstName: firstName,
    lastName: lastName,
    email: email,
    birthday: birthday,
    password: hashedPassword,
    user_type: "user",
  });
  console.log("User Created");
  req.session.authenticated = true;
  req.session.username = username;
  req.session.cookie.maxAge = expireTime;
  res.redirect("/home");
  return;
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/loggingIn", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;

  const schema = Joi.string().alphanum().max(20).required();
  const validationResult = schema.validate(username);
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.render("login_error", { error: "Please enter a valid username" });
    return;
  }

  const result = await userCollection
    .find({ username: username })
    .project({ username: 1, username: 1, password: 1, user_type: 1, _id: 1 })
    .toArray();
  console.log(result);
  if (result.length != 1) {
    res.render("login_error", { error: "User not found." });
    return;
  }
  if (await bcrypt.compare(password, result[0].password)) {
    console.log("correct password");
    req.session.authenticated = true;
    req.session.username = result[0].username;
    req.session.user_type = result[0].user_type;
    req.session.cookie.maxAge = expireTime;
    res.redirect("/home");
    return;
  } else {
    console.log("incorrect password");
    res.render("login_error", { error: "Incorrect password" });
    return;
  }
});

//Reset Password Section
app.get("/forgot", (req, res) => {
  res.render("forgot");
});

app.get("/home", (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/");
  } else {
    res.render("home", { name: req.session.name });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.use(express.static(__dirname + "/public"));

app.get("*", (req, res) => {
  res.status(404);
  res.render("404");
});

app.listen(port, () => {
  console.log("Node application listening on port " + port);
});
