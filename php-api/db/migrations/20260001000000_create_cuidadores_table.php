<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateCuidadoresTable extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('cuidadores', [
            'engine'    => 'InnoDB',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'comment'   => 'Cuidadores registrados en el sistema',
        ]);

        $table
            ->addColumn('nombre',     'string',  ['limit' => 100, 'null' => false, 'comment' => 'Nombre completo del cuidador'])
            ->addColumn('pago_fijo',  'boolean', ['default' => false, 'null' => false, 'comment' => 'true = tarifa fija por hora; false = tarifa variable'])
            ->addColumn('tarifa_cop', 'decimal', ['precision' => 12, 'scale' => 2, 'null' => true, 'default' => null, 'comment' => 'Tarifa horaria fija en COP (solo aplica si pago_fijo=true)'])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addColumn('updated_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'update' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addIndex(['nombre'], ['unique' => true, 'name' => 'uq_cuidadores_nombre'])
            ->create();
    }

    public function down(): void
    {
        $this->table('cuidadores')->drop()->save();
    }
}
