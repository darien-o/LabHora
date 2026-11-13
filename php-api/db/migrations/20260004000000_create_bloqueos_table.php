<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateBloqueosTable extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('bloqueos', [
            'engine'    => 'InnoDB',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'comment'   => 'Bloqueos de horario: vacaciones, incapacidades, etc.',
        ]);

        $table
            ->addColumn('cuidador_id',   'integer', ['null' => false, 'signed' => true, 'comment' => 'FK → cuidadores.id'])
            ->addColumn('fecha_inicio',  'date',    ['null' => false])
            ->addColumn('fecha_fin',     'date',    ['null' => false])
            ->addColumn('hora_inicio',   'time',    ['null' => false])
            ->addColumn('hora_fin',      'time',    ['null' => false])
            ->addColumn('repetir',       'string',  ['limit' => 20, 'null' => true, 'default' => null, 'comment' => 'daily | weekly | null'])
            ->addColumn('repetir_hasta', 'date',    ['null' => true, 'default' => null])
            ->addColumn('motivo',        'string',  ['limit' => 255, 'null' => true, 'default' => null])
            ->addColumn('created_at',    'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addForeignKey('cuidador_id', 'cuidadores', 'id', [
                'delete' => 'CASCADE',
                'update' => 'CASCADE',
                'constraint' => 'fk_bloqueos_cuidador',
            ])
            ->addIndex(['cuidador_id', 'fecha_inicio'], ['name' => 'idx_bloqueos_cuidador_inicio'])
            ->addIndex(['fecha_inicio'],                ['name' => 'idx_bloqueos_fecha_inicio'])
            ->create();
    }

    public function down(): void
    {
        $this->table('bloqueos')->drop()->save();
    }
}
