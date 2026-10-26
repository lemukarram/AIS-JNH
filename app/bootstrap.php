<?php
declare(strict_types=1);

const ROOT = __DIR__ . '/..';
$GLOBALS['CFG'] = require ROOT . '/config.php';

function cfg(string $k)
{
    return $GLOBALS['CFG'][$k] ?? null;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    if (cfg('DB_DRIVER') === 'mysql') {
        $pdo = new PDO('mysql:host=' . cfg('DB_HOST') . ';dbname=' . cfg('DB_NAME') . ';charset=utf8mb4', cfg('DB_USER'), cfg('DB_PASS'));
    } else {
        $pdo = new PDO('sqlite:' . cfg('DB_SQLITE'));
        $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_name((string) cfg('SESSION_NAME'));
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    ini_set('session.use_strict_mode', '1');
    session_start();
}

function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input');
    $j = json_decode($raw ?: '', true);
    return is_array($j) ? $j : [];
}

function csrf_token(): string
{
    start_session();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
    return $_SESSION['csrf'];
}

function require_csrf(): void
{
    start_session();
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) json_out(['error' => 'csrf'], 419);
}

function current_user(): ?array
{
    start_session();
    return $_SESSION['user'] ?? null;
}

function require_role(array $roles): array
{
    $u = current_user();
    if (!$u) json_out(['error' => 'auth'], 401);
    if (!in_array($u['role'], $roles, true)) json_out(['error' => 'forbidden'], 403);
    return $u;
}

// Failed-attempt limiter: rate_blocked() checks, rate_hit() records (used so successful logins never count).
function rate_blocked(string $action, array $limit): bool
{
    [$max, $window] = $limit;
    $st = db()->prepare('SELECT COUNT(*) FROM rate_hits WHERE action = ? AND ip = ? AND ts > ?');
    $st->execute([$action, $_SERVER['REMOTE_ADDR'] ?? '0', time() - $window]);
    return (int) $st->fetchColumn() >= $max;
}

function rate_hit(string $action): void
{
    db()->prepare('INSERT INTO rate_hits (action, ip, ts) VALUES (?,?,?)')->execute([$action, $_SERVER['REMOTE_ADDR'] ?? '0', time()]);
}

// Fixed-window rate limit keyed by action + IP. Returns false when the limit is exceeded.
function rate_ok(string $action, array $limit): bool
{
    [$max, $window] = $limit;
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
    $pdo = db();
    $pdo->prepare('DELETE FROM rate_hits WHERE ts < ?')->execute([time() - 86400]);
    $st = $pdo->prepare('SELECT COUNT(*) FROM rate_hits WHERE action = ? AND ip = ? AND ts > ?');
    $st->execute([$action, $ip, time() - $window]);
    if ((int) $st->fetchColumn() >= $max) return false;
    $pdo->prepare('INSERT INTO rate_hits (action, ip, ts) VALUES (?,?,?)')->execute([$action, $ip, time()]);
    return true;
}

function audit_write(string $user, string $action, string $detail = ''): void
{
    db()->prepare('INSERT INTO audit (ts, user, action, detail) VALUES (?,?,?,?)')->execute([time(), $user, $action, mb_substr($detail, 0, 500)]);
}

function installed(): bool
{
    return is_file(ROOT . '/data/installed.lock');
}

function schema(string $driver): array
{
    $id = $driver === 'mysql' ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    return [
        "CREATE TABLE IF NOT EXISTS users (id $id, email VARCHAR(190) UNIQUE NOT NULL, name VARCHAR(120) NOT NULL, role VARCHAR(20) NOT NULL, pass_hash VARCHAR(255) NOT NULL)",
        "CREATE TABLE IF NOT EXISTS leads (id $id, ts INT NOT NULL, name VARCHAR(120), venue VARCHAR(160), type VARCHAR(40), cams INT, phone VARCHAR(40), email VARCHAR(190), notes TEXT)",
        "CREATE TABLE IF NOT EXISTS audit (id $id, ts INT NOT NULL, user VARCHAR(190), action VARCHAR(80), detail VARCHAR(500))",
        "CREATE TABLE IF NOT EXISTS settings (k VARCHAR(80) PRIMARY KEY, v TEXT)",
        "CREATE TABLE IF NOT EXISTS rate_hits (id $id, action VARCHAR(40), ip VARCHAR(64), ts INT NOT NULL)",
    ];
}
