<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateRateLimitsTable extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('rate_limits', [
            'engine'    => 'InnoDB',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'comment'   => 'Rate limiting por IP (hasheada) y endpoint',
        ]);

        $table
            ->addColumn('ip_hash',       'string',    ['limit' => 64, 'null' => false, 'comment' => 'SHA-256 de la IP del cliente — nunca almacenar IP en claro'])
            ->addColumn('endpoint',      'string',    ['limit' => 100, 'null' => false, 'comment' => 'Nombre del endpoint (ej: clock-in.php)'])
            ->addColumn('request_count', 'integer',   ['null' => false, 'default' => 1, 'signed' => false])
            ->addColumn('window_start',  'datetime',  ['null' => false, 'comment' => 'Inicio de la ventana de 60 segundos'])
            ->addIndex(['ip_hash', 'endpoint'], ['unique' => true, 'name' => 'uq_rate_limits_ip_endpoint'])
            ->addIndex(['window_start'],         ['name'   => 'idx_rate_limits_window'])
            ->create();
    }

    public function down(): void
    {
        $this->table('rate_limits')->drop()->save();
    }
}
