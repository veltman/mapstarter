function addNulls(data, null_key_obj, path){
	data.forEach(function(datum){
		if (path) datum = datum[path] 
		// Create copies of our objects so they dont' get overwritten
		var null_key_obj_persist = extend({}, null_key_obj),
				datum_persist        = extend({}, datum);
		// You could extend `null_key_obj_persist` with `datum` but that would reverse the order of your keys
		// And always put your keys that have nulls (which are probably the least important keys) first.
		// This way will overwrite everything with nulls, then rewrite keys that have values.
		extend(datum, null_key_obj_persist, datum_persist)
	})
	return data
}

function addToNullMatch(key_map, keys){
	keys.forEach(function(key){
		if (!key_map.null_match[key]){
			key_map.null_match[key] = null
		}
	})
}

function indexRightDataOnKey(right_data, right_key_column){
	var key_map = {
			null_match: {}
	};
	right_data.forEach(function(datum){
		// Copy this value because we're going to be deleting the match column
		// And we don't want that column to be deleted the next time we join, if we want to join without reloading data
		// This will delete the copy, but keep the original data next time the function is run
		var datum_persist = extend({}, datum)
		var right_key_value = datum_persist[right_key_column];
		if (!key_map[right_key_value]){
			// Get rid of the original name key since that will just be a duplicate
			delete datum_persist[right_key_column];
			key_map[right_key_value] = datum_persist;
			// Log the new keys that we've encountered for a comprehensive list at the end
			addToNullMatch(key_map, Object.keys(datum_persist));
		}else{
			console.error('Duplicate entry for "' +  right_key_value + '"');
		}
	})
	return key_map
}

function joinOnMatch(left_data, left_key_column, key_map, path){
	left_data.forEach(function(datum){
		if (path) datum = datum[path] 
		var key   = datum[left_key_column],
		    match = key_map[key];
		if (match){
			extend(datum, match);
		}
	})
	return left_data
}

function joinData(left_data, left_key_column, right_data, right_key_column, path){
	var key_map             = indexRightDataOnKey(right_data, right_key_column),
			joined_data         = joinOnMatch(left_data, left_key_column, key_map, path),
			joined_data_w_nulls = addNulls(joined_data, key_map.null_match, path);
	return joined_data_w_nulls;
}

function joinGeoJson(left_data, left_key_column, right_data, right_key_column, path){
	if (!path) path = 'properties';
	return joinData(left_data, left_key_column, right_data, right_key_column, path);
}

/*
var geo_key   = 'name',
		value_key = 'state_name';

var geo_data = [ 
		{
			"properties": {
				"name": 'AK',
				"geom": '1'
			}
		}, 
		{
			"properties": {
				"name": 'CA',
				"geom": '2'
			}
		}, 
		{
			"properties": {
				"name": 'NY',
				"geom": '3'
			}
		},
		{
			"properties": {
				"name": 'LA',
				"geom": '4'
			}
		}
	]

var value_data = [ 
		{
			"state_name": 'AK',
			"awesomeness": '1',
			"coldness": 200
		}, 
		{
			"state_name": 'CA',
			"awesomeness": '100'
		}, 
		{
			"state_name": 'NY',
			"awesomeness": '75'
		}
	]

var joined_data = joinData(geo_data, geo_key, value_data, value_key, 'properties')
console.log(joined_data)
/*
[ { name: 'AK', geom: '1', awesomeness: '1', coldness: 200 },
  { name: 'CA', geom: '2', awesomeness: '100', coldness: null },
  { name: 'NY', geom: '3', awesomeness: '75', coldness: null },
  { name: 'LA', geom: '4', awesomeness: null, coldness: null } ]
*/