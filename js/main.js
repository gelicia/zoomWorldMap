function loadData(){
	var loadCountryDataPromise = loadCountryData();

	loadCountryDataPromise.done(function(){
		sortAndDisplayCountries('alpha');
		loadMap();
	});
}

/*
width : 800px;
	height : 430px;*/

var projection = d3.geo.mercator() 
    .scale(100)
   // .translate([400,300])
    .translate([400, 300])
    .precision(0.1);

var path = d3.geo.path()
		.projection(projection);	

var countryData;
var worldMapData; //TODO Is this too large?

function loadCountryData(){
	var def = $.Deferred();
	d3.csv("data/countryByRankScore.csv", function(errorCountryData, inCountryData){
		countryData = inCountryData;
		def.resolve();
	});
	return def.promise();
}

function sortAndDisplayCountries(searchOpt){
	var select = d3.select("#countrySelect");
	select.selectAll("optgroup").remove();
	select.selectAll("option").remove();

	if (searchOpt == 'alpha'){ //non nested sort
		countryData.sort(function (a, b) {
			if (a.CountryName > b.CountryName)
				return 1;
			if (a.CountryName < b.CountryName)
				return -1;
			return 0;
		});

		select.selectAll("option").data(countryData).enter()
		.append("option")
		.attr("value", function(d){ return d.mapID;})
		.text(function(d){return d.CountryName;});
	}
	else { //nested sorts
		var nest = [];
		var keySortOrder = [];

		if (searchOpt == 'region') {
			nest = d3.nest().key(function(d){ return d.Region;}).entries(countryData);
			keySortOrder = ["North America", "Latin America & Caribbean", "Europe & Central Asia", "Middle East & North Africa", "Sub-Saharan Africa", "South Asia", "East Asia & Pacific"];
		}
		else if (searchOpt == 'income'){
			nest = d3.nest().key(function(d){ return d.IncomeGroup;}).entries(countryData);
			keySortOrder = ["Low income", "Lower middle income", "Upper middle income", "High income: OECD", "High income: nonOECD"];
		}

		//sort categories
		nest.sort(function(a,b){
			var aIdx = keySortOrder.indexOf(a.key);
			var bIdx = keySortOrder.indexOf(b.key);
			if (aIdx > bIdx)
				return 1;
			if (aIdx < bIdx)
				return -1;
			return 0;
		});

		for (var i = 0; i < nest.length; i++) {
			var optGroup = select.append("optgroup").attr({
				value : nest[i].key,
				label : nest[i].key + " (" + nest[i].values.length + ")"
			});

			optGroup.selectAll("option").data(nest[i].values).enter()
			.append("option")
			.attr("value", function(d){ return d.mapID;})
			.text(function(d){return d.CountryName;});
		}
	}
}

function selectLocationScope(id){
	if (active && active.id == id){
		$('#countrySelect option').prop("selected", false);
	}

	var thisCountryData = _.find(countryData, function(d){ return d.mapID == id;});

	d3.selectAll("#mapMain > g > path").classed("selectedCountry", false);
	d3.select("#m_" + id).classed("selectedCountry", true).moveToFront();

	d3.select("h2#countryNameDisp").text(thisCountryData.CountryName);
	var features = topojson.feature(worldMapData, worldMapData.objects.countries).features.filter(function(d){return d.id == id; });
	mapClick(d3.select("#m_" + id).data()[0]);
}

function loadMap(){
	var svg = d3.selectAll("svg#mapMain");

	var g = svg.append("g");

	var width = svg.attr("width", 800);
	var height = svg.attr("height", 430);
	d3.json("data/map/output.json", function(errorMap, world) {
		worldMapData = world;
		var features = topojson.feature(topojson.presimplify(world), world.objects.countries).features.filter(function(d){if (d.id != 10){return d;} });

		g.selectAll("path")
		.data(features).enter().append("path")
		.attr({
			d: path,
			id: function(d) {return "m_" + d.id;},
			stroke: '#000',
			'stroke-opacity': 0.5,
			'stroke-width': 1,
			'class': function(d){
				var thisData = _.find(countryData, function(fd){ return d.id == fd.mapID;});
				return thisData === undefined ? "invalidCountry" : "validCountry";
			}
		})
		.on('click', mapClick);
	});
}

var active;

function mapClick(d) {
	var mouseClick;
	var selection;
	var svg = d3.selectAll("svg#mapMain");
	var width = svg.attr("width");
	var height = svg.attr("height");

	if(this.window === undefined){//click on map
		mouseClick = d3.mouse(this);
		selection = this;
	}
	else { //click on select 
		mouseClick = [width/2,height/2];
		selection = d3.select("#m_" + d.id)[0][0];
	}

	if (active === d) return resetMap();
	
	var g = svg.select("g");

	g.selectAll(".selectedCountry").classed("selectedCountry", false);
	d3.select(selection).classed("selectedCountry", active = d);

	var b = path.bounds(d);
	var loadCountryDataPromise = $.Deferred();

	if ((b[1][0] - b[0][0]) > 600){ //If bounding box is close to entire length of viewport, rotate the projection and redraw
		d3.transition()
        .duration(500)
        .tween("rotate", function() {
			var endNumber = mouseClick[0] < 400 ? 180 : -180;
			console.log(endNumber)
			var r = d3.interpolateNumber(0, endNumber);
			return function(t) {
				projection.rotate([r(t), 0, 0]);
				g.selectAll("path").attr({d: path});
			};
		}).each("end", function(){
			b = path.bounds(d); 
			loadCountryDataPromise.resolve();
		});
	}
	else {
		loadCountryDataPromise.resolve();
	}

	loadCountryDataPromise.done(function(){
		var scaleModifier = 0.95 / Math.max((b[1][0] - b[0][0]) / width, ((b[1][1] - b[0][1]) / height));

		g.transition().duration(500).attr("transform",
			"translate(" + projection.translate() + ")" +
			"scale(" + scaleModifier + ")" + 
			"translate(" + 
			-(b[1][0] + b[0][0]) / 2 + 
			"," + 
			((-(b[1][1] + b[0][1]) / 2 ) - ((165 / scaleModifier)/2))+ 
			")");

		g.selectAll("path").transition().duration(500).attr({
			"stroke-width": 1/scaleModifier
		});
	});
	
}

function resetMap() {
	active = undefined;
	var g = d3.select("svg#mapMain > g");

	if (Math.abs(projection.rotate()[0]) == 180){
		d3.transition()
        .duration(500)
        .tween("rotate", function() {
			var r = d3.interpolateNumber(projection.rotate()[0], 0);
			return function(t) {
				projection.rotate([r(t), 0, 0]);
				g.selectAll("path").attr({d: path});
			};
		});
	}
	
	g.selectAll("path").attr({
		"stroke-width": 1
	});

  g.selectAll(".selectedCountry").classed("selectedCountry", false);
  g.transition().duration(500).attr("transform", "");
}

d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};