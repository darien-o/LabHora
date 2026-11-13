<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateAnticiposTable extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('anticipos', [
            'engine'    => 'InnoDB',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'comment'   => 'Anticipos de pago a cuidadores',
        ]);

        $table
            ->addColumn('cuidador_id',       'integer',   ['null' => false, 'signed' => true, 'comment' => 'FK → cuidadores.id'])
            ->addColumn('fecha',             'date',      ['null' => false, 'comment' => 'Fecha del anticipo'])
            ->addColumn('mes',               'string',    ['limit' => 7, 'null' => false, 'comment' => 'Mes al que imputa el anticipo (YYYY-MM)'])
            ->addColumn('monto',             'decimal',   ['precision' => 12, 'scale' => 2, 'null' => false])
            ->addColumn('descripcion',       'text',      ['null' => true, 'default' => null])
            ->addColumn('confirmado',        'boolean',   ['default' => false, 'null' => false, 'comment' => 'Confirmado por el administrador'])
            ->addColumn('fecha_confirmacion','datetime',  ['null' => true, 'default' => null])
            ->addColumn('created_at',        'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addColumn('updated_at',        'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'update' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addForeignKey('cuidador_id', 'cuidadores', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'CASCADE',
                'constraint' => 'fk_anticipos_cuidador',
            ])
            ->addIndex(['cuidador_id'], ['name' => 'idx_anticipos_cuidador'])
            ->addIndex(['mes'],         ['name' => 'idx_anticipos_mes'])
            ->create();
    }

    public function down(): void
    {
        $this->table('anticipos')->drop()->save();
    }
}
