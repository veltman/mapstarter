Mapstarter
==========

Mapstarter is a tool for turning a geographic data file into a map for the web.

This is a work in progress.  Got ideas?  Requests?  Complaints?  Data files that didn't work?  Let me know! (see **Get in touch** below)

Installation
-----------------
````
git clone https://github.com/mhkeller/mapstarter.git
cd mapstarter
npm install
````

Running the server
-----------------
````
node server.js
````

Open `0.0.0.0:3000` in your browser

How does it work?
-----------------

Select a GeoJSON file, TopoJSON file, or ESRI Shapefile.  It will import your data and give you a starting interactive map, automatically scaled to fit your data.  You can change the dimensions, map projection, color scheme, and add basic behaviors like zoom and tooltips. You can also inspect the data stored in your file in the "Data" tab.

Once you've got something you like, you can export it in one of three formats:      

* **SVG**: useful if you want a starting template to further customize as a flat graphic (e.g. in Adobe Illustrator).
* **Image**: useful if you want an instant flat image of your map.
* **Code**: useful if you're a web developer or have access to one, and you want to put this up on the web in an interactive form.  You'll get a basic working page with the JavaScript to generate your map, which you can then go trick out with extra cleverness.


The assumption is that most webmaps have a lot in common, and even if you want to add bells and whistles, the first 20% of the project is the same.  This aims to speed that up.

Who is this for?
----------------

**Designers** who want to get a headstart on a custom map they're going to work on in graphics software.

**Reporters** who want to get a quick idea of what's actually in a data file and how an interactive web map approach would look.

**Web developers** who want to get a sensible starting template without a copy/paste scavenger hunt or a dozen syntax errors.

Who is this NOT for?
--------------------

People who want to edit their data a lot.  This lets you edit the attribute table, but if you want to do bulk, spreadsheet-style editing, you're going to have a bad time. See **Other tools and resources** below for some tools for this.

People who want to make Google Maps-style tile maps that you can slip and slide around.  This is meant for more focused maps that ignore the world at large.  Think election maps.  See **Other tools and resources** below 
for some tools for tile maps.

People who want to make complex, multilayered, or heavily stylized maps.  This may still provide a useful starting point for that, but it's not going to get you very far.
Mike Bostock.

Some details/caveats
--------------------

A shapefile is typically composed of several actual files.  To import one, you need to import the .shp file, the .prj file, and the .shx file.  Assuming you want to include the attributes (like country names) as part of the map, you'll also need to import the .dbf file.  To import these files, you can either select them all (or drag them all onto the target), or you can submit a .zip file that includes all of them.  If you accidentally include unnecessary files, that's fine, they'll just get ignored.

This will currently only support a single layer of geometries.  If, for example, you have a TopoJSON file with census tracts, counties, and states, all stored separately, it will only draw one of them.  I hope to fix this (see **To do list**).

If you download the code for your map, it will rely on [D3](http://d3js.org/) for most of the heavy lifting.  D3 is not compatible with IE8 and below, so if you need to serve old browsers, make sure you include an image fallback of some sort.

If you already have GeoJSON/TopoJSON, you can run this without an internet connection.  The only pieces that require an internet connection are importing a shapefile and converting from GeoJSON to TopoJSON.  If you want to run it locally, you can clone this GitHub repository and open index.html.

This will only work on modern browsers, and I wouldn't recommend using it on your smartphone.

To do list
----------
      
* Save a map to work on it later
* Option to add data file to a communal library
* Responsive scaling option for code download
* Built-in image fallbacks for code download
* Pull in data from a Google spreadsheet with Tabletop.js
* Feature simplification
* Merge features
* Add a legend to a choropleth
* Categorical choropleths
* Support files with multiple geometry layers
* Auto-delete weird features (i.e. tiny islands)
* Split a feature into its constituent parts and edit in detail.
* KML importing?  Do people still use KML?

Get in touch
------------

The source is on Github: [https://github.com/veltman/mapstarter](https://github.com/veltman/mapstarter)

You can email me at [noah@noahveltman.com](mailto:noah@noahveltman.com), or if you can keep it short, I'm [@veltman](https://twitter.com/veltman) on Twitter.

Appendix: other tools and resources
-----------------------------------      
* If you're a map-curious beginner, or just want to better understand what the hell GeoJSON and TopoJSON are, I wrote a [broad overview on geodata and web maps](https://github.com/veltman/learninglunches/tree/master/maps).
* If you want to make a few basic edits to your underlying data, [geojson.io](http://geojson.io/) is pretty handy.  If you want to do more in-depth editing, you'll need desktop software. The fancy and very expensive option is [ArcGIS](http://www.esri.com/software/arcgis); I recommend [QGIS](http://www.qgis.org/), which is free, probably does everything you need, and is more beginner-friendly than you might think.
* To convert a shapefile to GeoJSON, you can use ADC's [online converter](http://ogre.adc4gis.com/).
* If you want to simplify the geometry of your data file, Matthew Bloch's [Mapshaper](http://mapshaper.org/) is fantastic.
* If you're a coder or code-curious and have some JavaScript under your belt, Mike Bostock has a great [detailed walkthrough](http://bost.ocks.org/mike/map/) that introduces you to many of the fundamentals of mapping with D3.  You can also consult the [bountiful list of examples](https://github.com/mbostock/d3/wiki/Gallery#maps).  I'd probably start with [this one](http://bl.ocks.org/mbostock/4060606).
* If you want to make a slippy, Google Maps-style tile map, I highly recommend [Leaflet](http://leafletjs.com/).  It's delightful.  Another option is [Modest Maps](http://modestmaps.com/).
* Shan Carter has a [nice tool for converting GeoJSON to TopoJSON](http://shancarter.github.io/distillery/).
* If you want to make a tile map with custom tiles, you can get pretty far with [CloudMade](http://cloudmade.com/) or [MapBox](http://www.mapbox.com/).  For full control, you'll probably want to use [TileMill](http://mapbox.com/tilemill/).  Lisa Williams has a [tutorial on getting started with TileMill](http://dataforradicals.com/the-insanely-illustrated-guide-to-your-first-tile-mill-map/).
* If you're in the choropleth business, the folks at MinnPost have a great utility for that called [Tulip](http://code.minnpost.com/tulip/) with much finer controls than this offers.
* If you're a developer, [Kartograph.js](http://kartograph.org/) is a neat JavaScript library for building SVG maps that also includes support for IE7 and IE8.        
* If you want to build stuff out of geodata and you don't mind paying for the privilege and giving up some control over the details, [CartoDB](http://cartodb.com) offers a lot of features (Disclaimer: I've never used it).
* For detailed geodata about the entire world, [OpenStreetMap](http://wiki.openstreetmap.org/wiki/Main_Page) is without equal, and has a vibrant ecosystem of lots of tools and services to help you extract specific data you want.  And it's free!
* For semi-canonical shapefiles of countries of the world, states, provinces, coastlines, or other high-level features, try [Natural Earth Data](http://www.naturalearthdata.com/downloads/).  To get it as TopoJSON, try Mike Bostock's [World Atlas](https://github.com/mbostock/world-atlas) tool.
* For US-specific geodata, you can try the [US Census Bureau](http://www.census.gov/geo/maps-data/data/tiger.html), but you'll probably end up in tears.  [This TopoJSON file](http://bl.ocks.org/mbostock/raw/4090846/us.json) from Mike Bostock includes US counties and states and may be a shortcut.
* Some news organizations offer boundary services that provide geodata exports for things like congressional districts, city council districts, and ZIP codes.  The [Los Angeles Times](http://boundaries.latimes.com/sets/), [Chicago Tribune](http://boundaries.tribapps.com/), and [MinnPost](http://boundaries.minnpost.com/#datasets) all have great ones.
* In the UK, the Ordnance Survey offers [some data for download](https://www.ordnancesurvey.co.uk/opendatadownload/products.html) and accepts custom shapefile requests if you're not in a hurry.
* For miscellaneous geodata, you can try [GeoCommons](http://geocommons.com/).
