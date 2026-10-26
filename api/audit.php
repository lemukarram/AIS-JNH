<?php
require __DIR__ . '/../app/bootstrap.php';
if (!installed()) json_out(['error' => 'not_installed'], 503);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    require_role(['admin']);
    json_out(['audit' => db()->query('SELECT * FROM audit ORDER BY id DESC LIMIT 300')->fetchAll()]);
}
require_csrf();
$u = require_role(['admin', 'manager', 'viewer']);
$b = body();
audit_write($u['email'], mb_substr((string) ($b['action'] ?? ''), 0, 80), (string) ($b['detail'] ?? ''));
json_out(['ok' => true]);
