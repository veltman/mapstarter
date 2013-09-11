<?php

	if (!isset($_POST["geojson"]) || empty($_POST["geojson"])) {
		echo '{"error": "No data received."}';
	} elseif (strlen($_POST["geojson"]) > 30000000) {
		echo '{"error": "GeoJSON is too large to convert."}';
	}else {

		//$g = '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[102.0,0.5]},"properties":{"prop0":"value0"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[102.0,0.0],[103.0,1.0],[104.0,0.0],[105.0,1.0]]},"properties":{"prop0":"value0","prop1":0.0}},{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[100.0,0.0],[101.0,0.0],[101.0,1.0],[100.0,1.0],[100.0,0.0]]]},"properties":{"prop0":"value0","prop1":{"this":"that"}}}]}';

		//echo "geojson=".urlencode($g);

		$url = "http://dev.noahveltman.com/node/topo";

		$ch = curl_init($url);		
		curl_setopt($ch, CURLOPT_POST, TRUE);
		curl_setopt($ch, CURLOPT_POSTFIELDS, "geojson=".urlencode($_POST["geojson"]));
		curl_setopt ($ch, CURLOPT_RETURNTRANSFER, 1);
		$curl_result = curl_exec($ch);
		curl_close($ch);

		echo $curl_result;

	}

?>