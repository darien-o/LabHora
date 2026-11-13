<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateRegistrosTable extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('registros', [
            'engine'    => 'InnoDB',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'comment'   => 'Registros de entrada/salida de cuidadores',
        ]);

        $table
            ->addColumn('cuidador_id',           'integer',   ['null' => false, 'signed' => true, 'comment' => 'FK → cuidadores.id'])
            ->addColumn('clock_in',              'datetime',  ['null' => false, 'comment' => 'Fecha/hora de entrada (UTC)'])
            ->addColumn('clock_out',             'datetime',  ['null' => true,  'default' => null, 'comment' => 'Fecha/hora de salida (UTC); NULL = turno activo'])
            ->addColumn('total_horas',           'decimal',   ['precision' => 6, 'scale' => 2, 'null' => true, 'default' => null])
            ->addColumn('pagado',                'boolean',   ['default' => false, 'null' => false])
            ->addColumn('valor_hora',            'decimal',   ['precision' => 12, 'scale' => 2, 'null' => true, 'default' => null, 'comment' => 'Valor hora calculado al marcar como pagado'])
            ->addColumn('notas',                 'text',      ['null' => true, 'default' => null])
            ->addColumn('imagenes',              'text',      ['null' => true, 'default' => null, 'comment' => 'Rutas/IDs de imágenes separadas por coma'])
            ->addColumn('confirmado_cuidador',   'boolean',   ['default' => false, 'null' => false, 'comment' => 'El cuidador confirmó el pago'])
            ->addColumn('fecha_confirmacion',    'datetime',  ['null' => true, 'default' => null])
            ->addColumn('monto_confirmado',      'decimal',   ['precision' => 12, 'scale' => 2, 'null' => true, 'default' => null])
            ->addColumn('created_at',            'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addColumn('updated_at',            'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'update' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addForeignKey('cuidador_id', 'cuidadores', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'CASCADE',
                'constraint' => 'fk_registros_cuidador',
            ])
            ->addIndex(['cuidador_id'],  ['name' => 'idx_registros_cuidador'])
            ->addIndex(['pagado'],       ['name' => 'idx_registros_pagado'])
            ->addIndex(['clock_in'],     ['name' => 'idx_registros_clock_in'])
            ->addIndex(['clock_out'],    ['name' => 'idx_registros_clock_out'])
            ->create();
    }

    public function down(): void
    {
        $this->table('registros')->drop()->save();
    }
}
