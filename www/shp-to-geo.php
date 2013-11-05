<?php

	if (isset($_FILES["zip"])) {
		$zip_name = $_FILES["zip"]["tmp_name"];
    	$success = move_uploaded_file($zip_name, $zip_name.".zip");
		$upload = array('zip' => '@' . $zip_name.".zip");
	} else {
		$shp_name = $_FILES["shp"]["tmp_name"];    
    	$success = move_uploaded_file($shp_name, $shp_name.".shp");
    	$upload = array('shp' => '@' . $shp_name.".shp");
    	    	
		$dbf_name = $_FILES["dbf"]["tmp_name"];
	    $success = move_uploaded_file($dbf_name, $shp_name.".dbf");
	    $upload["dbf"] = '@' . $shp_name.".dbf";

		$shx_name = $_FILES["shx"]["tmp_name"];
	    $success = move_uploaded_file($shx_name, $shp_name.".shx");
	    $upload["shx"] = '@' . $shp_name.".shx";

		if (isset($_FILES["prj"])) {
			$prj_name = $_FILES["prj"]["tmp_name"];
	    	$success = move_uploaded_file($prj_name, $shp_name.".prj");
	    	$upload["prj"] = '@' . $shp_name.".prj";
	    }
    	
	}    

    $url = "http://mapstarter.com/convert/shp-to-geo";
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