//Initialize selectors. Mixing D3 & jQuery... what could go wrong??
var mapBox = d3.select("div#map-box"),
  map = d3.select("svg#map"),
  draggable = map.select("g#draggable"),
  features = map.select("g#features"),
  paths = features.selectAll("path"),
  upload = d3.select("div#upload-target"),
  attributesHeader = d3.select("table#attributes thead"),        
  attributesBody = d3.select("table#attributes tbody"),
  code = d3.select("code#download-code"),
  attributesColumns, attributesRows;

//Need this as jQuery for now, D3 click simulation for upload not working      
var $uploadFile = $("#upload-file");

//Storing file properties
var currentFile = {
  data: null,
  name: null,
  size: null,
  type: null
};

//Default dimensions, colors, map projection, basic behavior
var mapOptions = {
  width: 600,
  height: 600,        
  projectionType: "mercator",
  projection: null,
  path: null,
  strokeWidth: 1,
  stroke: "white",
  fill: "steelblue",
  highlight: "tomato",
  dragToPan: false,
  clickToZoom: true,
  tooltip: false  
};
      
//Define drag behavior and currently centered feature for zoom purposes
var centered,
  dragX,
  dragY,
  dragBounds,
  dragging = false,
  drag = d3.behavior.drag().on("drag", function() {

    //Disable this for now
    return true;

    dragging = true;
    
    if (!mapOptions.dragToPan) return true;

    d3.event.sourceEvent.stopPropagation();
    
    dragX += d3.event.dx;
    dragY += d3.event.dy;

    draggable.attr("transform", "translate(" + [ dragX,dragY ] + ")");
    
  }).on("dragend", function() {

      dragging = false;

  });

map.call(drag);

//Handlers for the upload target
upload.on("dragenter",noop);
upload.on("dragexit",noop);
upload.on("dragover", function() {
  noop();
  d3.event.dataTransfer.dropEffect = 'copy';
});

//When a user drops a file, attempt to read it
upload.on("drop",function() {               
  noop();
  if (upload.classed("loading")) return true;
  if (d3.event.dataTransfer.files.length) {
    readFile(d3.event.dataTransfer.files[0]);
  } else {
    msg("No drag-and-drop file detected.",false);
  }
});

//Clicking the drag target instead triggers a <hidden input type="file">
upload.on("click",function() {       
  if (!upload.classed("loading")) $uploadFile.click();
});

//When that input changes, attempt to read the file
$uploadFile.on("change",function() {
  if ($(this)[0].files.length) {          
    readFile($(this)[0].files[0]);
  }
});      

//Listeners for form updates
$("input#color-fill").change(function(){
  mapOptions.fill = $(this).val(); paths.attr("fill",mapOptions.fill);
});

$("input#color-stroke").change(function(){
  mapOptions.stroke = $(this).val(); paths.attr("stroke",mapOptions.stroke);
});

$("input#color-highlight").change(function(){
  mapOptions.highlight = $(this).val();
});

$("input#color-stroke-width").change(function() {        
  var w = parseFloat($(this).val());        
  $(this).val(w);
  mapOptions.strokeWidth = w;
  paths.attr("stroke-width",mapOptions.strokeWidth);
});

$("input#input-height").change(function(){
  var h = Math.max(0,Math.min(3600,parseInt($(this).val())));
  $(this).val(h);
  mapOptions.height = h;
  scaleMap();
});

$("input#input-width").change(function(){        
  var w = Math.max(0,Math.min(3600,parseInt($(this).val())));
  $(this).val(w);
  mapOptions.width = w;
  scaleMap();
});

$("#input-projection").change(function() {        

  mapOptions.projectionType = $(this).val();
  scaleMap();  
});

$("input#pannable").change(function() {
  
  mapOptions.dragToPan = $(this).is(':checked');
  resetMap();

});

$("input#zoomable").change(function() {
  
  mapOptions.clickToZoom = $(this).is(':checked');
  resetMap();

});

$("button.map-update").click(function() {
  scaleMap();
});

//Process sample data links
$("a.sample-data").click(function() {      
  var fn = $(this).data("filename");
  
  if (fn == "random") {

    var countryCodes = {"1":"AW","2":"AF","3":"AO","4":"AI","5":"AL","6":"AX","7":"AD","8":"AE","9":"AR","10":"AM","11":"AS","12":"AQ","13":"TF","14":"AG","15":"AU","16":"AT","17":"AZ","18":"BI","19":"BE","20":"BJ","21":"BF","22":"BD","23":"BG","24":"BH","25":"BS","26":"BA","27":"BL","28":"BY","29":"BZ","30":"BM","31":"BO","32":"BR","33":"BB","34":"BN","35":"BT","36":"BW","37":"CF","38":"CA","39":"CH","40":"CL","41":"CN","42":"CI","43":"CM","44":"CD","45":"CG","46":"CK","47":"CO","48":"KM","49":"CV","50":"CR","51":"CU","52":"CW","53":"KY","54":"CY","55":"CZ","56":"DE","57":"DJ","58":"DM","59":"DK","60":"DO","61":"DZ","62":"EC","63":"EG","64":"ER","65":"ES","66":"EE","67":"ET","68":"FI","69":"FJ","70":"FK","71":"FR","72":"FO","73":"FM","74":"GA","75":"GB","76":"GE","77":"GG","78":"GH","79":"GI","80":"GN","81":"GM","82":"GW","83":"GQ","84":"GR","85":"GD","86":"GL","87":"GT","88":"GU","89":"GY","90":"HK","91":"HM","92":"HN","93":"HR","94":"HT","95":"HU","96":"ID","97":"IM","98":"IN","99":"IO","100":"IE","101":"IR","102":"IQ","103":"IS","104":"IL","105":"IT","106":"JM","107":"JE","108":"JO","109":"JP","110":"KZ","111":"KE","112":"KG","113":"KH","114":"KI","115":"KN","116":"KR","117":"KW","118":"LA","119":"LB","120":"LR","121":"LY","122":"LC","123":"LI","124":"LK","125":"LS","126":"LT","127":"LU","128":"LV","129":"MO","130":"MF","131":"MA","132":"MC","133":"MD","134":"MG","135":"MV","136":"MX","137":"MH","138":"MK","139":"ML","140":"MT","141":"MM","142":"ME","143":"MN","144":"MP","145":"MZ","146":"MR","147":"MS","148":"MU","149":"MW","150":"MY","151":"NA","152":"NC","153":"NE","154":"NF","155":"NG","156":"NI","157":"NU","158":"NL","159":"NO","160":"NP","161":"NR","162":"NZ","163":"OM","164":"PK","165":"PA","166":"PN","167":"PE","168":"PH","169":"PW","170":"PG","171":"PL","172":"PR","173":"KP","174":"PT","175":"PY","176":"PS","177":"PF","178":"QA","179":"RO","180":"RU","181":"RW","182":"EH","183":"SA","184":"SD","185":"SS","186":"SN","187":"SG","188":"GS","189":"SH","190":"SB","191":"SL","192":"SV","193":"SM","194":"SO","195":"PM","196":"RS","197":"ST","198":"SR","199":"SK","200":"SI","201":"SE","202":"SZ","203":"SX","204":"SC","205":"SY","206":"TC","207":"TD","208":"TG","209":"TH","210":"TJ","211":"TM","212":"TL","213":"TO","214":"TT","215":"TN","216":"TR","217":"TV","218":"TW","219":"TZ","220":"UG","221":"UA","222":"UM","223":"UY","224":"US","225":"UZ","226":"VC","227":"VE","228":"VG","229":"VI","230":"VN","231":"VU","232":"WF","233":"WS","234":"YE","235":"ZA","236":"ZM","237":"ZW"}

    var rand = Math.ceil(Math.random()*235);          

    fn = rand+".json";    

  }                

  upload.classed("loading",true);
  
  d3.json("samples/"+fn,function(error,newFile) {          
    loaded(newFile);
  });        

  return false;
});

//Read in a user-inputted file
function readFile(file) {

  upload.classed("loading",true);

  var newFile = {name: file.name, size: file.size, data: null, type: null};

  var reader = new FileReader();
  reader.onload = function (e) {

    //If it's not JSON, catch the error and try it as a shapefile instead  
    try {

      newFile.data = JSON.parse(e.target.result);            
      newFile.type = jsonType(newFile.data);

      if (!newFile.type) {
        tryShapefile(file);
      } else {
        loaded(newFile);
      }            
                
    } catch(err) {  
      console.log(err);       
      tryShapefile(file);                      
      return false;            
    }                  
    
    return true;


  };

  reader.readAsText(file);

}      

//Try file as a zipped shapefile
function tryShapefile(file) {

  //ADC's converter requires .zip extension
  if (file.name.match(/[.]zip$/)) {

    //Create form with file upload
    var formData = new FormData();
    formData.append('shapefile', file);


    //Pass file to a wrapper that will cURL the real converter, gets around cross-domain
    d3.xhr("shapefile.php").post(formData,function(error,response) {          
      try {
        var newFile = {name: file.name, size: file.size, data: JSON.parse(response.responseText), type: "geojson"};              
      } catch(err) {         
        msg("Not a valid file.  Shapefiles must be .zip files including a .shp, .dbf, and .shx file.",false);
        return false;
      }

      loaded(newFile);

      return true;


    });

  } else {

    msg("Not a valid file.  Shapefiles must be .zip files including a .shp, .dbf, and .shx file.",false);

  }
}

//Process newly loaded data
function loaded(newFile) {          

      //If it's TopoJSON, convert it first (only one object per topology supported, for now)
      if (newFile.type === "geojson" && newFile.data.type != "FeatureCollection")  {
        //If it's GeoJSON but not a FeatureCollection, make it a FeatureCollection with a single feature for consistency

        //It's a geometry, put it into an empty feature
        if (newFile.data.type != "Feature") {
          newFile.data = {type: "Feature", geometry: newFile.data, properties: {}};
        }

        //Create FeatureCollection
        newFile.data = {type: "FeatureCollection", features: [newFile.data]};

      }

      //If it's TopoJSON, convert it first
      if (newFile.type == "geojson") {
        var f = newFile.data.features;
      } else {
        var f = topojson.feature(newFile.data, newFile.data.objects[getObjectName(newFile.data)]);
      }      

      //Update current file display
      msg("Current File: <span>"+newFile.name+"</span> ("+prettySize(newFile.size)+")",true);           

      currentFile = newFile;
      
      //Get distinct properties for the attribute table, try to put ID and Name columns first, otherwise leave it alone
      var set = d3.set();
      currentFile.data.features.forEach(function(d) {
        for (prop in d.properties) {
          set.add(prop);
        }              
      });
      attributesColumns = set.values().sort(function(a,b) {
        if (a.toLowerCase() == "id") return -1;
        if (b.toLowerCase() == "name") return -1;        
        return 0; 
      });

      //Populate the attribute table
      attributesHeader.selectAll("th").remove();
      attributesHeader.selectAll("th").data(attributesColumns).enter().append("th").text(function(d){return d;});
      attributesBody.selectAll("tr").remove();
      attributesRows = attributesBody.selectAll("tr").data(f).enter().append("tr")
        .attr("id",function(d,i) { return "tr"+i;} )
        .on("mouseover",function(d,i) {
          map.select("path#path"+i).attr("fill",mapOptions.highlight);
        })
        .on("mouseout",function(d,i) {                
          map.select("path#path"+i+":not(.clicked)").attr("fill",mapOptions.fill);
        })
        .on("click",function(d,i) {          
          clicked(currentFile.data.features[i]);
        });

      //Stringify any non-primitive data values
      attributesColumns.forEach(function(a) {
        attributesRows.append("td")
          .text(function(d) {
            if (d.properties[a]) {
              if (typeof d.properties[a] === "number" || typeof d.properties[a] === "string") return d.properties[a];
              return JSON.stringify(d.properties[a], null, " ");
            } 
            return "";
          });
      });

      paths.remove();

      //Insert paths with hover events for highlighting
      paths = features.selectAll("path").data(f).enter().append("path")
        .attr("stroke-width",mapOptions.strokeWidth)
        .attr("stroke",mapOptions.stroke)
        .attr("fill",mapOptions.fill)
        .attr("id",function(d,i) {
          return "path"+i;
        })
        .on("click",clicked)
        .on("mouseover",function(d,i) {            
          
          var p = d3.select(this);
          p.attr("fill",mapOptions.highlight);
          if (currentHash == "data") d3.select("tr#tr"+i).style("background-color","#e0e0e0");
        })
        .on("mouseout",function(d,i) {

          var p = d3.select(this);
          if (!p.classed("clicked")) p.attr("fill",mapOptions.fill);
          if (currentHash == "data") d3.select("tr#tr"+i).style("background-color","#fff");

      });      

      //Draw the map
      scaleMap();      

      upload.classed("loading",false);

      //Send them to the size/projection page first
      window.location.hash = "size";

}

//Detect GeoJSON vs. TopoJSON
function jsonType(data) {
  if (typeof data !== "object" || !data.type) return null;
  if (data.type === "Topology" && data.objects && getObjectName(data)) return "topojson";
  if (["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection", "Feature", "FeatureCollection"].indexOf(data.type) == -1) return null;
  return "geojson";
}

//Prevent d3 mouse defaults
function noop() {
  d3.event.stopPropagation();
  d3.event.preventDefault();
}

function scaleMap() {

  resetMap();

  map.attr("width",mapOptions.width)
    .attr("height",mapOptions.height);

  //Update surrounding dive
  mapBox
    .style("width",mapOptions.width+"px")
    .style("height",mapOptions.height+"px");

  //Update the projection to center and fit in the provided box
  updateProjection(currentFile.data,mapOptions.width,mapOptions.height);
}

//Remove any applied transforms
function resetMap() {

  draggable.attr("transform",null);
  dragX = 0, dragY = 0;
  
  paths.classed("clicked", false)
    .attr("fill",mapOptions.fill)
    .attr("stroke-width", mapOptions.strokeWidth + "px");

  features.attr("transform", null);
}

//Update the map projection, auto-setting parallels or centers based on data
function updateProjection(data,width,height) {                          

  resetMap();

  // Create a unit projection.
  mapOptions.projection = d3.geo[mapOptions.projectionType]()
      .scale(1)
      .translate([0, 0]);                    

  // Create a path generator.
  mapOptions.path = d3.geo.path()
      .projection(mapOptions.projection);

  // Compute the bounds of a feature of interest, then derive scale & translate.
  var b = mapOptions.path.bounds(data),
      s = .95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height),
      t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];

  //t = t.map(function(d){return d-100;});

  /*mapOptions.projection = */


  mapOptions.projection = d3.geo[mapOptions.projectionType]()
      .scale(s)
      .translate([0, 0]);    

  mapOptions.path = d3.geo.path()
      .projection(mapOptions.projection);       

  if ("center" in mapOptions.projection) {
      
    if (mapOptions.projectionType == 'conicEqualArea') {
      var c = d3.geo.centroid(data);
      var rotation = [(c[0] < 0) ? Math.abs(c[0]) : (360-c[0]) % 360,0];      
      var bounds = d3.geo.bounds(data);
      mapOptions.projection
        .parallels([bounds[0][1],bounds[1][1]])
        .rotate(rotation);    
    } else {
      var c = mapOptions.projection.invert([width/2 - t[0], height/2 - t[1]]);
      mapOptions.projection.center(c);
    }

  }

  mapOptions.projection.translate([width/2,height/2]);
  //mapOptions.projection.invert([]);
  //console.log(t);

  paths.attr("d",mapOptions.path);

}

//Zooming to a feature
function clicked(d) {  
  if (!mapOptions.clickToZoom) return true;
  
  var x, y, k;

  if (d && centered !== d) {        

    var centroid = mapOptions.path.centroid(d);
    var b = mapOptions.path.bounds(d);

    x = centroid[0];
    y = centroid[1];          
    k = .8 / Math.max((b[1][0] - b[0][0]) / mapOptions.width, (b[1][1] - b[0][1]) / mapOptions.height);

    centered = d;

  } else {
    x = mapOptions.width / 2;
    y = mapOptions.height / 2;
    k = 1;
    centered = null;
  }

  features.selectAll("path")
      .classed("clicked", centered && function(d) { return d === centered; })
      .attr("fill", function(d) { return (centered && d === centered) ? mapOptions.highlight : mapOptions.fill; })
      .attr("stroke-width", mapOptions.strokeWidth / k + "px");

  features.transition()
      .duration(750)
      .attr("transform", "translate(" + mapOptions.width / 2 + "," + mapOptions.height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")");
}

//Based on map options, loop through features and generate SVG markup with styles
function getSVG() {
  var svg = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="'+mapOptions.width+'" height="'+mapOptions.height+'" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">';

  currentFile.data.features.forEach(function(d) {
    svg += '<path stroke-width="'+mapOptions.strokeWidth+'" stroke="'+mapOptions.stroke+'" fill="'+mapOptions.fill+'" d="'+mapOptions.path(d)+'" />';
  });

  svg += '</svg>';
  return svg;
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

//Throw an error message
function msg(message,success) {

  var $alert = $("div.alert:first");

  $alert.find("div").html(message);

  if (success) {
    $alert.removeClass("alert-danger").addClass("alert-info");
  } else {
    $alert.addClass("alert-danger").removeClass("alert-info");
  }

  $alert.removeClass("hidden").show();
  upload.classed("loading",false);
          
}

function getObjectName(topo) {
  for (var i in topo.objects) return i;
  return false;
}

/*
function getTopo() {
  //Passively convert to TopoJSON in the background
  if (newFile.type == "geojson") {
    console.log('sending new data');
    $.post("to-topojson.php",{geojson: JSON.stringify(newFile.data)},function(data) {
      if (data)
      currentFile.topo = data;
    },"json");
  }
}


*/