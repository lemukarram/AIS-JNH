<?php
// Shell: sends users to the installer on first run, otherwise serves index.html with CSRF + demo-badge meta injected.
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';

if (!installed()) {
    if (is_file(__DIR__ . '/install.php')) { header('Location: install.php'); exit; }
    http_response_code(503);
    echo 'Not installed. Upload install.php and open it once.';
    exit;
}
header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: same-origin');
$html = file_get_contents(__DIR__ . '/index.html');
$meta = '<meta name="csrf" content="' . htmlspecialchars(csrf_token()) . '">'
      . '<meta name="demo-badge" content="' . (cfg('DEMO_BADGE') ? '1' : '0') . '">'
      . '<meta name="backend" content="php">';
echo str_replace('<head>', '<head>' . $meta, $html);
