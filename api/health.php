<?php
require __DIR__ . '/../app/bootstrap.php';
json_out(['ok' => true, 'php' => PHP_VERSION, 'installed' => installed(), 'demo_badge' => (bool) cfg('DEMO_BADGE'), 'time' => time()]);
