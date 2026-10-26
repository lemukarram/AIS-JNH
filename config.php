<?php
// SENTRA demo configuration. Edit, then upload. Never commit real credentials.
return [
    'DEMO_BADGE'    => true,                 // show "Demo environment · simulated data"
    'DB_DRIVER'     => 'sqlite',             // 'sqlite' (zero setup) or 'mysql'
    'DB_SQLITE'     => __DIR__ . '/data/sentra.sqlite',
    'DB_HOST'       => 'localhost',
    'DB_NAME'       => '',
    'DB_USER'       => '',
    'DB_PASS'       => '',
    'LEAD_EMAIL'    => '',                   // e.g. sales@yourcompany.com — leads are also emailed via mail()
    'SEED_PASSWORD' => 'Sentra#2026',        // password for the three demo accounts
    'RATE_LOGIN'    => [8, 600],             // max attempts, per seconds, per IP
    'RATE_LEAD'     => [5, 3600],
    'SESSION_NAME'  => 'sentra_sid',
];
