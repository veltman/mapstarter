//For hash-based navigation
var currentHash = null;

//Initialize vars for selectors. Mixing D3 & jQuery... what could go wrong??
var body,
  mapBox,
  map,
  features,
  paths,
  upload,
  attributesHeader,        
  attributesBody,
  code,
  fileStatus,
  alert,
  attributesTable, attributesColumns, attributesRows, noAttributes,
  attributesSortColumn, attributesSortDir = -1;

//Need this as jQuery for now, D3 click simulation for upload not working
var $uploadFile;

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
  colorType: "simple",
  chloropleth: {buckets: 3, type: "numeric", scale: "YlGn", map: {}},
  zoomMode: "feature",
  responsive: false,
  tooltip: false
};

//Currently centered feature, for zoom purposes
var centered;

//Dragging variables, currently disabled

var zoom = d3.behavior.zoom().scaleExtent([1, Infinity])
    .on("zoom", function() {
      if (mapOptions.zoomMode == "free") {
        zoomed();
      }      
    });

$(document).ready(function() {

  body = d3.select("body");
  mapBox = body.select("div#map-box");
  map = mapBox.select("svg#map");
  features = map.select("g#features");
  paths = features.selectAll("path");
  upload = body.select("div#upload-target");
  fileStatus = body.select("div#file-status");
  alert = body.select("div.alert");
  noAttributes = body.select("div#no-attributes");
  attributesTable = body.select("table#attributes");
  attributesHeader = attributesTable.select("thead");
  attributesBody = attributesTable.select("tbody");
  tooltip = body.select("div#tooltip");
  code = body.select("code#download-code");    

  $uploadFile = $("#upload-file");

  map.call(zoom);

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
    if (upload.classed("loading") || fileStatus.classed("loading")) return true;
    if (d3.event.dataTransfer.files.length) {
      readFiles(d3.event.dataTransfer.files);      
    } else {
      msg("No drag-and-drop file detected.",false);
    }
  });

  //Cancel menu actions while loading
  $("ul.navbar-nav a").click(function() {
    if ((!currentFile.name || upload.classed("loading")) && !$(this).attr("href").match(/[#]?(choose-file|help)/)) {
      return false;
    }
  });

  //Clicking the drag target instead triggers a <hidden input type="file">
  upload.on("click",function() {    
    if (!upload.classed("loading") && !fileStatus.classed("loading")) $uploadFile.click();
  });

  //When that input changes, attempt to read the file
  $uploadFile.on("change",function() {
    if ($(this)[0].files.length) {      
      readFiles($(this)[0].files);      
    }
  });      

  //Listeners for form updates
  $("input#color-fill").change(function(){    
    mapOptions.fill = $(this).val();
    paths.attr("fill",mapOptions.fill);
  });

  $("input#color-stroke").change(function(){        
    mapOptions.stroke = $(this).val();    
    paths.attr("stroke",mapOptions.stroke);    
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

  $("input#responsive").change(function() {
    mapOptions.responsive = $(this).is(':checked');
  });

  $("input[name='zoom']").change(function() {
    mapOptions.zoomMode = $(this).val();
    resetMap();
  });

  $("input#tooltip-toggle").change(function() {
    var checked = $(this).is(":checked");
    $("select#tooltip-attribute").attr("disabled",!checked);
    mapOptions.tooltip = checked ? $("select#tooltip-attribute").val() : false;
  });

  $("select#tooltip-attribute").change(function() {
    mapOptions.tooltip = $(this).val();
  });

  $("select#color-chloropleth-buckets,select#color-chloropleth-type").change(showScales);

  $("button.map-update").click(function() {
    scaleMap();
  });

  $("li#choose-file a").click(function() {
    if (!upload.classed("loading") && !fileStatus.classed("loading")) $uploadFile.click();
  });

  $("a.switch-type").click(function() {
    if (!upload.classed("loading") && !fileStatus.classed("loading")) {
      
      fileStatus.classed("loading",true);          

      var to = $(this).data("switch");

      if (to == "geojson") {
        setFileType(to);
      } else if (to == "topojson") {
        
        if (currentFile.data.topo) {
          setFileType(to);
        } else {          
          $.post("geo-to-topo.php",{geojson: JSON.stringify(currentFile.data.geo)},function(topo) {
            currentFile.data.topo = topo;
            setFileType(to);
          },"json");
          //submit for conversion here
        }
      
      }
    }

    return false;
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

  initHashNav(processHash);

});

//Extra wrapper function to allow for shapefiles to be uploaded as multiple files
function readFiles(files) {

  alert.classed("hidden",true);
  upload.classed("loading",true);
  body.classed("blanked",true);

  if (files.length == 1) {
    readFile(files[0]);
  } else {
    var shp = [], dbf = [];

    for (var i = 0; i < files.length; i++) {
      if (files[i].name.match(/[.]shp$/i)) shp.push(files[i]);
      else if (files[i].name.match(/[.]dbf$/i)) dbf.push(files[i]);
    }

    if (shp.length == 1 && dbf.length <= 1) {      
      tryMultiShapefile(shp[0],dbf[0]);
    } else {
      msg("Not a valid file.  Shapefiles must be submitted one of three ways: 1) a .shp file, 2) a .shp and a .dbf file together, 3) a .zip file containing a .shp and .dbf file.",false);
      return false;
    }
  }
}

//Read in a user-inputted file
function readFile(file) {

  var newFile = {name: file.name, size: file.size, data: {topo: null, geo: null}, type: null};

  var reader = new FileReader();
  reader.onload = function (e) {

    //If it's not JSON, catch the error and try it as a shapefile instead  
    try {

      var d = JSON.parse(e.target.result);              
      newFile.type = jsonType(d);

      if (newFile.type == "topojson") {
        newFile.data.topo = d;
        newFile.data.geo = fixGeo(topojson.feature(d, d.objects[getObjectName(d)]));
      } else {
        newFile.data.geo = fixGeo(d);
      }

      if (!newFile.type) {
        tryShapefile(file);
      } else {
        loaded(newFile);
      }            
                
    } catch(err) {  
      console.log(err);       
      trySingleShapefile(file);                      
      return false;            
    }                  
    
    return true;


  };

  reader.readAsText(file);

}      

//Try file as a .shp file and a .dbf file
function tryMultiShapefile(shp,dbf) {

    //Create form with file upload
    var formData = new FormData();
    formData.append('shp', shp);
    if (dbf) formData.append('dbf', dbf);


    //Pass file to a wrapper that will cURL the real converter, gets around cross-domain
    d3.xhr("shp-to-geo.php").post(formData,function(error,response) {                

      try {
        var newFile = {name: shp.name.replace(/[.]shp$/i,".geojson"), size: response.responseText.length, data: {topo: null, geo: fixGeo(JSON.parse(response.responseText))}, type: "geojson"};
      } catch(err) {
        if (currentFile.name) body.classed("blanked",false);
        msg("Not a valid file.  Shapefiles must be submitted one of three ways: 1) a .shp file, 2) a .shp and a .dbf file together, 3) a .zip file containing a .shp and .dbf file.",false);
        return false;
      }

      loaded(newFile);

      return true;


    });

}


//Try file as a zipped shapefile
function trySingleShapefile(file) {

  //Require .zip extension
  if (file.name.match(/[.](zip|shp)$/i)) {

    //Create form with file upload
    var formData = new FormData();
    formData.append(file.name.substring(file.name.length-3).toLowerCase(), file);


    //Pass file to a wrapper that will cURL the real converter, gets around cross-domain
    d3.xhr("shp-to-geo.php").post(formData,function(error,response) {          
      try {
        var newFile = {name: file.name.replace(/[.](shp|zip)$/i,".geojson"), size: response.responseText.length, data: {topo: null, geo: fixGeo(JSON.parse(response.responseText))}, type: "geojson"};              
      } catch(err) {
        if (currentFile.name) body.classed("blanked",false);
        msg("Not a valid file.  Shapefiles must be submitted one of three ways: 1) a .shp file, 2) a .shp and a .dbf file together, 3) a .zip file containing a .shp and .dbf file.",false);
        return false;
      }

      loaded(newFile);

      return true;


    });

  } else {
    if (currentFile.name) body.classed("blanked",false);
    msg("Not a valid file.  Shapefiles must be submitted one of three ways: 1) a .shp file, 2) a .shp and a .dbf file together, 3) a .zip file containing a .shp and .dbf file.",false);

  }
}

function setFileType(to) {
  code.text("");

  currentFile.name = currentFile.name.replace(/[.](topo|geo)?json/,'')+"."+to;
  currentFile.size = JSON.stringify(to == "geojson" ? currentFile.data.geo : currentFile.data.topo).length;

  $("span.filesize").html("("+prettySize(currentFile.size)+")");

  $("a.switch-type").html("Switch to "+(to == "geojson" ? "TopoJSON" : "GeoJSON")).data("switch",(to == "geojson" ? "topojson" : "geojson"));

  currentFile.type = to;

  var filebase = currentFile.name.replace(/[.](json|topojson|geojson|shp|zip)$/,"");

  var codeContents = generateCode(currentFile,mapOptions);

  code.text(codeContents);

  $("a.data-download").attr("download",currentFile.name).html(currentFile.name).attr("href",window.URL.createObjectURL(new Blob([JSON.stringify(filterFeatures((currentFile.type == "topojson") ? currentFile.data.topo : currentFile.data.geo, currentFile.type, currentFile.skip))], { "type" : "application/json" })));

  $("a#code-download").attr("download",filebase+".html").html(filebase+".html").attr("href",window.URL.createObjectURL(new Blob([codeContents], { "type" : "text/html" })));      
  
  hljs.highlightBlock(code.node());

  fileStatus.classed("loading",false);

}

//Process newly loaded data
function loaded(newFile) {          

      body.classed("blanked",false);

      currentFile = newFile;

      if (!currentFile.skip) currentFile.skip = [];

      var f = currentFile.data.geo.features;

      if (isUSA(currentFile.data.geo)) {
        mapOptions.projectionType = "albersUsa";
        $("select#input-projection").val("albersUsa");
      } else {
        mapOptions.projectionType = "mercator";
        $("select#input-projection").val("mercator");
      }

      $("span.filesize").html("("+prettySize(currentFile.size)+")");
      $("a.switch-type").html("Switch to "+(currentFile.type == "topojson" ? "GeoJSON" : "TopoJSON")).data("switch",(currentFile.type == "topojson" ? "geojson" : "topojson"));

      $("#file-status-inner").removeClass("hidden");
      
      //Set download links
      $("a.data-download").attr("download",currentFile.name).html(currentFile.name).attr("href",window.URL.createObjectURL(new Blob([JSON.stringify((currentFile.type == "topojson") ? currentFile.data.topo : currentFile.data.geo)], { "type" : "application/json" })));


      //Get distinct properties for the attribute table, try to put ID and Name columns first, otherwise leave it alone
      var set = d3.set();
      f.forEach(function(d) {
        for (prop in d.properties) {
          set.add(prop);
        }              
      });
      attributesColumns = set.values().sort(function(a,b) {
        if (a.toLowerCase() == "id") return -1;
        if (b.toLowerCase() == "name") return -1;        
        return 0; 
      });

      attributesTable.classed("hidden",!attributesColumns.length);
      noAttributes.classed("hidden",attributesColumns.length);

      attributesBody.selectAll("tr").remove();
      attributesRows = attributesBody.selectAll("tr").data(f).enter().append("tr")
        .attr("id",function(d,i) { return "tr"+i;} )
        .on("mouseover",function(d,i) {
          if (mapOptions.colorType == "simple") map.select("path#path"+i).attr("fill",mapOptions.highlight);
        })
        .on("mouseout",function(d,i) {                
          if (mapOptions.colorType == "simple") map.select("path#path"+i+":not(.clicked)").attr("fill",mapOptions.fill);
        })
        .on("click",function(d,i) {          
          clicked(currentFile.data.geo.features[i]);
        });

      $("select#tooltip-attribute option").remove();

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

          $("select#tooltip-attribute").append($("<option />").val(a).text(a));
          $("select#color-chloropleth-attribute").append($("<option />").val(a).text(a));
          showScales();
      });

      //Populate the attribute table
      attributesHeader.selectAll("th").remove();
      attributesHeader.selectAll("th").data(attributesColumns).enter().append("th")
        .attr("class","sortable")
        .html(function(d){return '<span class="glyphicon glyphicon-sort"></span>&nbsp;'+d;})
        .on("click",function(d,i) {          
          attributesHeader.select("th.sorted").classed("sorted",false).select("span").attr("class","glyphicon glyphicon-sort");
          d3.select(this).classed("sorted",true).select("span").attr("class","glyphicon glyphicon-sort-by-attributes"+(attributesSortDir > 0 ? "-alt" : ""));
          sortAttributeRows(attributesColumns[i],-attributesSortDir);
        });
      
      //For deletion
      attributesHeader.append("th").text("");

      //For deletion
      var deletes = attributesRows.append("td")
          .attr("class","attribute-delete")
          .on("click",function() {
            d3.event.stopPropagation();            
          });

      deletes.append("a")
          //.attr("class","btn btn-default")          
          .attr("href","#")
          .on("click",function(d,i) {            
            d3.event.stopPropagation();
            d3.event.preventDefault();

            var isDeleted = d3.select("tr#tr"+i).classed("deleted");            
            if (isDeleted) {
              d3.select(this).html('<span>&times;</span> Remove').attr("title","Remove this feature");              
              if (currentFile.skip.indexOf(i) != -1) currentFile.skip = currentFile.skip.splice(currentFile.skip.indexOf(i),1);
            } else {
              d3.select(this).html('<span>+</span> Restore').attr("title","Restore this feature");              
              if (currentFile.skip.indexOf(i) == -1) currentFile.skip.push(i);
            }
            
            attributesBody.select("tr#tr"+i).classed("deleted",!isDeleted);
            map.select("path#path"+i).style("display",isDeleted ? "block" : "none");  

            $("a.data-download").attr("download",currentFile.name).html(currentFile.name).attr("href",window.URL.createObjectURL(new Blob([JSON.stringify(filterFeatures((currentFile.type == "topojson") ? currentFile.data.topo : currentFile.data.geo, currentFile.type, currentFile.skip))], { "type" : "application/json" })));
            scaleMap();

            return false;
          })
          .attr("title","Delete this feature")
          .html('<span>&times;</span> Remove');

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
          if (mapOptions.colorType == "simple") p.attr("fill",mapOptions.highlight);
          if (currentHash == "data") d3.select("tr#tr"+i).style("background-color","#e6e6e6");

          if (mapOptions.tooltip) {            
            tooltip.text(d.properties[mapOptions.tooltip]).style("top",(d3.event.pageY-35)+"px").style("left",(d3.event.pageX+5)+"px").attr("class","");
          }
        })
        .on("mousemove",function(d,i) {
          tooltip.style("top",(d3.event.pageY-35)+"px").style("left",(d3.event.pageX+5)+"px");
        })
        .on("mouseout",function(d,i) {
          var p = d3.select(this);
          if (!p.classed("clicked") && mapOptions.colorType == "simple") p.attr("fill",mapOptions.fill);
          if (currentHash == "data") d3.select("tr#tr"+i).style("background-color","#fff");
          tooltip.text("").attr("class","hidden");
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
  updateProjection(filterFeatures(currentFile.data.geo,"geojson",currentFile.skip),mapOptions.width,mapOptions.height);
}

//Remove any applied transforms
function resetMap() {
  
  paths.classed("clicked", false)
    .attr("fill",mapOptions.fill)
    .attr("stroke-width", mapOptions.strokeWidth + "px");

  features.attr("transform", null);
}

//Update the map projection, auto-setting parallels or centers based on data
function updateProjection(data,width,height) {                          

  resetMap();

  //Projection at unit scale
  mapOptions.projection = d3.geo[mapOptions.projectionType]()
      .scale(1)
      .translate([0, 0]);

  //Path generator
  mapOptions.path = d3.geo.path()
      .projection(mapOptions.projection);      

  //Use min/max lat of data as parallels for conicEqualArea
  //Rotate around lng of the data centroid
  if ("parallels" in mapOptions.projection) {
    
    var c = d3.geo.centroid(data);

    rotation = [(c[0] < 0) ? Math.abs(c[0]) : (360-c[0]) % 360,0];
    
    var bounds = d3.geo.bounds(data);
    mapOptions.projection.center(c)
      .parallels([bounds[0][1],bounds[1][1]])
      .rotate(rotation);
  }            

  //Find the max scale based on data bounds at unit scale, with 5% padding
  var b = mapOptions.path.bounds(data),
      s = .95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height),
      t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];

  mapOptions.projection.scale(s);

  if ("parallels" in mapOptions.projection) {
    mapOptions.projection.translate(t);
  } else {

    if ("center" in mapOptions.projection) {

      //Infer the true map center from the pixels, reset the projection to have simple center/translate for code readability
      mapOptions.projection.translate([0,0]);

      var inv = mapOptions.projection.invert([width/2 - t[0], height/2 - t[1]]);      

      mapOptions.projection.center(inv);
  
    } else {

      //It's a fixed proj like albersUsa, just scale it
      mapOptions.projection = d3.geo[mapOptions.projectionType]()
        .scale(s);

    }

    //Can't do this with conic because of discrepancy between centroid and simple center
    //(middle x, middle y not same as weighted centroid unless it's a perfectly regular shape)
    mapOptions.projection.translate([width/2,height/2]);

    mapOptions.path = d3.geo.path()
      .projection(mapOptions.projection);

  }

  paths.attr("d",mapOptions.path);

}

//Zooming to a feature
function clicked(d) {    
  if (mapOptions.zoomMode != "feature") return true;
  
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

  paths
      .classed("clicked", centered && function(d) { return d === centered; })
      //.attr("fill", function(d) { return (centered && d === centered) ? mapOptions.highlight : mapOptions.fill; })
      .attr("stroke-width", mapOptions.strokeWidth / k + "px");

  if (mapOptions.colorType == "simple") paths.attr("fill", function(d) { return (centered && d === centered) ? mapOptions.highlight : mapOptions.fill; });

  features.transition()
      .duration(750)
      .attr("transform", "translate(" + mapOptions.width / 2 + "," + mapOptions.height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")");
}

function zoomed() {
  features.attr("transform", "translate(" + zoom.translate() + ")scale(" + zoom.scale() + ")");
  paths.attr("stroke-width",mapOptions.strokeWidth/zoom.scale() + "px" );  
}

//Based on map options, loop through features and generate SVG markup with styles
function getSVG() {
  var svg = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="'+mapOptions.width+'" height="'+mapOptions.height+'" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">';

  currentFile.data.geo.features.forEach(function(d,i) {
    if (!currentFile.skip || currentFile.skip.indexOf(i) == -1) svg += '<path stroke-width="'+mapOptions.strokeWidth+'" stroke="'+mapOptions.stroke+'" fill="'+mapOptions.fill+'" d="'+mapOptions.path(d)+'" />';
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

  alert.select("div").html(message).classed("alert-danger",true).classed("alert-info",false).classed("hidden",false);

  upload.classed("loading",false);
          
}

//Get the first object set from a TopoJSON file
function getObjectName(topo) {
  for (var i in topo.objects) return i;
  return false;
}

//If it's GeoJSON but not a FeatureCollection, make it a FeatureCollection with a single feature for consistency
function fixGeo(g) {

  if (g.type == "FeatureCollection")  return g;

  if (g.type == "Feature") return {type: "FeatureCollection", features: [g]};

  return {type: "FeatureCollection", features: [{type: "Feature", geometry: g, properties: {}}]};

}

function processHash(hash) {
    if (currentHash != hash.base) {            
      currentHash = (hash.base.length && (currentFile.data || hash.base == "help")) ? hash.base : "choose-file";
      window.location.hash = currentHash;
    }
    showSection(currentHash);         
}

//hashNav function for showing/hiding sections, generating stuff as needed
function showSection(section) {
  $("ul.navbar-nav li").removeClass("active");
  $("li#"+section).addClass("active");
  $("div.mapstarter-section").addClass("hidden");
  $("div#section-"+section).removeClass("hidden");
  alert.classed("hidden",true);

  if (currentFile && currentFile.name) resetMap();

  if (section.match(/^(download|choose-file|help)/)) {     
    
    if (section == "download-svg") {            

      var filename = currentFile.name.replace(/[.](json|topojson|geojson|shp|zip)$/,"")+".svg";

      $("a#svg-download").attr("download",filename).attr("href",window.URL.createObjectURL(new Blob([getSVG()], { "type" : "text/xml" })));            
      return true;

    } else if (section == "download-code") {

      var filebase = currentFile.name.replace(/[.](json|topojson|geojson|shp|zip)$/,"");

      var codeContents = generateCode(currentFile,mapOptions);

      code.text(codeContents);

      $("a#code-download").attr("download",filebase+".html").html(filebase+".html").attr("href",window.URL.createObjectURL(new Blob([codeContents], { "type" : "text/html" })));      
      
      hljs.highlightBlock(code.node());

      return true;
    }
  
    if (section == "download-image") {            

      $("div#pancake-div").addClass("loading");

      var flapjack = Pancake("map");
      $("img#pancake-img").attr("src",flapjack.src);

      $("button#pancake-download").click(function() {
        flapjack.download(currentFile.name+".png");
      });

      $("div#pancake-div").removeClass("loading");

    }

  }
    
  mapBox.classed("hidden",section.match(/^(download-image|choose-file|help)$/));
}

//Attempt to detect a US map including AK and HI, switch to albersUsa
function isUSA(data) {
  var a = d3.geo.area(data),
  b = d3.geo.bounds(data);

  return (a > 0.21 && a < 0.24 && b[0][0] > 170 && b[0][0] < 174 && b[0][1] > 15 && b[0][1] < 19 && b[1][0] > -67 && b[1][0] < -61 && b[1][1] > 68 && b[1][1] < 74);

}

//Filter features for file download links, removing features that are marked as removed in the "Data" tab
function filterFeatures(data,type,skip) {  
  var newData = $.extend(true,{},data);
  if (!skip || !skip.length) return newData;

  if (type == "topojson") {
    var o = getObjectName(data);    
    newData.objects[o].geometries = newData.objects[o].geometries.map(function(d,i) {
      return (skip.indexOf(i) == -1) ? d : null;
    }).filter(function(d) {
      return d !== null;
    });
  } else {

    newData.features = newData.features.map(function(d,i) {
      return (skip.indexOf(i) == -1) ? d : null;
    }).filter(function(d) {
      return d !== null;
    });
  }
  
  return newData;
}

// Sort the attribute rows.  Stringify any deep objects/arrays, treat numbers as numbers,
// otherwise sort in lexicographic order, putting empty cells last
function sortAttributeRows(column,direction) {
  attributesSortColumn = column;
  attributesSortDir = direction;

  var data = attributesRows.data;
  var sorted = [];  

  var numeric = true;

  attributesRows.data().forEach(function(d,i) {
    if (numeric && d.properties[column] && typeof d.properties[column] !== "number") {
      numeric = false;
    }

    sorted.push({index: i, data: d});    

  });

  //Do numeric sort if all numbers, otherwise lexicographic
  if (numeric) sorted.sort(function(a,b) {
    if (direction > 0) {
      var s1 = a.data.properties[column], s2 = b.data.properties[column];
    } else {
      var s1 = b.data.properties[column], s2 = a.data.properties[column];
    }
    if (typeof s1 !== "number") return 1;
    if (typeof s2 !== "number") return -1;    
    
    s1 = parseFloat(s1);
    s2 = parseFloat(s2);

    if (s1 < s2) return -1;
    if (s2 < s1) return 1;
    return 0;    
  });
  else sorted.sort(function(a,b) {
    if (direction > 0) {
      var s1 = a.data.properties[column], s2 = b.data.properties[column];
    } else {
      var s1 = b.data.properties[column], s2 = a.data.properties[column];
    }

    if (!s1) return 1;
    if (!s2) return -1;

    if (typeof s1 !== "string") s1 = JSON.stringify(s1);
    if (typeof s2 !== "string") s2 = JSON.stringify(s2);

    if (s1 < s2) return -1;
    if (s2 < s1) return 1;
    return 0;    
  });

  sorted.forEach(function(r) {    
    $("tr#tr"+r.index).appendTo(attributesBody.node());
  });
}

function showScales() {  
  
  //d3.select("div#color-chloropleth-scales").selectAll(".palette").remove();

  mapOptions.chloropleth.buckets = parseInt($("select#color-chloropleth-buckets").val());
  mapOptions.chloropleth.type = $("select#color-chloropleth-type").val();  
  
  var numOptions = $("select#color-chloropleth-buckets option").length;

  if (mapOptions.chloropleth.type == "numeric" && numOptions > 9) {
    $("select#color-chloropleth-buckets option:gt(8)").remove();
  } else if (mapOptions.chloropleth.type == "categories" && numOptions < 10) {
    $("select#color-chloropleth-buckets").append($("<option />").val("12").text("12"));
  }

  var scales = d3.select("div#color-chloropleth-scales").selectAll(".palette").data(d3.entries(colorbrewer[mapOptions.chloropleth.type]).filter(function(d) {
    return d.value[mapOptions.chloropleth.buckets];
  }).map(function(d) {
    return {key: d.key, value: d.value[mapOptions.chloropleth.buckets]};
  }));

  scales.exit().remove();

  scales.enter().append("div");

  scales.attr("class",function(d,i) {
      return "palette"+(d.key == mapOptions.chloroplethScale ? " selected" : "");
    })
    .attr("title",function(d){return d.key;})
    .attr("id",function(d){return d.key;})
    .on("click",function(d) {

      var palette = d3.select(this);
      if (!palette.classed("selected")) {
        d3.select(".palette.selected").attr("class","palette");
        palette.attr("class","palette selected");
        mapOptions.chloropleth.scale = d.key;
        scaleChanged();
      }

    })      
    .selectAll(".swatch")
      .data(function(d){return d.value;})
      .enter().append("div")
      .attr("class","swatch")                        
      .style("background-color",function(d){ return d;});

  if (!d3.select(".palette.selected").length) {
    d3.select(".palette").attr("class","palette selected");
    console.log(d3.select(".palette").data());
  }
}

function scaleChanged() {
  var colors = colorbrewer[mapOptions.chloropleth.type][mapOptions.chloropleth.scale][mapOptions.chloropleth.buckets];
  paths.attr("fill",function(d){
    return colors[Math.floor(colors.length*Math.random())];
  });
}