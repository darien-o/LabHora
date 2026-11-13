<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateRecaudosTable extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('recaudos', [
            'engine'    => 'InnoDB',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'comment'   => 'Recaudos mensuales de dinero recibido',
        ]);

        $table
            ->addColumn('mes',         'string',    ['limit' => 7, 'null' => false, 'comment' => 'Formato YYYY-MM'])
            ->addColumn('monto',       'decimal',   ['precision' => 12, 'scale' => 2, 'null' => false])
            ->addColumn('descripcion', 'text',      ['null' => true, 'default' => null])
            ->addColumn('created_at',  'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addColumn('updated_at',  'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'update' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addIndex(['mes'], ['name' => 'idx_recaudos_mes'])
            ->create();
    }

    public function down(): void
    {
        $this->table('recaudos')->drop()->save();
    }
}
