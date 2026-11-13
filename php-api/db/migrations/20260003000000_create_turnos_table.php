<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateTurnosTable extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('turnos', [
            'engine'    => 'InnoDB',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'comment'   => 'Turnos programados por cuidador y día',
        ]);

        $table
            ->addColumn('cuidador_id',  'integer', ['null' => false, 'signed' => true, 'comment' => 'FK → cuidadores.id'])
            ->addColumn('fecha',        'date',    ['null' => false, 'comment' => 'Fecha del turno (YYYY-MM-DD)'])
            ->addColumn('hora_inicio',  'time',    ['null' => false, 'comment' => 'Hora de inicio del turno (HH:mm:ss)'])
            ->addColumn('hora_fin',     'time',    ['null' => false, 'comment' => 'Hora de fin del turno (HH:mm:ss)'])
            ->addColumn('created_at',   'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addForeignKey('cuidador_id', 'cuidadores', 'id', [
                'delete' => 'CASCADE',
                'update' => 'CASCADE',
                'constraint' => 'fk_turnos_cuidador',
            ])
            ->addIndex(['cuidador_id', 'fecha', 'hora_inicio', 'hora_fin'], [
                'unique' => true,
                'name'   => 'uq_turnos_slot',
            ])
            ->addIndex(['fecha'], ['name' => 'idx_turnos_fecha'])
            ->create();
    }

    public function down(): void
    {
        $this->table('turnos')->drop()->save();
    }
}
