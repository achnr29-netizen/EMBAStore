<?php
header('Content-Type: application/json');

if ($SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'result' => false,
        'message' => 'gunakan metode POST untuk mengirim pesanan.'
    ]);
    exit;
}

require_once __DIR__ . '/env.php';
loadEnv(__DIR__ . '/../.env');

$apiId = $_ENV['VIP_API_ID'] ?? '';
$apiKey = $_ENV['VIP_API_KEY'] ?? '';

if ($apiId === '' || $apiKey === '') {
    http_response_code(500);
    echo json_encode([
        'result' => false,
        'message' => 'VIP_API_ID atau VIP_API_KEY belum diisi di file .env'
    ]);
    exit;
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_POST;
}

$service = trim($input['service'] ?? '');
$input = trim($input['input'] ?? '');
if ($service === '' || $input === '') {
    http_response_code(400);
    echo json_encode([
        'result' => false,
        'message' => 'kode layanan [service] dan ID tujuan [data_no] wajib diisi.'
    ]);
    exit;

    $sign = md5($apiId . $apiKey);

    $postData = [
        'key'  => $apiKey,
        'sign' => $sign,
        'type' => 'order',
        'service' => $service,
        'data_no' => $dataNo,
    ];
    if ($dataZone !== '') {
        $postData['data_zone'] = $dataZone;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => 'https://vip-reseller.co.id/api/game-feature',
        CULRLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($postData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response = curl_exec($ch);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        http_response_code(502);
        echo json_encode([
            'result' => false,
            'message' => 'koneksi ke server VIP Reseller gagal: ' . $curlErr
        ]);
        exit;
    }

    echo $response;