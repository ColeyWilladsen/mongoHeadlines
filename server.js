var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var exphbs = require("express-handlebars");


// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = process.env.PORT || 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: true }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));


app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI);
}
else {
  mongoose.connect("mongodb://localhost/mongoHeadlines");
};

// Routes

// A GET route for scraping the https://www.nytimes.com/ website
app.get("/scrape", function (req, res) {
  // First, we grab the body of the html with request
  axios.get("https://www.nytimes.com/").then(function (response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);

    // Now, we grab every h2 within an article tag, and do the following:
    $("article").each(function (i, element) {
      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      var title = $(this)
        .find("h2")
        .text()
        .trim();
      var title2 = $(this)
        .find("a")
        .text()
        .trim();
      var title3 = $(this)
        .find("h3")
        .text()
        .trim();
      var link = $(this)
        .find("a")
        .attr("href");
      var summary = $(this)
        .find("p.summary")
        .text()
        .trim();

      result.link = link;
      result.title = title;

      if (title) {
        result.title = title;
      }
      if (title2) {
        result.title = title2;
      }
      else result.title = title3;

      if (summary) {
        result.summary = summary;
      };


      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function (dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function (err) {
          // If an error occurred, send it to the client
          return res.json(err);
        });
    });

    // If we were able to successfully scrape and save an Article, send a message to the client
    res.send("Scrape Complete");
    return res.redirect('back');
  });
});

app.get("/", function (req, res) {
  db.Article.find({}, null, { sort: { created: -1 } }, function (err, data) {
    if (data.length === 0) {
      res.render("placeholder", { message: "There's nothing scraped yet. Please click \"Scrape For Newest Articles\"." });
    }
    else {
      res.render("index", { articles: data });
    }
  });
});

app.get("/saved", function (req, res) {
  db.Article.find({ issaved: true }, null, { sort: { created: -1 } }, function (err, data) {
    if (data.length === 0) {
      res.render("placeholder", { message: "You have not saved any articles yet. Try to save some delicious news by simply clicking \"Save Article\"!" });
    }
    else {
      res.render("saved", { saved: data });
    }
  });
});

app.get("/:id", function (req, res) {
  db.Article.findById(req.params.id, function (err, data) {
    res.json(data);
  })
})

app.post("/save/:id", function (req, res) {
  db.Article.findById(req.params.id, function (err, data) {
    if (data.issaved) {
     db.Article.findByIdAndUpdate(req.params.id, { $set: { issaved: false, status: "Save Article" } }, { new: true }, function (err, data) {
        res.redirect("/");
      });
    }
    else {
      db.Article.findByIdAndUpdate(req.params.id, { $set: { issaved: true, status: "Saved" } }, { new: true }, function (err, data) {
        res.redirect("/saved");
      });
    }
  });
});

app.post("/note/:id", function (req, res) {
  var note = new db.Note(req.body);
  db.Note.save(function (err, doc) {
    if (err) throw err;
    db.Article.findByIdAndUpdate(req.params.id, { $set: { "note": doc._id } }, { new: true }, function (err, newdoc) {
      if (err) throw err;
      else {
        res.send(newdoc);
      }
    });
  });
});

app.get("/note/:id", function (req, res) {
  var id = req.params.id;
  db.Article.findById(id).populate("note").exec(function (err, data) {
    res.send(data.note);
  })
})


// Start the server
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});
