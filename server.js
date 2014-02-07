var fs = require('fs');
var express = require('express');

var app = express();

var logFile = fs.createWriteStream('./mapstarter.log', {flags: 'a'});

app.use(express.bodyParser({limit: '100mb'}));
app.use(express.logger({format: ':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] (:response-time ms) ":referrer" ":user-agent"', stream: logFile}));
app.use(express.compress());

app.post(/^\/?convert\/geo-to-topo\/?$/,function(req,res) {

	var topojson = require('topojson');

	res.setHeader('Content-Type', 'application/json');

	if (!req.body || !req.body.geojson) {		
		res.send(JSON.stringify({error: "Invalid GeoJSON received."}));
		return true;
	}

	try {

		var geo = JSON.parse(req.body.geojson);
		var topo = topojson.topology({collection: geo},
			{ "property-transform": function(properties, key, value) { 
					properties[key] = value;
					return true; 
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

app.post(/^\/?convert\/shp-to-geo\/?$/,function(req,res) {

	console.log(req);

    res.setHeader('Content-Type', 'application/json');    

    if (!req.body || !req.files || (!req.files.zip && (!req.files.shp || !req.files.dbf || !req.files.shx))) {
            res.send(JSON.stringify({error: "Invalid shapefile received."}));
            return true;
    }

    try {

    	var tmp = null;

    	var paths = [];

    	if (req.files.zip) {

    		var toJSON = require('shp2json');
    		var Stream = require('stream').Stream;

    		paths.push(req.files.zip.path);

    		var inStream = fs.createReadStream(req.files.zip.path);

			var outStream = new Stream;
			outStream.writable = true;

			var data = '';

			outStream.write = function (buf) {
			    data += buf;
			};

			outStream.end = function () {    			    
			    res.send(data);

			    paths.forEach(function(p) {
			    	fs.unlinkSync(p);
			    })
			};

			toJSON(inStream).pipe(outStream);

		} else if (req.files.shp && req.files.dbf && req.files.shx) {	

			var spawn = require('child_process').spawn;
			var Stream = require('stream').Stream;
			//var BufferedStream = require('morestreams').BufferedStream;

			["shp","dbf","shx","prj"].forEach(function(f) {								
				if (!req.files[f]) return true;
				fs.renameSync(req.files[f].path,req.files.shp.path.replace(/[.][a-z]+$/i,"."+f));
				paths.push(req.files.shp.path.replace(/[.][a-z]+$/i,"."+f));
			});

			var outStream = new Stream;    		
    		outStream.writable = true;

			var data = '';

			outStream.write = function (buf) {
			    data += buf;
			};

			outStream.end = function () {			    
			    res.send(data);

			    paths.forEach(function(p) {
			    	fs.unlinkSync(p);
			    })
			};    		

			var args = [
                '-f', 'GeoJSON',
                '-skipfailures',
                '-t_srs',
                'EPSG:4326',
                '-a_srs',
                'EPSG:4326'];

            if (!req.files["prj"]) args = args.concat(['-s_srs','EPSG:4326']);

			args = args.concat(['/vsistdout/',paths[0]]);

            var ps = spawn('ogr2ogr', args);
            ps.stdout.pipe(outStream, { end : false });
            ps.stderr.pipe(outStream, { end : false });
            
            var pending = 2;
            function onend () { if (--pending === 0) outStream.end() }
            ps.stdout.on('end', onend);
            ps.stderr.on('end', onend);
			

		} else {
			res.send(JSON.stringify({error: "No .zip or .shp/.shx/.dbf file received."}));
	        return true;	    	
		}

    } catch(err) {
            console.log(err);
            res.send(JSON.stringify({error: err}));
            return true;
    }

});

app.get(/.*/,function(req,res) {	

	var path = './www'+req.url;		

	fs.stat(path,function(err, stats) {
		if (err) {
			res.send(404, 'Sorry, '+req.url+' doesn\'t exist!');
			return false;
		}

		if (!stats.isDirectory()) {
			res.sendfile(path);
			return true;
		}

		var indexPath = path.replace(/\/+$/,"")+"/index.html";		

		fs.stat(indexPath,function(err2, stats2) {			

			if (err2 || !stats2 || stats2.isDirectory()) {
				res.send(404, 'Sorry, '+req.url+' doesn\'t exist!');
				return false;
			}

			res.sendfile(indexPath);

		});

	});

});

app.listen(3000);