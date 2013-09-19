function generateCode(file,options) { 

  var codeLines = [];

  codeLines = codeLines.concat([
        '<!DOCTYPE html>',
        '<meta charset="utf-8">',
        '<style>',
        '',
        'body {',
        '  font: 12px sans-serif;',
        '}',
        '',
        'path {',
        function() { if (options.strokeWidth > 0) return '  stroke-width: '+options.strokeWidth+'px;'; return null; },
        function() { if (options.strokeWidth > 0) return '  stroke: '+options.stroke+';'; return '  stroke: none;' },
        function() { if (options.colorType == "simple") return '  fill: '+options.fill+';'; return null; },
        '  cursor: pointer;',
        '}',
        ''
    ]);

    if (options.colorType == "simple" && options.highlight != options.fill) {
        codeLines = codeLines.concat([
            'path:hover, path.highlighted {',
            '  fill: '+options.highlight+';',
            '}',
            ''
        ]);
    } else if (options.colorType == "chloropleth") {
        var domain = options.chloropleth.scale.domain();
        var range = options.chloropleth.scale.range();
        range.forEach(function(d,i) {
            codeLines = codeLines.concat([
                'path.q'+i+'-'+range.length+' {',
                '  fill: '+d+';',
                '}',
                ''
            ]);
        });

    }

    if (options.tooltip) {
        codeLines = codeLines.concat([
            'div.tooltip {',            
            '  position: absolute;',
            '  background-color: white;',
            '  border: 1px solid black;',
            '  color: black;',
            '  font-weight: bold;',
            '  padding: 4px 8px;',            
            '  display: none;',
            '}',        
            ''
        ]);
    }

    codeLines = codeLines.concat([
        '</style>',
        '<body>',
        '<script src="http://d3js.org/d3.v3.min.js"></script>',
        function(){ if (file.type == "topojson") return '<script src="http://d3js.org/topojson.v1.min.js"></script>'; return null; },
        '<script>',
        '',
        '//Map dimensions (in pixels)',
        'var width = '+options.width+',',
        '    height = '+options.height+';',
        '',
        '//Map projection',
        'var projection = d3.geo.'+options.projectionType+'()',
        '    .scale('+options.projection.scale()+')',
        function() {
            if ("center" in options.projection)
                return '    .center(['+options.projection.center().join(",")+']) //projection center';
            return null;
        },            
        function() {
            if ("parallels" in options.projection)
                return '    .parallels(['+options.projection.parallels().join(",")+']) //parallels for conic projection';
            return null;
        },
        function() {
            if ("parallels" in options.projection && "rotate" in options.projection)
                return '    .rotate(['+options.projection.rotate().filter(function(d){ return d; }).join(",")+']) //rotation for conic projection';
            return null;
        },
        function() {
            if ("parallels" in options.projection)
                return '    .translate(['+options.projection.translate().join(",")+']) //translate to center the map in view';

            return '    .translate([width/2,height/2]) //translate to center the map in view';
            return null;
        },          
        '',
        '//Generate paths based on projection',
        'var path = d3.geo.path()',
        '    .projection(projection);',
        '',
        '//Create an SVG',
        'var svg = d3.select("body").append("svg")',
        '    .attr("width", width)',
        '    .attr("height", height);',
        '',
        '//Group for the map features',
        'var features = svg.append("g")',
        '    .attr("class","features");'
    ]);

    if (options.colorType == "chloropleth") {
        codeLines = codeLines.concat([
            '',
            '//Create chloropleth scale',
            'var color = d3.scale.quantize()',
            '    .domain(['+domain+'])',            
            '    .range(d3.range('+range.length+').map(function(i) { return "q" + i + "-'+range.length+'"; }));'
        ]);        
    }

    if (options.zoomMode == "free") {
        codeLines = codeLines.concat([
            '',
            '//Create zoom/pan listener',
            '//Change [1,Infinity] to adjust the min/max zoom scale',
            'var zoom = d3.behavior.zoom()',
            '    .scaleExtent([1, Infinity])',
            '    .on("zoom",zoomed);',
            '',
            'svg.call(zoom);'
        ]);
    }

    if (options.tooltip) {
        codeLines = codeLines.concat([
            '',
            '//Create a tooltip, hidden at the start',
            'var tooltip = d3.select("body").append("div").attr("class","tooltip");'
        ]);
    }

    codeLines = codeLines.concat([
        '',
        function() { if (options.zoomMode == "feature") return '//Keeps track of currently zoomed feature'; return null; },
        function() { if (options.zoomMode == "feature") return 'var centered;'; return null; },
        function() { if (options.zoomMode == "feature") return ''; return null; },
        'd3.json("'+file.name+'",function(error,geodata) {',
        '  if (error) return console.log(error); //unknown error, check the console',
        '',
        '  //Create a path for each map feature in the data',
        '  features.selectAll("path")',
        function() {            
            if (file.type == "topojson") {
                for (var o in file.data.topo.objects) {
                    if (!o.match(/^[$_A-Za-z][$_A-Za-z0-9]+$/)) {
                        return '    .data(topojson.feature(geodata,geodata.objects["'+o.replace('"','\"')+'"]).features) //generate features from TopoJSON';
                    }
                    return '    .data(topojson.feature(geodata,geodata.objects.'+o+').features) //generate features from TopoJSON';
                }
            }
            return '    .data(geodata.features)';
        },
        '    .enter()',
        '    .append("path")',
        '    .attr("d",path)',
        function() {
            if (options.colorType != "chloropleth") return null;

            var a;
            
            if (!options.chloropleth.attribute.match(/^[$_A-Za-z][$_A-Za-z0-9]+$/)) {
                a = 'd.properties["'+options.chloropleth.attribute.replace('"','\"')+'"]';                        
            } else {
                a = 'd.properties.'+options.chloropleth.attribute;
            }             

            return '    .attr("class", function(d) { return color('+a+'); })';
        },
        function() { if (options.tooltip) return '    .on("mouseover",showTooltip)'; return null; },
        function() { if (options.tooltip) return '    .on("mousemove",moveTooltip)'; return null; },
        function() { if (options.tooltip) return '    .on("mouseout",hideTooltip)'; return null; },
        '    .on("click",clicked);',
        '',
        '});'
    ]);

    if (options.zoomMode == "feature") {

        codeLines = codeLines.concat([
                '',
                '// Zoom to feature on click',                
                'function clicked(d,i) {',
                '',
                '  //Add any other onClick events here',                                                
                '',
                '  var x, y, k;',
                '',
                '  if (d && centered !== d) {',
                '    // Compute the new map center and scale to zoom to',
                '    var centroid = path.centroid(d);',
                '    var b = path.bounds(d);',
                '    x = centroid[0];',
                '    y = centroid[1];',
                '    k = .8 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height);',
                '    centered = d',                
                '  } else {',
                '    x = width / 2;',
                '    y = height / 2;',
                '    k = 1;',
                '    centered = null;',
                '  }',
                '',
                '  // Highlight the new feature',
                '  features.selectAll("path")',
                '      .classed("highlighted",function(d) {',
                '          return d === centered;',
                function() { return '      })'+(options.strokeWidth ? '' : ';' ); },
                function() { if (options.strokeWidth) return '      .style("stroke-width", '+options.strokeWidth+' / k + "px"); // Keep the border width constant'; return null; },
                '',
                '  //Zoom and re-center the map',
                '  //Remove .transition() and .duration() to make zoom instant',
                '  features',
                '      .transition()',
                '      .duration(500)',
                '      .attr("transform","translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")");',
                '}',
                ''
            ]);
    } else {
        codeLines = codeLines.concat([
                '',
                '// Add optional onClick events for features here',      
                '// d.properties contains the attributes (e.g. d.properties.name, d.properties.population)',
                'function clicked(d,i) {',
                '',               
                '}',
                ''
            ]);

        if (options.zoomMode == "free") {
            codeLines = codeLines.concat([
                '',
                '//Update map on zoom/pan',
                'function zoomed() {',
                '  features.attr("transform", "translate(" + zoom.translate() + ")scale(" + zoom.scale() + ")");',
                '  paths.attr("stroke-width", '+options.strokeWidth+' / zoom.scale() + "px" );',
                '}',
                ''                
            ]);
        }
    }    

    if (options.tooltip) {
        codeLines = codeLines.concat([
            '',
            '//Position of the tooltip relative to the cursor',
            'var tooltipOffset = {x: 5, y: -25};',
            '',
            '//Create a tooltip, hidden at the start',
            'function showTooltip(d) {',
            '  moveTooltip();',
            '',
            '  tooltip.style("display","block")',
            function() {               
                if (!options.tooltip.match(/^[$_A-Za-z][$_A-Za-z0-9]+$/)) {
                    return '      .text(d["'+options.tooltip.replace('"','\"')+'"]);'
                }
                return '      .text(d.'+options.tooltip+');';                    
            },
            '}',
            '',
            '//Move the tooltip to track the mouse',
            'function moveTooltip() {',
            '  tooltip.style("top",(d3.event.pageY+tooltipOffset.y)+"px")',
            '      .style("left",(d3.event.pageX+tooltipOffset.x)+"px");',
            '}',
            '',
            '//Create a tooltip, hidden at the start',
            'function hideTooltip() {',
            '  tooltip.style("display","none");',
            '}'                        
        ]);
    }

    if (options.responsive) {
        //Add this later
    }    

    codeLines.push('</script>');    

    var result = codeLines
        .map(function(l) {
            return (typeof l === "function") ? l() : l;
        })
        .filter(function(l) {
            return l !== null;
        }).join("\n");

    return result;

}