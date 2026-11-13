<?php
/**
 * Phinx configuration — reads DB credentials from config.php constants.
 * Usage:
 *   php vendor/bin/phinx migrate               # apply pending migrations
 *   php vendor/bin/phinx rollback              # revert last migration
 *   php vendor/bin/phinx rollback -t 0         # revert ALL migrations
 *   php vendor/bin/phinx seed:run              # run all seeders
 *   php vendor/bin/phinx status                # see migration status
 *   php vendor/bin/phinx create MyMigration    # scaffold a new migration
 */

// Load credentials from config.php if not already loaded
$configPath = __DIR__ . '/config.php';
if (file_exists($configPath)) {
    require_once $configPath;
}

return [
    'paths' => [
        'migrations' => __DIR__ . '/db/migrations',
        'seeds'      => __DIR__ . '/db/seeds',
    ],

    'environments' => [
        'default_migration_table' => 'phinxlog',
        'default_environment'     => 'development',

        'development' => [
            'adapter' => 'mysql',
            'host'    => defined('DB_HOST') ? DB_HOST : '127.0.0.1',
            'name'    => defined('DB_NAME') ? DB_NAME : 'labhora',
            'user'    => defined('DB_USER') ? DB_USER : 'root',
            'pass'    => defined('DB_PASS') ? DB_PASS : '',
            'port'    => defined('DB_PORT') ? DB_PORT : '3306',
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
        ],

        'production' => [
            'adapter' => 'mysql',
            'host'    => defined('DB_HOST') ? DB_HOST : 'localhost',
            'name'    => defined('DB_NAME') ? DB_NAME : '',
            'user'    => defined('DB_USER') ? DB_USER : '',
            'pass'    => defined('DB_PASS') ? DB_PASS : '',
            'port'    => defined('DB_PORT') ? DB_PORT : '3306',
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
        ],
    ],

    'version_order' => 'creation',
];
