<?php

	if (isset($_FILES["zip"])) {
		$zip_name = $_FILES["zip"]["tmp_name"];
    	$success = move_uploaded_file($zip_name, $zip_name.".zip");
		$upload = array('zip' => '@' . $zip_name.".zip");
	} else {
		$shp_name = $_FILES["shp"]["tmp_name"];    
    	$success = move_uploaded_file($shp_name, $shp_name.".shp");
    	$upload = array('shp' => '@' . $shp_name.".shp");
    	
    	if (isset($_FILES["dbf"])) {
			$dbf_name = $_FILES["dbf"]["tmp_name"];
	    	$success = move_uploaded_file($dbf_name, $dbf_name.".dbf");
	    	$upload["dbf"] = '@' . $dbf_name.".dbf";
    	}
	}
    
    $url = "http://dev.noahveltman.com/node/shp-to-geo";
	//$url = "http://ogre.adc4gis.com/convert";

	$ch = curl_init($url);
	curl_setopt ($ch, CURLOPT_FOLLOWLOCATION, TRUE);		
	curl_setopt($ch, CURLOPT_POST, TRUE);
	curl_setopt($ch, CURLOPT_POSTFIELDS, $upload);
	curl_setopt ($ch, CURLOPT_RETURNTRANSFER, 1);
	$curl_result = curl_exec($ch);
	curl_close($ch);

	echo $curl_result;

?>