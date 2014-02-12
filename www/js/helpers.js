//Get the first object set from a TopoJSON file
function getObjectName(topo) {
  for (var i in topo.objects) return i;
  return false;
}

//Detect GeoJSON vs. TopoJSON
function jsonType(data) {
  if (typeof data !== "object" || !data.type) return null;
  if (data.type === "Topology" && data.objects && getObjectName(data)) return "topojson";
  if (["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection", "Feature", "FeatureCollection"].indexOf(data.type) == -1) return null;
  return "geojson";
}

//If it's GeoJSON but not a FeatureCollection, make it a FeatureCollection with a single feature for consistency
function fixGeo(g) {

  if (g.type == "FeatureCollection")  return g;

  if (g.type == "Feature") return {type: "FeatureCollection", features: [g]};

  return {type: "FeatureCollection", features: [{type: "Feature", geometry: g, properties: {}}]};

}

//Needs a geometry collection, single-element topologies will break it
function fixTopo(t) {

  for (var i in t.objects) {
    if (t.objects[i].type != "GeometryCollection") {
      t.objects[i].id = 1;
      t.objects[i] = {type: "GeometryCollection", geometries: [t.objects[i]]};
    }
  }
  
  return t;

}

//A human readable version of a filesize
function prettySize(size) {
  if (typeof size != "number") return 'unknown size';

  if (size > 1000000) {
    return Math.round(size/100000)/10+" MB";
  } else {
    return Math.round(size/100)/10+" KB";
  }
}

//Compute the opposite color, for the default highlight color based on a given fill
function oppositeColor(color) {        
  var col = d3.hsl(color);
  return d3.hsl((col.h+180) % 360,col.s,col.l).toString();        
}

//Attempt to detect a US map including AK and HI, switch to albersUsa
//Mercator projection will also get tripped up something that crosses the
//International Date Line, like Alaska, so switch to conicEqualArea
function chooseDefaultProjection(data) {  
  var a = d3.geo.area(data),
    b = d3.geo.bounds(data),
    c = d3.geo.centroid(data);

  if (b[0][0] < -180 || b[1][0] > 180 || b[0][1] < -90 || b[1][1] > 90) msg("out-of-bounds");

  if (isUSA(a,b)) {
    mapOptions.projectionType = "albersUsa";
  } else if (isWorld(a)) {
    mapOptions.projectionType = "robinson";
  } else if (isWrapAround(b,c)) {
    mapOptions.projectionType = "conicEqualArea";
  } else {
    mapOptions.projectionType = "mercator";
  }

  var node = body.select("select#input-projection").node();

  for (var i = 0; i < node.options.length; i++) {
    if (node.options[i].value == mapOptions.projectionType) {
      node.selectedIndex = i;
      break;
    }
  }
}

//Rough guess at a whole US map with AK and HI
function isUSA(a,b) {
  return (a > 0.21 && a < 0.24 && b[0][0] > 170 && b[0][0] < 174 && b[0][1] > 15 && b[0][1] < 19 && b[1][0] > -67 && b[1][0] < -61 && b[1][1] > 68 && b[1][1] < 74);
}

//Rough guess at whether it's a whole world map; should improve this to account for lng range, etc.
function isWorld(a) {
  return (a > 2.5);
}

//Attempt to detect bounds that cross IDL but aren't entire world; only affects things like mapping Alaska, or South Pacific islands
//If the SW lng is greater than the NE lng, crosses the IDL
//If the centroid is east of the SW lng or west of the NE lng, it's not a wraparound world map type situation
function isWrapAround(b,c) {  
  return (b[0][0] > b[1][0] && c[0] > (b[0][0] > 0 ? -(360-b[0][0]) : b[0][0]) && c[0] < (b[1][0] > 0 ? -(360-b[1][0]) : b[1][0]));
}

//Prevent d3 mouse defaults
function noop() {
  d3.event.stopPropagation();
  d3.event.preventDefault();
}

//Some fairly strict number parsing for numbers stored as strings
function parseNumber(val) {
  if (typeof val == "number") {
    return val;
  }

  if (typeof val == "string") {
    val = val.replace(/(\s|,)/g,'');

    if (val.match(/^-?[0-9]*[.]?[0-9]+$/)) return parseFloat(val);

    return null;
  }

  return null;
}

// Given a file name, get its extension
function discernFormat(file_name) {
  var name_arr = file_name.split('\.')
  format_name = name_arr[name_arr.length - 1];
  return format_name
}

// Given a file name, return teh appropriate date parser
function discernParser(file_name) {
  var format = discernFormat(file_name);
  var parserMap = {
    json: JSON.parse,
    csv: d3.csv.parse,
    tsv: d3.tsv.parse,
    psv: d3.dsv('|').parse
  }
  return parserMap[format]
}
