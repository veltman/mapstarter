      //Initialize selectors. Mixing D3 & jQuery... what could go wrong??
      var mapBox = d3.select("div#map-box"),
        map = d3.select("svg#map").data([{x:0,y:0}]),
        draggable = map.select("g#draggable"),
        features = map.select("g#features"),
        upload = d3.select("div#upload-target"),
        attributesHeader = d3.select("table#attributes thead"),        
        attributesBody = d3.select("table#attributes tbody"),
        attributesColumns, attributesRows;
      
      var $uploadFile = $("#upload-file");

      //Storing file properties
      var currentFile = {
        data: null,
        name: null,
        size: null,
        type: null
      };      

      //Will flesh this out.  For now, just default dimensions and projection
      var mapOptions = {
        width: 600,
        height: 600,        
        projectionType: "mercator",
        features: {
          strokeWidth: 1,
          strokeColor: "white",
          fill: "steelblue",
          highlight: "tomato",
          colorScheme: null,
          scaleOn: null,
          categorical: false
        },
        behavior: {
          dragToPan: false,
          clickToZoom: true,
          tooltip: false
        }
      };


      //Initialize projection stuff
      mapOptions.projection = d3.geo[mapOptions.projectionType](),
      mapOptions.path = d3.geo.path().projection(mapOptions.projection);
      
      var centered;

      var dragging = false,
        drag = d3.behavior.drag().on("drag", function(d) {
            dragging = true;
            if (!mapOptions.behavior.dragToPan) return true;

            d3.event.sourceEvent.stopPropagation();
            
            d.x += d3.event.dx;
            d.y += d3.event.dy;

            draggable.attr("transform", "translate(" + [ d.x,d.y ] + ")");

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

      $("input#color-fill").change(function(){ mapOptions.features.fill = $(this).val(); features.selectAll("path").attr("fill",mapOptions.features.fill); });
      $("input#color-stroke").change(function(){ mapOptions.features.stroke = $(this).val(); features.selectAll("path").attr("stroke",mapOptions.features.stroke); });
      $("input#color-highlight").change(function(){ mapOptions.features.highlight = $(this).val(); });
      $("input#color-stroke-width").change(function() {        
        var w = parseFloat($(this).val());        
        $(this).val(w);
        mapOptions.features.strokeWidth = w;
        features.selectAll("path").attr("stroke-width",mapOptions.features.strokeWidth);
      });

      $("input#input-height").change(function(){
        var h = Math.max(0,Math.min(3600,parseInt($(this).val())));
        $(this).val(h);
        mapOptions.height = h;

      });

      $("input#input-width").change(function(){        
        var w = Math.max(0,Math.min(3600,parseInt($(this).val())));
        $(this).val(w);
        mapOptions.width = w;
        
      });

      $("#input-projection").change(function() {        

        mapOptions.projectionType = $(this).val();

      });

      $("input#pannable").change(function() {
        
        mapOptions.behavior.dragToPan = $(this).is(':checked');
        resetMap();

      });

      $("input#zoomable").change(function() {
        
        mapOptions.behavior.clickToZoom = $(this).is(':checked');
        resetMap();

      });

      $("button.map-update").click(function() {
        drawMap();
      });

      function tryShapefile(file) {

        if (file.name.match(/[.]zip$/)) {

          var formData = new FormData();
          formData.append('shapefile', file);

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

      //Read in a user-inputted file
      function readFile(file) {

        upload.classed("loading",true);

        var newFile = {name: file.name, size: file.size, data: null, type: null};

        var reader = new FileReader();
        reader.onload = function (e) {
        
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

      function loaded(newFile) {

            //If it's TopoJSON, convert it first (only one object supported, for now)
            if (newFile.type === "topojson") {              
              for (var obj in newFile.data.objects) {
                newFile.data = topojson.feature(newFile.data, newFile.data.objects[obj]);
                break;
              }
            }

            currentFile = newFile;

            //Update current file display
            msg("Current File: <span>"+newFile.name+"</span> ("+prettySize(newFile.size)+")",true);           
            upload.classed("loading",false);
            
            //get distinct properties
            var set = d3.set();
            currentFile.data.features.forEach(function(d) {
              for (prop in d.properties) {
                set.add(prop);
              }              
            });

            attributesColumns = set.values();

            attributesHeader.selectAll("th").remove();
            attributesHeader.selectAll("th").data(attributesColumns).enter().append("th").text(function(d){return d;});
            attributesBody.selectAll("tr").remove();
            attributesRows = attributesBody.selectAll("tr").data(currentFile.data.features).enter().append("tr")
              .on("mouseover",function(d,i) {
                map.select("path#path"+i).style("fill",mapOptions.features.highlight);
              })
              .on("mouseout",function(d,i) {
                map.select("path#path"+i).style("fill",mapOptions.features.fill);
              })
              .on("click",function(d,i) {
                clicked(currentFile.data.features[i]);
              });

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

            window.location.hash = "size";

            //Draw the map
            drawMap();                

      }

      function jsonType(data) {
        if (typeof data !== "object" || !data.type) return null;        
        if (data.type === "Topology" && data.objects && _.size(data.objects) == 1) return "topojson";
        if (["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection", "Feature", "FeatureCollection"].indexOf(data.type) == -1) return null;
        return "geojson";
      }

      //Prevent d3 mouse defaults
      function noop() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
      }

      function drawMap() {        

        resetMap();

        //$options.show();

        map.attr("width",mapOptions.width)
          .attr("height",mapOptions.height);        

        features
          .selectAll("path").remove();

        mapBox.classed("loading",true)
          .classed("hidden",false)
          .style("width",mapOptions.width+"px")
          .style("height",mapOptions.height+"px");

        //Update the projection to center and fit in the provided box
        updateProjection(currentFile.data,mapOptions.width,mapOptions.height);

        //Insert paths
        features.selectAll("path").data(currentFile.data.features).enter().append("path")
          .attr("d",mapOptions.path)
          .attr("stroke-width",mapOptions.features.strokeWidth)
          .attr("stroke",mapOptions.features.stroke)
          .attr("fill",mapOptions.features.fill)
          .attr("id",function(d,i) {return "path"+i;})
          .on("click",clicked)
          .on("mouseover",function(d) {
            d3.select(this).attr("fill",mapOptions.features.highlight);
          })
          .on("mouseout",function(d) {
            d3.select(this).attr("fill",mapOptions.features.fill);
          });

        mapBox.classed("loading",false)
          .classed("hidden",false);
      }

      //Remove any applied transforms
      function resetMap() {
        draggable.attr("transform",null);
        map.data([{x:0,y:0}]);
        features.attr("transform", null);
      }

      function updateProjection(data,width,height) {                        

        // Create a unit projection.
        mapOptions.projection = d3.geo[mapOptions.projectionType]()
            .scale(1)
            .translate([0, 0]);                    

        //Add parallels for conicEqualArea
        //Need to figure out rotation
        if (mapOptions.projectionType == 'conicEqualArea') {
          
          //bounds returns ​[left, bottom], [right, top]​]          
          var bounds = d3.geo.bounds(data);
          mapOptions.projection.center(d3.geo.centroid(data))
            .parallels([bounds[0][1],bounds[1][1]]);
        }            

        // Create a path generator.
        mapOptions.path = d3.geo.path()
            .projection(mapOptions.projection);        

        // Compute the bounds of a feature of interest, then derive scale & translate.
        var b = mapOptions.path.bounds(data),
            s = .95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height),
            t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];

        mapOptions.projection = mapOptions.projection.scale(s).translate(t);

      }

      function clicked(d) {
        if (!mapOptions.behavior.clickToZoom || dragging) return true;
        var x, y, k;

        if (d && centered !== d) {
          var centroid = mapOptions.path.centroid(d);
          x = centroid[0];
          y = centroid[1];
          k = 4;
          centered = d;
        } else {
          x = mapOptions.width / 2;
          y = mapOptions.height / 2;
          k = 1;
          centered = null;
        }

        features.selectAll("path")
            .classed("active", centered && function(d) { return d === centered; });

        features.transition()
            .duration(750)
            .attr("transform", "translate(" + mapOptions.width / 2 + "," + mapOptions.height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
            .style("stroke-width", mapOptions.features.strokeWidth / k + "px");
      }

      function getSVG() {
        var svg = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="'+mapOptions.width+'" height="'+mapOptions.height+'" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">';

        currentFile.data.features.forEach(function(d) {
          svg += '<path stroke-width="'+mapOptions.features.strokeWidth+'" stroke="'+mapOptions.features.stroke+'" fill="'+mapOptions.features.fill+'" d="'+mapOptions.path(d)+'" />';
        });

        svg += '</svg>';
        return svg;
      }

      function prettySize(size) {
        if (typeof size != "number") return 'unknown size';

        if (size > 1000000) {
          return Math.round(size/100000)/10+" MB";
        } else {
          return Math.round(size/100)/10+" KB";
        }
      }

      function oppositeColor(color) {        
        var col = d3.hsl(color);
        return d3.hsl((col.h+180) % 360,col.s,col.l).toString();        
      }

      var $alert = $("div.alert");

      //Shake the upload box and throw an error message
      function msg(message,success) {

        $alert.find("div").html(message);
        if (success) {
          $alert.removeClass("alert-danger").addClass("alert-info");
        } else {
          $alert.addClass("alert-danger").removeClass("alert-info");
        }

        $alert.removeClass("hidden").show();
        //if (!success) setTimeout(function(){$alert.fadeOut()},3000);
        upload.classed("loading",false);
                
      }