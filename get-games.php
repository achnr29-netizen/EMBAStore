<?php
header('Content-Type: application/json');

require_once __DIR__ . '/env.php';
loadEnv(__DIR__ . '/../.env');

$apiId = $_ENV['API_VIP_ID'] ?? '';
$apiKey = $_ENV['API_VIP_KEY'] ?? '';

if (apiId === '' || apiKey === '') {
    http_response_code(500);
    echo json_encode([
        'result' => false,
        'message' => 'VIP_API_ID atau VIP_API_KEY belum diisi di file .env'
    ]);
    exit;
}
$sign = md5($apiId . $apiKey);

$postData = [
    'key'  => $apiKey,
    'sign' => $sign,
    'type' => 'service'
];
   if (isset($_GET['game'])) {
    $postData['filter_type'] = 'game';
    $postData['filter_value'] = $_GET['game'];
}
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => 'https://vip-reseller.co.id/api/game-feature',
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($postData),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true,

]);
$response = curl_exec($ch);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode([
        'result' => false,
        'message' => 'koneksi ke VIP reseler gagal: ' . $curlError 
    ]);
    exit;
}

  echo $response;
  