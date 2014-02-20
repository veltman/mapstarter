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

// ## Compute Matrices for Jenks
//
// Compute the matrices required for Jenks breaks. These matrices
// can be used for any classing of data with `classes <= n_classes`
function jenksMatrices(data, n_classes) {

    // in the original implementation, these matrices are referred to
    // as `LC` and `OP`
    //
    // * lower_class_limits (LC): optimal lower class limits
    // * variance_combinations (OP): optimal variance combinations for all classes
    var lower_class_limits = [],
        variance_combinations = [],
        // loop counters
        i, j,
        // the variance, as computed at each step in the calculation
        variance = 0;

    // Initialize and fill each matrix with zeroes
    for (i = 0; i < data.length + 1; i++) {
        var tmp1 = [], tmp2 = [];
        // despite these arrays having the same values, we need
        // to keep them separate so that changing one does not change
        // the other
        for (j = 0; j < n_classes + 1; j++) {
            tmp1.push(0);
            tmp2.push(0);
        }
        lower_class_limits.push(tmp1);
        variance_combinations.push(tmp2);
    }

    for (i = 1; i < n_classes + 1; i++) {
        lower_class_limits[1][i] = 1;
        variance_combinations[1][i] = 0;
        // in the original implementation, 9999999 is used but
        // since Javascript has `Infinity`, we use that.
        for (j = 2; j < data.length + 1; j++) {
            variance_combinations[j][i] = Infinity;
        }
    }

    for (var l = 2; l < data.length + 1; l++) {

        // `SZ` originally. this is the sum of the values seen thus
        // far when calculating variance.
        var sum = 0,
            // `ZSQ` originally. the sum of squares of values seen
            // thus far
            sum_squares = 0,
            // `WT` originally. This is the number of
            w = 0,
            // `IV` originally
            i4 = 0;

        // in several instances, you could say `Math.pow(x, 2)`
        // instead of `x * x`, but this is slower in some browsers
        // introduces an unnecessary concept.
        for (var m = 1; m < l + 1; m++) {

            // `III` originally
            var lower_class_limit = l - m + 1,
                val = data[lower_class_limit - 1];

            // here we're estimating variance for each potential classing
            // of the data, for each potential number of classes. `w`
            // is the number of data points considered so far.
            w++;

            // increase the current sum and sum-of-squares
            sum += val;
            sum_squares += val * val;

            // the variance at this point in the sequence is the difference
            // between the sum of squares and the total x 2, over the number
            // of samples.
            variance = sum_squares - (sum * sum) / w;

            i4 = lower_class_limit - 1;

            if (i4 !== 0) {
                for (j = 2; j < n_classes + 1; j++) {
                    // if adding this element to an existing class
                    // will increase its variance beyond the limit, break
                    // the class at this point, setting the `lower_class_limit`
                    // at this point.
                    if (variance_combinations[l][j] >=
                        (variance + variance_combinations[i4][j - 1])) {
                        lower_class_limits[l][j] = lower_class_limit;
                        variance_combinations[l][j] = variance +
                            variance_combinations[i4][j - 1];
                    }
                }
            }
        }

        lower_class_limits[l][1] = 1;
        variance_combinations[l][1] = variance;
    }

    // return the two matrices. for just providing breaks, only
    // `lower_class_limits` is needed, but variances can be useful to
    // evaluage goodness of fit.
    return {
        lower_class_limits: lower_class_limits,
        variance_combinations: variance_combinations
    };
}

// ## Pull Breaks Values for Jenks
//
// the second part of the jenks recipe: take the calculated matrices
// and derive an array of n breaks.
function jenksBreaks(data, lower_class_limits, n_classes) {

    var k = data.length - 1,
        kclass = [],
        countNum = n_classes;

    // the calculation of classes will never include the upper and
    // lower bounds, so we need to explicitly set them
    kclass[n_classes] = data[data.length - 1];
    kclass[0] = data[0];

    // the lower_class_limits matrix is used as indexes into itself
    // here: the `k` variable is reused in each iteration.
    while (countNum > 1) {
        kclass[countNum - 1] = data[lower_class_limits[k][countNum] - 2];
        k = lower_class_limits[k][countNum] - 1;
        countNum--;
    }

    return kclass;
}

// # [Jenks natural breaks optimization](http://en.wikipedia.org/wiki/Jenks_natural_breaks_optimization)
//
// Implementations: [1](http://danieljlewis.org/files/2010/06/Jenks.pdf) (python),
// [2](https://github.com/vvoovv/djeo-jenks/blob/master/main.js) (buggy),
// [3](https://github.com/simogeo/geostats/blob/master/lib/geostats.js#L407) (works)
//
// Depends on `jenksBreaks()` and `jenksMatrices()`
function jenks(data, n_classes) {

    if (n_classes > data.length) return null;

    // sort data in numerical order, since this is expected
    // by the matrices function
    data = data.slice().sort(function (a, b) { return a - b; });

    // get our basic matrices
    var matrices = jenksMatrices(data, n_classes),
        // we only need lower class limits here
        lower_class_limits = matrices.lower_class_limits;

    // extract n_classes out of the computed matrices
    return jenksBreaks(data, lower_class_limits, n_classes);

}
