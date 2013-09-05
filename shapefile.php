<?php

    $tmp_name = $_FILES["shapefile"]["tmp_name"];    
    $success = move_uploaded_file($tmp_name, $tmp_name.".zip");        
    
	$url = "http://ogre.adc4gis.com/convert";

	$ch = curl_init($url);
	curl_setopt ($ch, CURLOPT_FOLLOWLOCATION, TRUE);		
	curl_setopt($ch, CURLOPT_POST, TRUE);
	curl_setopt($ch, CURLOPT_POSTFIELDS, array('upload' => '@' . $tmp_name.".zip"));
	curl_setopt ($ch, CURLOPT_RETURNTRANSFER, 1);
	$curl_result = curl_exec($ch);
	curl_close($ch);

	echo $curl_result;

?>