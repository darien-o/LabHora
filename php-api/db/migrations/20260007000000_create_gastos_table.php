<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateGastosTable extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('gastos', [
            'engine'    => 'InnoDB',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'comment'   => 'Gastos e ingresos extra asociados a turnos',
        ]);

        $table
            ->addColumn('cuidador_id',  'integer', ['null' => false, 'signed' => true, 'comment' => 'FK → cuidadores.id'])
            ->addColumn('registro_id',  'integer', ['null' => true,  'signed' => true, 'default' => null, 'comment' => 'FK → registros.id (opcional)'])
            ->addColumn('fecha',        'date',    ['null' => false])
            ->addColumn('tipo',         'string',  ['limit' => 20, 'null' => false, 'comment' => 'expense | income'])
            ->addColumn('monto',        'decimal', ['precision' => 12, 'scale' => 2, 'null' => false])
            ->addColumn('descripcion',  'text',    ['null' => true, 'default' => null])
            ->addColumn('created_at',   'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addForeignKey('cuidador_id', 'cuidadores', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'CASCADE',
                'constraint' => 'fk_gastos_cuidador',
            ])
            ->addForeignKey('registro_id', 'registros', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'CASCADE',
                'constraint' => 'fk_gastos_registro',
            ])
            ->addIndex(['cuidador_id'],  ['name' => 'idx_gastos_cuidador'])
            ->addIndex(['registro_id'],  ['name' => 'idx_gastos_registro'])
            ->addIndex(['fecha'],        ['name' => 'idx_gastos_fecha'])
            ->create();
    }

    public function down(): void
    {
        $this->table('gastos')->drop()->save();
    }
}
