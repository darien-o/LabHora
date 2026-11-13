<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateRecibosTable extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('recibos', [
            'engine'    => 'InnoDB',
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'comment'   => 'Recibos de pago con imagen en Google Drive',
        ]);

        $table
            ->addColumn('cuidador_id',     'integer', ['null' => false, 'signed' => true, 'comment' => 'FK → cuidadores.id'])
            ->addColumn('mes',             'string',  ['limit' => 7, 'null' => false, 'comment' => 'Formato YYYY-MM'])
            ->addColumn('notas',           'text',    ['null' => true, 'default' => null])
            ->addColumn('descripcion',     'text',    ['null' => true, 'default' => null])
            ->addColumn('imagen_file_id',  'string',  ['limit' => 255, 'null' => true, 'default' => null, 'comment' => 'Google Drive file ID'])
            ->addColumn('imagen_url',      'string',  ['limit' => 500, 'null' => true, 'default' => null, 'comment' => 'Google Drive web view URL'])
            ->addColumn('created_at',      'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'null' => false])
            ->addForeignKey('cuidador_id', 'cuidadores', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'CASCADE',
                'constraint' => 'fk_recibos_cuidador',
            ])
            ->addIndex(['cuidador_id'], ['name' => 'idx_recibos_cuidador'])
            ->addIndex(['mes'],         ['name' => 'idx_recibos_mes'])
            ->create();
    }

    public function down(): void
    {
        $this->table('recibos')->drop()->save();
    }
}
