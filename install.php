<?php
// One-time installer: checks the server, creates the database, seeds demo accounts, then offers to delete itself.
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';

$checks = [
    'PHP 7.4 or newer (found ' . PHP_VERSION . ')' => version_compare(PHP_VERSION, '7.4.0', '>='),
    'PDO extension' => extension_loaded('pdo'),
    (cfg('DB_DRIVER') === 'mysql' ? 'pdo_mysql' : 'pdo_sqlite') . ' extension' => extension_loaded(cfg('DB_DRIVER') === 'mysql' ? 'pdo_mysql' : 'pdo_sqlite'),
    'mbstring extension' => extension_loaded('mbstring'),
    'data/ folder is writable' => is_dir(__DIR__ . '/data') && is_writable(__DIR__ . '/data'),
];
$ok = !in_array(false, $checks, true);
$done = installed();
$msg = '';
$deleted = false;
session_name('sentra_install');
session_start();
$_SESSION['inst_csrf'] = $_SESSION['inst_csrf'] ?? bin2hex(random_bytes(16));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($_SESSION['inst_csrf'] ?? '', $_POST['t'] ?? '')) {
        $msg = 'Session expired — reload the page.';
    } elseif (($_POST['do'] ?? '') === 'install' && $ok && !$done) {
        try {
            $pw = trim((string) ($_POST['password'] ?? ''));
            if (strlen($pw) < 8) $pw = (string) cfg('SEED_PASSWORD');
            $pdo = db();
            foreach (schema((string) cfg('DB_DRIVER')) as $sql) $pdo->exec($sql);
            $ins = $pdo->prepare('INSERT INTO users (email,name,role,pass_hash) VALUES (?,?,?,?)');
            foreach ([['admin@demo.local', 'Layla Haddad', 'admin'], ['manager@demo.local', 'Omar Al-Rashid', 'manager'], ['viewer@demo.local', 'Nora Siddiqui', 'viewer']] as $u) {
                $exists = $pdo->prepare('SELECT 1 FROM users WHERE email = ?');
                $exists->execute([$u[0]]);
                if (!$exists->fetch()) $ins->execute([$u[0], $u[1], $u[2], password_hash($pw, PASSWORD_DEFAULT)]);
            }
            file_put_contents(__DIR__ . '/data/installed.lock', date('c'));
            $done = true;
            $msg = 'Installed. Demo accounts: admin@demo.local, manager@demo.local, viewer@demo.local.';
        } catch (Throwable $e) {
            $msg = 'Install failed: ' . $e->getMessage();
        }
    } elseif (($_POST['do'] ?? '') === 'delete' && $done) {
        $deleted = @unlink(__FILE__);
        $msg = $deleted ? 'install.php deleted.' : 'Could not delete install.php — remove it manually over FTP / File Manager.';
    }
}
$tok = $_SESSION['inst_csrf'];
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Install — SENTRA</title>
<style>
body{margin:0;background:#0B0E11;color:#ECF1F5;font:15px/1.5 "IBM Plex Sans",system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}
main{width:min(520px,92vw);border:1px solid #26303A;background:#10151A;padding:32px}
h1{font:500 24px "Space Grotesk",system-ui,sans-serif;margin:0 0 4px}.sub{color:#7F8D9A;margin:0 0 24px}
ul{list-style:none;padding:0;margin:0 0 24px;display:grid;gap:8px}li{display:flex;gap:10px;font-size:14px}li b{font-family:ui-monospace,Consolas,monospace}
.ok b{color:#4ADE80}.no b{color:#FF5C5C}
label{display:grid;gap:6px;font-size:12px;color:#7F8D9A;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px}
input{background:#0B0E11;border:1px solid #3A4755;color:#ECF1F5;padding:10px;font:inherit}
button{background:#C6F432;color:#10140A;border:0;padding:12px 18px;font-weight:600;cursor:pointer;width:100%}button.alt{background:none;color:#ECF1F5;border:1px solid #3A4755}
.msg{border-inline-start:3px solid #C6F432;background:#1D252C;padding:10px 14px;margin-bottom:20px}
a{color:#C6F432}
</style></head><body><main>
<h1>SENTRA installer</h1><p class="sub">One-time setup · takes under a minute</p>
<?php if ($msg): ?><div class="msg"><?= htmlspecialchars($msg) ?></div><?php endif; ?>
<ul>
<?php foreach ($checks as $label => $pass): ?><li class="<?= $pass ? 'ok' : 'no' ?>"><b><?= $pass ? '✓' : '✗' ?></b><span><?= htmlspecialchars($label) ?></span></li><?php endforeach; ?>
</ul>
<?php if ($deleted): ?>
  <p><a href="./">Open the demo →</a></p>
<?php elseif (!$done): ?>
  <form method="post"><input type="hidden" name="t" value="<?= $tok ?>"><input type="hidden" name="do" value="install">
  <label>Demo account password (min 8 chars, blank = config.php default)<input type="password" name="password" autocomplete="new-password"></label>
  <button <?= $ok ? '' : 'disabled' ?>>Create database &amp; seed demo data</button></form>
<?php else: ?>
  <p><a href="./">Open the demo →</a></p>
  <form method="post"><input type="hidden" name="t" value="<?= $tok ?>"><input type="hidden" name="do" value="delete"><button class="alt">Delete install.php now (recommended)</button></form>
<?php endif; ?>
</main></body></html>
