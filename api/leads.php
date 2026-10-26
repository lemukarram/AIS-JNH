<?php
require __DIR__ . '/../app/bootstrap.php';
if (!installed()) json_out(['error' => 'not_installed'], 503);
start_session();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    require_role(['admin']);
    json_out(['leads' => db()->query('SELECT * FROM leads ORDER BY id DESC LIMIT 500')->fetchAll()]);
}

// Public submit (the pilot form must work for anyone): honeypot + rate limit; no stored session needed.
$b = body();
if (!empty($b['website'])) json_out(['ok' => true]); // honeypot
if (!rate_ok('lead', cfg('RATE_LEAD'))) json_out(['error' => 'rate'], 429);
$name = trim((string) ($b['name'] ?? ''));
$email = trim((string) ($b['email'] ?? ''));
if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'invalid'], 422);
$cut = function ($k, $n) use ($b) {
    return mb_substr(trim((string) ($b[$k] ?? '')), 0, $n);
};
db()->prepare('INSERT INTO leads (ts,name,venue,type,cams,phone,email,notes) VALUES (?,?,?,?,?,?,?,?)')
    ->execute([time(), mb_substr($name, 0, 120), $cut('venue', 160), $cut('type', 40), (int) ($b['cams'] ?? 0), $cut('phone', 40), mb_substr($email, 0, 190), $cut('notes', 2000)]);
if ($to = cfg('LEAD_EMAIL')) {
    $subject = 'New pilot request: ' . preg_replace('/[\r\n]+/', ' ', $name);
    $text = "Name: $name\nEmail: $email\nVenue: " . $cut('venue', 160) . "\nType: " . $cut('type', 40) . "\nCameras: " . (int) ($b['cams'] ?? 0) . "\nPhone: " . $cut('phone', 40) . "\nNotes: " . $cut('notes', 2000);
    @mail($to, $subject, $text, 'From: no-reply@' . preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
}
json_out(['ok' => true]);
