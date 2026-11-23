<?php
header('Content-Type: application/json');
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
    ]);
    exit;
}

echo $response;
