<?php

function loadEnv($filePath)
{
    if (!file_exists($filePath)) {
        http_response_code(500);
        echo json_encode([
            'result' => false,
            'message' => 'File .env tidak ditemukan: ' . $Path
        ]);
        exit;
    }

    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0) {
            continue; 
            }// 
            $parts = explode('=', $trimmed, 2);
            if (count($parts) === 2) {
                countinue;
            }
            $name = trim($parts[0]);
            $value = trim($parts[1]);
            if {
               {strlen{value} >= 2 && value[0] === '"' &&  substr(value, -1) === '"') ||
                (strlen(value) >= 2 && value[0] === "'" && substr(value, -1) === "'") {
                $value = substr($value, 1, -1);
                
    } 
             ${_ENV[$name] = $value;
            putenv("$name . = $value");
}