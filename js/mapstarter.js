//For hash-based navigation
var currentSection = "choose-file";

//Initialize vars for selectors. Mixing D3 & jQuery... what could go wrong??
var body,
  mapBox,
  map,
  features,
  paths,
  filledPaths,
  upload,
  attributesHeader,        
  attributesBody,
  code,
  fileStatus,
  fileSize,
  switchLinks,
  alerts,  
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
  chloropleth: {buckets: 3, type: "numeric", scaleName: "YlGn", scale: d3.scale.quantize(), reverse: false, attribute: null, map: {}, default: "#999", attributeProblem: false},
  zoomMode: "free",
  responsive: false,
  tooltip: false
};

//Currently centered feature, for zoom purposes
var centered;

var zoom = d3.behavior.zoom().scaleExtent([1, Infinity])
    .on("zoom", function() {
      if (mapOptions.zoomMode == "free") {
        zoomed();
      }      
    });

var messages = {
  "no-file": {
    "type": "error",
    "text": "No drag-and-drop file received."
  },
  "invalid-file": {
    "type": "error",
    "text": "Invalid file.  If you're submitting a shapefile, make sure you submit the .shp file, or a .zip file containing it."
  },
  "no-dbf": {
    "type": "warn",
    "text": "Your map won't include any feature attributes (like names).  Either your data has none, or you didn't upload the .dbf file stored in the shapefile.  To include those attributes, make sure you submit both the .shp and .dbf file, or a .zip file containing both."
  },
  "bad-albers": {
    "type": "warn",
    "text": "The Albers USA projection should only be used if your map is of the entire US, including Alaska and Hawaii. It will fail with any other geography."
  },
  "non-numeric": {
    "type": "warn",
    "text": "Some of the data in the attribute you're using for the color scale is non-numeric or empty, it will be given the default color instead.  To inspect the data, use the Data tab."
  },
  "shp-too-big": {
    "type": "error",
    "text": "Sorry, shapefiles are currently limited to 15 MB.  Try converting it to GeoJSON here first: http://ogre.adc4gis.com/"
  },
  "geo-too-big": {
    "type": "error",
    "text": "Sorry, conversions to TopoJSON are currently limited to 15 MB of GeoJSON."
  }  
};

$(document).ready(function() {

  body = d3.select("body");
  mapBox = body.select("div#map-box");
  map = mapBox.select("svg#map").call(zoom);
  features = map.select("g#features");
  paths = features.selectAll("path");
  upload = body.select("div#upload-target");
  fileStatus = body.select("div#file-status");
  fileSize = body.selectAll("span.filesize");
  switchLinks = body.selectAll("a.switch-type");
  alerts = body.select("div#alerts");
  noAttributes = body.select("div#no-attributes");
  attributesTable = body.select("table#attributes");
  attributesHeader = attributesTable.select("thead");
  attributesBody = attributesTable.select("tbody");
  tooltip = body.select("div#tooltip");
  code = body.select("code#download-code");    

  $uploadFile = $("#upload-file");

  setListeners();

  d3.select("div#page-loaded").classed("hidden",false);
  d3.select("div#page-loading").remove();

});




//Process newly loaded data
function loaded(newFile) {          

      body.classed("blanked",false);      

      currentFile = newFile;      

      if (!currentFile.skip) currentFile.skip = [];

      switchLinks.datum(currentFile.type == "geojson" ? "topojson" : "geojson");

      //Choose a projection based on the data
      chooseDefaultProjection(currentFile.data.geo);      

      //Get distinct properties for the attribute table, try to put ID and Name columns first, otherwise leave it alone
      var set = d3.set();

      if (currentFile.data.topo) {
        var o = getObjectName(currentFile.data.topo);

        currentFile.data.topo.objects[o].geometries.forEach(function(d,i) {
          if (!d.properties) currentFile.data.topo.objects[o].geometries[i].properties = {};          
        });

      }

      currentFile.data.geo.features.forEach(function(d,i) {
        if (!d.properties) currentFile.data.geo.features[i].properties = {};

        for (prop in d.properties) {
          set.add(prop);
        }
      });

      //moving this lower
      //setFileType(currentFile.type);


      attributesColumns = set.values().sort(function(a,b) {
        if (a.toLowerCase() == "id") return -1;
        if (b.toLowerCase() == "name") return -1;        
        return 0;
      });

      attributesTable.classed("hidden",!attributesColumns.length);
      noAttributes.classed("hidden",attributesColumns.length);

      attributesBody.selectAll("tr").remove();
      attributesRows = attributesBody.selectAll("tr").data(currentFile.data.geo.features).enter().append("tr")
        .attr("id",function(d,i) { return "tr"+i;} )
        .on("mouseover",function(d,i) {
          if (mapOptions.colorType == "simple") d3.select("#path"+i+".filled").attr("fill",mapOptions.highlight);
        })
        .on("mouseout",function(d,i) {                
          if (mapOptions.colorType == "simple") d3.select("#path"+i+".filled:not(.clicked)").attr("fill",mapOptions.fill);
        });

      $("select#tooltip-attribute option,select#color-chloropleth-attribute option").remove();

      //Stringify any non-primitive data values
      attributesColumns.forEach(function(a,i) {

        if (!i) mapOptions.chloropleth.attribute = a;

        attributesRows.append("td")
          .text(function(d) {
            if (a in d.properties) {              
              if (typeof d.properties[a] === "number" || typeof d.properties[a] === "string") return ""+d.properties[a];
              return JSON.stringify(d.properties[a], null, " ");
            } 
            return "";
          }).on("click",function(d,rowIndex) {                        
            //Don't allow editing of deep objects/arrays            
            if (a in d.properties && typeof d.properties[a] !== "number" && typeof d.properties[a] !== "string") return true;

            var cell = d3.select(this);
            var t = cell.text();

            var w = cell.style("width");
            var h = cell.style("height");            

            cell.html("").append("input")
              .style("width",w)
              .style("height",h)
              .attr("class","text")
              .attr("value",t)
              .datum(t)
              .on("click",function() {
                d3.event.stopPropagation();
              })
              .on("keypress",function(){                                
                if (d3.event.keyCode == 13) d3.select(this).node().blur();
              })
              .on("blur",function(original) {                                
                var input = d3.select(this);
                if (input.empty()) return true;

                var val = this.value;                
                input.remove();

                cell.text(val);

                currentFile.data.geo.features[rowIndex].properties[a] = val;
                if (currentFile.data.topo) {
                  var o = getObjectName(currentFile.data.topo);
                  currentFile.data.geo.objects[o].geometries[rowIndex].properties[a] = val;
                }

                if (mapOptions.colorType == "chloropleth") recolor();

                updateDownloads("data");                
              })
              .node().focus();            
          });

          $("select.attribute-list").append($("<option />").val(a).text(a));
      });

      populateScales();

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
          .attr("href","#")
          .on("click",function(d,i) {            
            d3.event.stopPropagation();
            d3.event.preventDefault();

            var isDeleted = d3.select("tr#tr"+i).classed("deleted");            
            if (isDeleted) {
              d3.select(this).html('<span>&times;</span>&nbsp;Remove').attr("title","Remove this feature");              
              currentFile.skip = currentFile.skip.filter(function(s) { return s != i;});
            } else {              
              d3.select(this).html('<span>+</span>&nbsp;Restore').attr("title","Restore this feature");              
              if (currentFile.skip.indexOf(i) == -1) currentFile.skip.push(i);
            }
            
            attributesBody.select("tr#tr"+i).classed("deleted",!isDeleted);
            map.select("path#path"+i).style("display",isDeleted ? "block" : "none");  

            updateDownloads("data");
            scaleMap();
            if (mapOptions.colorType == "chloropleth") recolor();

            return false;
          })
          .attr("title","Delete this feature")
          .html('<span>&times;</span>&nbsp;Remove');

      paths.remove();

      //Insert paths with hover events for highlighting
      paths = features.selectAll("path").data(currentFile.data.geo.features).enter().append("path")
        .attr("stroke-width",mapOptions.strokeWidth)
        .attr("stroke",mapOptions.stroke)        
        .attr("id",function(d,i) {
          return "path"+i;
        })
        .attr("fill",function(d) {
          if (d.geometry.type == "LineString") return "none";
          return null;
        })
        .attr("class",function(d) {
          if (d.geometry.type == "LineString") return null;
          return "filled";
        })
        .on("click",clicked)
        .on("mouseover",function(d,i) {            
          var p = d3.select(this).filter(".filled");
          if (mapOptions.colorType == "simple") p.attr("fill",mapOptions.highlight);
          if (currentSection == "data") d3.select("tr#tr"+i).style("background-color","#e6e6e6");

          if (mapOptions.tooltip) {            
            var t = (typeof d.properties[mapOptions.tooltip] == "string" || d.properties[mapOptions.tooltip] == "number") ? d.properties[mapOptions.tooltip] : JSON.stringify(d.properties[mapOptions.tooltip]);
            tooltip.text(t).style("top",(d3.event.pageY-35)+"px").style("left",(d3.event.pageX+5)+"px").attr("class","");
          }
        })
        .on("mousemove",function(d,i) {
          tooltip.style("top",(d3.event.pageY-35)+"px").style("left",(d3.event.pageX+5)+"px");
        })
        .on("mouseout",function(d,i) {
          var p = d3.select(this).filter(".filled");
          if (!p.classed("clicked") && mapOptions.colorType == "simple") p.attr("fill",mapOptions.fill);
          if (currentSection == "data") d3.select("tr#tr"+i).style("background-color","#fff");
          tooltip.text("").attr("class","hidden");
      });
      
      filledPaths = paths.filter(function(d) { return d.geometry.type != "LineString"; });

      resetOptions();
      
      //Draw the map
      scaleMap();      

      //Crop unnecessary whitespace from the non-limiting dimension on initial load
      autoCrop();

      recolor();

      setFileType(currentFile.type);

      uploadComplete();

      //Send them to the size/projection page first
      showSection("size",true);

}

//Throw an error message
function msg(key) {

  msgClear(key);

  var a = alerts.append("div")
    .attr("class","alert "+messages[key].type+" "+key)
    .text(messages[key].text);
    
  a.append("span")
    .attr("class","alert-close")
    .html("&times;")
    .on("click",function() {
      a.remove();
    });  
          
}

function msgClear(key) {
  alerts.selectAll("div."+key).remove();
}

//nav function for showing/hiding sections, generating stuff as needed
//by default, errors/warnings will be cleared when switching sections, but can be forced to preserve
function showSection(section,preserveAlerts) {
  if (section == currentSection) return true;
  currentSection = section;
  $("div.navbar ul li").removeClass("active");
  $("li#"+section).addClass("active");
  $("div.mapstarter-section").addClass("hidden");
  $("div#section-"+section).removeClass("hidden");
  if (!preserveAlerts) alerts.selectAll("div").remove();

  if (currentFile && currentFile.name) resetMap();

  if (section == "download") {
    updateDownloads("svg");
    updateDownloads("code");    
    updateDownloads("image");
  }

  mapBox.classed("hidden",(section == "choose-file" || section == "help"));
}

function populateScales() {  
  
  mapOptions.chloropleth.buckets = parseInt($("select#color-chloropleth-buckets").val());  
  mapOptions.chloropleth.attribute = $("select#color-chloropleth-attribute").val();

  var entries = d3.entries(colorbrewer[mapOptions.chloropleth.type]).filter(function(d) {
      return d.value[mapOptions.chloropleth.buckets];
    }).map(function(d) {      
      return {key: d.key, value: (mapOptions.chloropleth.reverse ? d.value[mapOptions.chloropleth.buckets].slice(0).reverse() : d.value[mapOptions.chloropleth.buckets])};
    });

  body.selectAll("div#color-chloropleth-scales div").remove();  

  var scales = d3.select("div#color-chloropleth-scales").selectAll(".palette")
    .data(entries)
    .enter()
    .append("div")
    .attr("class","palette")    
    .attr("title",function(d){return d.key;})    
    .on("click",function(d) {

      var palette = d3.select(this);
      if (!palette.classed("selected")) {
        d3.select(".palette.selected").attr("class","palette");
        palette.attr("class","palette selected");
        mapOptions.chloropleth.scaleName = d.key;
        recolor();
      }

    });

  scales.classed("selected",function(d) { return (d.key == mapOptions.chloropleth.scaleName); });

  var swatches = scales.selectAll(".swatch")
    .data(function(d){ return d.value; })
    .enter().append("div").attr("class","swatch")
    .style("background-color",function(d){ return d;});

  if (d3.select(".palette.selected").empty()) {
    d3.select(".palette").attr("class","palette selected");
    mapOptions.chloropleth.scaleName = d3.select(".palette").datum().key;
  }

}

//Get the color scale from Colorbrewer, flip it if "Reverse" is on, set the domain based on the
//attribute selected, set the range to the color set.  Check to make sure there are some numeric values,
//otherwise throw a warning
function recolor(from) {    

  mapOptions.chloropleth.attributeProblem = false;

  if (mapOptions.colorType == "simple") {
    filledPaths.attr("fill",mapOptions.fill);
    return true;
  }

  var colors = colorbrewer[mapOptions.chloropleth.type][mapOptions.chloropleth.scaleName][mapOptions.chloropleth.buckets].slice(0);

  if (mapOptions.chloropleth.reverse) colors.reverse();

  var mapped = filterFeatures(currentFile.data.geo,"geojson",currentFile.skip).features.map(function(d) {
      if (!(mapOptions.chloropleth.attribute in d.properties)) return null;
      return parseNumber(d.properties[mapOptions.chloropleth.attribute]);
    }).filter(function(d) {return d !== null;});  

  if (!mapped.length) {
    mapOptions.chloropleth.attributeProblem = true;
    filledPaths.attr("fill",mapOptions.chloropleth.default);
    mapOptions.chloropleth.scale = d3.scale.quantize().domain([0,1]).range(colors);
  } else {              
    mapOptions.chloropleth.scale = d3.scale.quantize().domain(d3.extent(mapped)).range(colors);

    filledPaths.attr("fill",function(d){
      if (!d.properties || !mapOptions.chloropleth.attribute) {
        mapOptions.chloropleth.attributeProblem = true;
        return mapOptions.chloropleth.default;
      }

      var num = parseNumber(d.properties[mapOptions.chloropleth.attribute]);

      if (num === null) return mapOptions.chloropleth.default;

      return mapOptions.chloropleth.scale(num);
            
    });

  }
  
}

//Reset certain options when a new file is added
function resetOptions() {
      
  //Set color scheme to simple
  $("input#color-type-simple").prop("checked",true);
  $("input#color-type-chloropleth").prop("checked",false);
  mapOptions.colorType = "simple";
  d3.selectAll("div.panel-group.color-type").classed("hidden",true);
  d3.selectAll("div#color-"+mapOptions.colorType).classed("hidden",false);

  //Turn off tooltip
  $("input#tooltip-toggle").prop("checked",false);
  $("select#tooltip-attribute").prop("disabled",true);
  $("span#tooltip-attribute-list").toggleClass("hidden",true);
  mapOptions.tooltip = false;
  
}

function setListeners() {
    
  //When that input changes, attempt to read the file
  $uploadFile.on("change",function() {
    if ($(this)[0].files.length) {
      readFiles($(this)[0].files);      
    }
  });

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
      msg("no-file");
      uploadComplete();
    }
  });

  //Cancel menu actions while loading
  body.selectAll("div.navbar ul a").on("click",function() {    
    d3.event.preventDefault();

    var section = d3.select(this).attr("href").replace(/^#/,"");

    if (!currentFile.name || upload.classed("loading") || body.classed("blanked") || d3.select("div#section-"+section).empty()) return true;

    showSection(section);

  });

  //Clicking the drag target instead triggers a <hidden input type="file">
  upload.on("click",function() {    
    if (!upload.classed("loading") && !fileStatus.classed("loading")) $uploadFile.click();
  }); 

  //Listeners for form updates
  $("input#color-fill").change(function(){    
    mapOptions.fill = $(this).val();
    filledPaths.attr("fill",mapOptions.fill);
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

    //Error check for bad albersUsa usage
    if (mapOptions.projectionType == "albersUsa") {
      var a = d3.geo.area(currentFile.data.geo),
        b = d3.geo.bounds(currentFile.data.geo);
      if (!isUSA(a,b)) msg("bad-albers");
      else msgClear("bad-albers");

    } else {
      msgClear("bad-albers");
    }

    scaleMap();  
  });

  $("input#responsive").change(function() {
    mapOptions.responsive = $(this).prop("checked");
  });

  $("input[name='zoom']").change(function() {
    mapOptions.zoomMode = $(this).val();
    resetMap();
  });

  $("input[name='color-type']").change(function() {
    mapOptions.colorType = $(this).val();    
    d3.selectAll("div.panel-group.color-type").classed("hidden",true);
    d3.selectAll("div#color-"+mapOptions.colorType).classed("hidden",false);
    resetMap();
    recolor();

    if (mapOptions.colorType == "chloropleth" && mapOptions.chloropleth.attributeProblem) msg("non-numeric");
    else msgClear("non-numeric");
  });

  $("input#tooltip-toggle").change(function() {
    var checked = $(this).prop("checked");
    $("select#tooltip-attribute").prop("disabled",!checked);
    $("span#tooltip-attribute-list").toggleClass("hidden",!checked);
    mapOptions.tooltip = checked ? $("select#tooltip-attribute").val() : false;
  });

  $("select#tooltip-attribute").change(function() {
    mapOptions.tooltip = $(this).val();
  });

  $("select#color-chloropleth-buckets").change(function() {
    populateScales();
    recolor();
  });

  $("select#color-chloropleth-attribute").change(function(){
    mapOptions.chloropleth.attribute = $(this).val();
    resetMap();
    recolor();

    if (mapOptions.colorType == "chloropleth" && mapOptions.chloropleth.attributeProblem) msg("non-numeric");
    else msgClear("non-numeric");
  });

  $("input#color-chloropleth-default").change(function(){        
    mapOptions.chloropleth.default = $(this).val();
    resetMap();
    recolor();
  });

  $("input#color-chloropleth-reverse").change(function(){        
    mapOptions.chloropleth.reverse = $(this).prop("checked");
    populateScales();
    resetMap();
    recolor();
  });

  switchLinks.on("click",function() {
    if (!upload.classed("loading") && !fileStatus.classed("loading")) {
      
      fileStatus.classed("loading",true); 

      var to = d3.select(this).datum();      

      if (to == "geojson") {
        setFileType(to);
      } else if (to == "topojson") {

        if (currentFile.data.topo) {

          setFileType(to);

        } else {

          var stringified = JSON.stringify(currentFile.data.geo);

          if (stringified.length > 15000000) {
            msg("geo-too-big");
            fileStatus.classed("loading",false);
            return true;
          }

          //Pass file to a wrapper that will cURL the real converter, gets around cross-domain
          //Once whole server is running on Node this won't be necessary
          $.post("geo-to-topo.php",{geojson: stringified},function(topo) {
            currentFile.data.topo = fixTopo(topo);
            setFileType(to); 
          },"json");

        }
      
      }
    }  

    d3.event.preventDefault();
  });

  //Process sample data links
  d3.selectAll("a.sample-data").on("click",function() {      
    var fn = d3.select(this).attr("href").replace(/^#/,"");
    
    if (fn == "random") {

      var countryCodes = {"1":"AW","2":"AF","3":"AO","4":"AI","5":"AL","6":"AX","7":"AD","8":"AE","9":"AR","10":"AM","11":"AS","12":"AQ","13":"TF","14":"AG","15":"AU","16":"AT","17":"AZ","18":"BI","19":"BE","20":"BJ","21":"BF","22":"BD","23":"BG","24":"BH","25":"BS","26":"BA","27":"BL","28":"BY","29":"BZ","30":"BM","31":"BO","32":"BR","33":"BB","34":"BN","35":"BT","36":"BW","37":"CF","38":"CA","39":"CH","40":"CL","41":"CN","42":"CI","43":"CM","44":"CD","45":"CG","46":"CK","47":"CO","48":"KM","49":"CV","50":"CR","51":"CU","52":"CW","53":"KY","54":"CY","55":"CZ","56":"DE","57":"DJ","58":"DM","59":"DK","60":"DO","61":"DZ","62":"EC","63":"EG","64":"ER","65":"ES","66":"EE","67":"ET","68":"FI","69":"FJ","70":"FK","71":"FR","72":"FO","73":"FM","74":"GA","75":"GB","76":"GE","77":"GG","78":"GH","79":"GI","80":"GN","81":"GM","82":"GW","83":"GQ","84":"GR","85":"GD","86":"GL","87":"GT","88":"GU","89":"GY","90":"HK","91":"HM","92":"HN","93":"HR","94":"HT","95":"HU","96":"ID","97":"IM","98":"IN","99":"IO","100":"IE","101":"IR","102":"IQ","103":"IS","104":"IL","105":"IT","106":"JM","107":"JE","108":"JO","109":"JP","110":"KZ","111":"KE","112":"KG","113":"KH","114":"KI","115":"KN","116":"KR","117":"KW","118":"LA","119":"LB","120":"LR","121":"LY","122":"LC","123":"LI","124":"LK","125":"LS","126":"LT","127":"LU","128":"LV","129":"MO","130":"MF","131":"MA","132":"MC","133":"MD","134":"MG","135":"MV","136":"MX","137":"MH","138":"MK","139":"ML","140":"MT","141":"MM","142":"ME","143":"MN","144":"MP","145":"MZ","146":"MR","147":"MS","148":"MU","149":"MW","150":"MY","151":"NA","152":"NC","153":"NE","154":"NF","155":"NG","156":"NI","157":"NU","158":"NL","159":"NO","160":"NP","161":"NR","162":"NZ","163":"OM","164":"PK","165":"PA","166":"PN","167":"PE","168":"PH","169":"PW","170":"PG","171":"PL","172":"PR","173":"KP","174":"PT","175":"PY","176":"PS","177":"PF","178":"QA","179":"RO","180":"RU","181":"RW","182":"EH","183":"SA","184":"SD","185":"SS","186":"SN","187":"SG","188":"GS","189":"SH","190":"SB","191":"SL","192":"SV","193":"SM","194":"SO","195":"PM","196":"RS","197":"ST","198":"SR","199":"SK","200":"SI","201":"SE","202":"SZ","203":"SX","204":"SC","205":"SY","206":"TC","207":"TD","208":"TG","209":"TH","210":"TJ","211":"TM","212":"TL","213":"TO","214":"TT","215":"TN","216":"TR","217":"TV","218":"TW","219":"TZ","220":"UG","221":"UA","222":"UM","223":"UY","224":"US","225":"UZ","226":"VC","227":"VE","228":"VG","229":"VI","230":"VN","231":"VU","232":"WF","233":"WS","234":"YE","235":"ZA","236":"ZM","237":"ZW"}

      var rand = Math.ceil(Math.random()*235);          

      fn = rand+".json";    

    }                

    upload.classed("loading",true);
    
    d3.json("samples/"+fn,function(error,newFile) {          
      loaded(newFile);
    });

    d3.event.preventDefault();
  });

}


//Extra wrapper function to allow for shapefiles to be uploaded as multiple files
function readFiles(files) {

  uploadStart();  

  if (files.length == 1) {
    singleFile(files[0]);
  } else {
    var shp = [], dbf = [];

    for (var i = 0; i < files.length; i++) {
      if (files[i].name.match(/[.]shp$/i)) shp.push(files[i]);
      else if (files[i].name.match(/[.]dbf$/i)) dbf.push(files[i]);
    }

    if (shp.length == 1 && dbf.length <= 1) {      
      multiFile(shp[0],dbf[0]);
    } else {
      msg("invalid-file");
      uploadComplete();   
      return false;
    }
  }
}

//Read in a user-inputted file
function singleFile(file) {

  var newFile = {name: file.name, size: file.size, data: {topo: null, geo: null}, type: null};

  var reader = new FileReader();
  reader.onload = function (e) {

    //If it's not JSON, catch the error and try it as a shapefile instead  
    try {

      var d = JSON.parse(e.target.result);              
      newFile.type = jsonType(d);

      if (newFile.type == "topojson") {
        newFile.data.topo = fixTopo(d);
        newFile.data.geo = fixGeo(topojson.feature(newFile.data.topo, newFile.data.topo.objects[getObjectName(newFile.data.topo)]));
      } else {
        newFile.data.geo = fixGeo(d);
      }

      if (!newFile.type) {
        singleShapefile(file);
      } else {
        loaded(newFile);
      }            
                
    } catch(err) {  
      singleShapefile(file);                     
      return false;            
    }                  
    
    return true;


  };

  reader.readAsText(file);

}      

//Try file as a .shp file and a .dbf file
function multiFile(shp,dbf) {

    //Create form with file upload
    var formData = new FormData();
    formData.append('shp', shp);
    if (dbf) formData.append('dbf', dbf);
    else msg("no-dbf");

    if (shp.size + dbf.size > 15000000) {
      msg("shp-too-big");
      uploadComplete();
      return true;
    }

    //Pass file to a wrapper that will cURL the real converter, gets around cross-domain
    //Once whole server is running on Node this won't be necessary
    d3.xhr("shp-to-geo.php").post(formData,function(error,response) {                

      try {
        var newFile = {name: shp.name.replace(/[.]shp$/i,".geojson"), size: response.responseText.length, data: {topo: null, geo: fixGeo(JSON.parse(response.responseText))}, type: "geojson"};
      } catch(err) {
        if (currentFile.name) body.classed("blanked",false);
        msg("invalid-file");
        uploadComplete();
        return false;
      }

      loaded(newFile);

      return true;


    });

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

//Prevent d3 mouse defaults
function noop() {
  d3.event.stopPropagation();
  d3.event.preventDefault();
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
    if (numeric && column in d.properties && typeof d.properties[column] !== "number") {
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

function updateDownloads(type) {
  var filebase = currentFile.name.replace(/[.](json|topojson|geojson|shp|zip)$/,"");

  if (type == "svg") {
    body.select("a#svg-download").attr("download",filebase+".svg").attr("href",window.URL.createObjectURL(new Blob([getSVG(currentFile.data.geo.features,currentFile.skip,mapOptions)], { "type" : "text/xml" })));  
    return true;
  }

  if (type == "code") {
    var codeContents = generateCode(currentFile,mapOptions);

    body.select("a#code-download").attr("download",filebase+".html").text(filebase+".html").attr("href",window.URL.createObjectURL(new Blob([codeContents], { "type" : "text/html" })));      

    code.text(codeContents);
            
    hljs.highlightBlock(code.node());
    
    return true;

  }

  if (type == "image") {

    var flapjack = Pancake("map");
    
    body.select("a#pancake-download").attr("download",filebase+".png").attr("href",flapjack.src);

    return true;
  }

  var filtered = filterFeatures((currentFile.type == "topojson") ? currentFile.data.topo : currentFile.data.geo,currentFile.type);
  body.selectAll("a.data-download").attr("download",currentFile.name).html(currentFile.name).attr("href",window.URL.createObjectURL(new Blob([JSON.stringify(filtered)], { "type" : "application/json" })));
  return true;

  
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

//Update the map projection, auto-setting parallels or centers based on data
function updateProjection(data,width,height) {                          

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

//Determine which dimension is limiting factor for the map (W or H) and reduce the other to fit
function autoCrop() {

  //Get limiting dimension on initial load, update width/height accordingly
  var b = mapOptions.path.bounds(currentFile.data.geo);

  if ((b[1][1]-b[0][1])/mapOptions.height > (b[1][0]-b[0][0])/mapOptions.width) {
    
    //height is limiting factor

    mapOptions.width = Math.round((b[1][0]-b[0][0])/0.95);        
    
    map.attr("width",mapOptions.width);        

    //Update surrounding div
    mapBox.style("width",mapOptions.width+"px");

    $("input#input-width").val(mapOptions.width);

  } else {
    
    //width is limiting factor

    mapOptions.height = Math.round((b[1][1]-b[0][1])/0.95);        
    
    map.attr("height",mapOptions.height);        

    //Update surrounding div
    mapBox.style("height",mapOptions.height+"px");

    $("input#input-height").val(mapOptions.height);        

  }

  mapOptions.projection.translate([mapOptions.width/2,mapOptions.height/2]);

  paths.attr("d",mapOptions.path);

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

function uploadStart() {
  alerts.selectAll("div").remove();
  upload.classed("loading",true);
  body.classed("blanked",true);  
}

function uploadComplete() {  
  upload.classed("loading",false);

  if (currentFile.name) {
    body.classed("blanked",false);
    fileStatus.classed("hidden",false);
  }

}

//Try file as a zipped shapefile
function singleShapefile(file) {

  //Require .zip extension
  if (file.name.match(/[.](zip|shp)$/i)) {

    //Create form with file upload
    var formData = new FormData();
    formData.append(file.name.substring(file.name.length-3).toLowerCase(), file);

    if (file.size > 15000000) {
      if (currentFile.name) body.classed("blanked",false);
      msg("shp-too-big");
      uploadComplete();
      return true;
    }

    //Pass file to a wrapper that will cURL the real converter, gets around cross-domain
    //Once whole server is running on Node this won't be necessary
    d3.xhr("shp-to-geo.php").post(formData,function(error,response) {          
      try {
        var newFile = {name: file.name.replace(/[.](shp|zip)$/i,".geojson"), size: response.responseText.length, data: {topo: null, geo: fixGeo(JSON.parse(response.responseText))}, type: "geojson"};

        var hasDbf = false;

        //My first JavaScript label!
        dbfCheck:
        for (var i = 0; i < newFile.data.geo.features.length; i++) {
          if ("properties" in newFile.data.geo.features[i]) {
            for (var p in newFile.data.geo.features[i].properties) {
              hasDbf = true;
              break dbfCheck;
            }
          }
        }

        if (!hasDbf) msg("no-dbf");

      } catch(err) {
        if (currentFile.name) body.classed("blanked",false);
        msg("invalid-file");
        uploadComplete();
        return false;
      }

      loaded(newFile);

      return true;


    });

  } else {
    if (currentFile.name) body.classed("blanked",false);
    msg("invalid-file");
    uploadComplete();    

  }
}

//When the filetype changes, update the file download links and the "Download Code" section
function setFileType(fileType) {

  var opposite = (fileType == "topojson") ? "geojson" : "topojson",
    pretty = (opposite == "topojson") ? "TopoJSON" : "GeoJSON",
    dataType = (fileType == "topojson") ? "topo" : "geo",
    fileBase = currentFile.name.replace(/[.](json|topojson|geojson|shp|zip)$/,"");

  code.text("");

  currentFile.name = fileBase+"."+fileType;
  currentFile.size = JSON.stringify(currentFile.data[dataType]).length;

  fileSize.text("("+prettySize(currentFile.size)+")");
  switchLinks.text("Switch to "+pretty).datum(opposite);

  currentFile.type = fileType;

  if (currentSection == "download") updateDownloads("code");

  updateDownloads("data");

  fileStatus.classed("loading",false);

}

//Change map scale
function scaleMap() {

  resetMap();

  map.attr("width",mapOptions.width)
    .attr("height",mapOptions.height);

  //Update surrounding div
  mapBox
    .style("width",mapOptions.width+"px")
    .style("height",mapOptions.height+"px");

  //Update the projection to center and fit in the provided box
  updateProjection(filterFeatures(currentFile.data.geo,"geojson",currentFile.skip),mapOptions.width,mapOptions.height);
}

//Remove any applied transforms
function resetMap(from) {

  paths.classed("clicked", false)    
    .attr("stroke-width", mapOptions.strokeWidth + "px");

  features.attr("transform", null);
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
      .attr("stroke-width", mapOptions.strokeWidth / k + "px");

  if (mapOptions.colorType == "simple") filledPaths.attr("fill", function(d) { return (centered && d === centered) ? mapOptions.highlight : mapOptions.fill; });

  //features.transition()
      //.duration(750)
  features.attr("transform", "translate(" + mapOptions.width / 2 + "," + mapOptions.height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")");
}

//Freeform zooming
function zoomed() {
  features.attr("transform", "translate(" + zoom.translate() + ")scale(" + zoom.scale() + ")");
  paths.attr("stroke-width",mapOptions.strokeWidth/zoom.scale() + "px" );  
}

//Based on map options, loop through features and generate SVG markup with styles
function getSVG(features,skip,options) {
  var svg = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="'+options.width+'" height="'+options.height+'" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">';

  if (options.colorType != "simple") {
    var fills = [];
    paths.each(function(d,i) {
      fills.push(d3.select(this).attr("fill"));
    });
  }

  features.forEach(function(d,i) {        

    var fill;

    if (skip && skip.indexOf(i) != -1) return true;

    if (options.colorType == "simple") {
      fill = options.fill;
    } else if (!fills[i].length) {
      fill = "none";
    } else {
      fill = fills[i];
    }
    
    svg += '<path stroke-width="'+options.strokeWidth+'" stroke="'+options.stroke+'" fill="'+fill+'" d="'+options.path(d)+'" />';

  });

  svg += '</svg>';
  return svg;
}

//Filter features for file download links, removing features that are marked as removed in the "Data" tab
function filterFeatures(data,type,skip) {    
  
  if (!skip || !skip.length) return data;

  //Deep copy
  var newData = $.extend(true,{},data);  

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