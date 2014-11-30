var fs = require("fs"),
    express = require("express"),
    path = require("path"),
    ogr2ogr = require("ogr2ogr");

var app = express();

var logFile = fs.createWriteStream("./mapstarter.log", {flags: "a"});

app.use(express.bodyParser({limit: "100mb"}));
app.use(express.compress());

app.post("/convert/geo-to-topo/",function(req,res) {

  var topojson = require("topojson");

  res.setHeader("Content-Type", "application/json");

  if (!req.body || !req.body.geojson) {   
    res.send(JSON.stringify({error: "Invalid GeoJSON received."}));
    return true;
  }

  try {

    var geo = JSON.parse(req.body.geojson);
    var topo = topojson.topology({collection: geo},
      { "property-transform": function(object) { 
          return object.properties;
        }
      }
    );

    console.log("Successfully served a topology");
    res.send(JSON.stringify(topo));
    return true;

  } catch(err) {  
    console.log(err);
    res.send(JSON.stringify({error: err}));
    return true;
  }

});

app.post("/convert/shp-to-geo",function(req,res) {

    res.setHeader("Content-Type", "application/json");

    if (!req.body || !req.files || (!req.files.zip && (!req.files.shp || !req.files.dbf || !req.files.shx))) {
            res.send(JSON.stringify({error: "Invalid shapefile received."}));
            return true;
    }

    try {

      var paths = [];

      if (req.files.zip) {

        paths.push(req.files.zip.path);

      } else if (req.files.shp && req.files.dbf && req.files.shx) {
 
        ["shp","dbf","shx","prj"].forEach(function(f) {
          if (!req.files[f]) return true;
          fs.renameSync(req.files[f].path,req.files.shp.path.replace(/[.][a-z]+$/i,"."+f));
          paths.push(req.files.shp.path.replace(/[.][a-z]+$/i,"."+f));
        });

      } else {

        return res.send(JSON.stringify({error: "No .zip or .shp/.shx/.dbf file received."}));

      }

      var ogr = ogr2ogr(paths[0])
        .format("GeoJSON")
        .skipfailures();

      ogr.exec(function(err, data) {

        if (err) {
          console.error(err);
          res.send(JSON.stringify({error: err}));
        } else {
          res.send(JSON.stringify(data));
        }

        paths.forEach(function(p) {
          fs.unlinkSync(p);
        });

      });

    } catch(err) {

        res.send(JSON.stringify({error: err}));
        return true;

    }

});

app.use(express.static(path.join(__dirname,"www")));

app.listen(80);