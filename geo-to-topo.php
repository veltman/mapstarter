<?php

	if (!isset($_POST["geojson"]) || empty($_POST["geojson"])) {
		echo '{"error": "No data received."}';
	} elseif (strlen($_POST["geojson"]) > 30000000) {
		echo '{"error": "GeoJSON is too large to convert."}';
	}else {

		$url = "http://mapstarter.com/convert/geo-to-topo";

		$ch = curl_init($url);		
		curl_setopt($ch, CURLOPT_POST, TRUE);
		curl_setopt($ch, CURLOPT_POSTFIELDS, "geojson=".urlencode($_POST["geojson"]));
		curl_setopt ($ch, CURLOPT_RETURNTRANSFER, 1);
		$curl_result = curl_exec($ch);
		curl_close($ch);

		echo $curl_result;

	}

?>