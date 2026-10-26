<?php
require __DIR__ . '/../app/bootstrap.php';
if (!installed()) json_out(['error' => 'not_installed'], 503);
start_session();
$b = body();
$action = $b['action'] ?? '';

if ($action === 'login') {
    if (rate_blocked('login', cfg('RATE_LOGIN'))) json_out(['error' => 'rate'], 429);
    $st = db()->prepare('SELECT * FROM users WHERE email = ?');
    $st->execute([strtolower(trim((string) ($b['email'] ?? '')))]);
    $u = $st->fetch();
    if (!$u || !password_verify((string) ($b['password'] ?? ''), $u['pass_hash'])) {
        rate_hit('login');
        usleep(250000);
        json_out(['error' => 'invalid'], 401);
    }
    session_regenerate_id(true);
    $_SESSION['user'] = ['email' => $u['email'], 'name' => $u['name'], 'role' => $u['role']];
    audit_write($u['email'], 'login');
    json_out(['user' => $_SESSION['user'], 'csrf' => csrf_token()]);
}
if ($action === 'logout') {
    require_csrf();
    if ($u = current_user()) audit_write($u['email'], 'logout');
    $_SESSION = [];
    session_destroy();
    json_out(['ok' => true]);
}
if ($action === 'me') {
    $u = current_user();
    if (!$u) json_out(['error' => 'auth'], 401);
    json_out(['user' => $u, 'csrf' => csrf_token()]);
}
json_out(['error' => 'bad_request'], 400);
