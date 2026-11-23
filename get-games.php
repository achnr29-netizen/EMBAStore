<?php
header('Content-Type: application/json');
<<<<<<< HEAD

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
=======
// Aktifkan baris di bawah jika frontend dan PHP berada di domain/subdomain berbeda
// header('Access-Control-Allow-Origin: *');

$api_id  = 'ISI_API_ID_KAMU';
$api_key = 'ISI_API_KEY_KAMU';
$sign    = md5($api_id . $api_key);

$postdata = [
    'key'  => $api_key,
    'sign' => $sign,
    'type' => 'services'
];

// Jika ingin memfilter game tertentu lewat parameter URL, misal: get-games.php?game=Mobile%20Legends
if (!empty($_GET['game'])) {
    $postdata['filter_type']  = 'game';
    $postdata['filter_value'] = $_GET['game'];
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://vip-reseller.co.id/api/game-feature');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postdata));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

$response = curl_exec($ch);
$curl_err = curl_error($ch);
curl_close($ch);

if ($curl_err) {
    http_response_code(500);
    echo json_encode([
        'result'  => false,
        'message' => 'Koneksi cURL gagal: ' . $curl_err
>>>>>>> aff24b34dec07dabb01f018e168fd8079a43db59
    ]);
    exit;
}

  echo $response;
  
