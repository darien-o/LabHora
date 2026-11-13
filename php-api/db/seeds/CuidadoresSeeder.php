<?php

declare(strict_types=1);

use Phinx\Seed\AbstractSeed;

/**
 * CuidadoresSeeder — populates the initial caregiver list.
 *
 * Safe to re-run: uses ON DUPLICATE KEY UPDATE so existing rows are not
 * duplicated and their rates are refreshed if changed here.
 *
 * Edit the $caregivers array below to match your real caregiver names and rates.
 * Run with: php vendor/bin/phinx seed:run -s CuidadoresSeeder
 */
class CuidadoresSeeder extends AbstractSeed
{
    public function run(): void
    {
        // ---------------------------------------------------------------
        // Edit this list to match your actual caregivers.
        // pago_fijo: true  = fixed hourly rate (tarifa_cop applies)
        //            false = variable rate calculated per month
        // tarifa_cop: hourly rate in COP; null if variable
        // ---------------------------------------------------------------
        $caregivers = [
            // ['nombre' => 'Nombre Cuidador', 'pago_fijo' => true,  'tarifa_cop' => 15000.00],
            // ['nombre' => 'Otra Cuidadora',  'pago_fijo' => false, 'tarifa_cop' => null],
        ];

        if (empty($caregivers)) {
            echo "  → CuidadoresSeeder: no caregivers defined. Edit db/seeds/CuidadoresSeeder.php to add your list.\n";
            return;
        }

        $pdo = $this->getAdapter()->getConnection();

        $inserted = 0;
        $updated  = 0;

        foreach ($caregivers as $caregiver) {
            $nombre    = trim($caregiver['nombre']);
            $pagoFijo  = $caregiver['pago_fijo'] ? 1 : 0;
            $tarifaCop = $caregiver['tarifa_cop'];

            // Check existence first so we can report accurately
            $stmt = $pdo->prepare('SELECT id FROM cuidadores WHERE nombre = ?');
            $stmt->execute([$nombre]);
            $exists = $stmt->fetchColumn();

            if ($exists) {
                $upd = $pdo->prepare(
                    'UPDATE cuidadores SET pago_fijo = ?, tarifa_cop = ? WHERE nombre = ?'
                );
                $upd->execute([$pagoFijo, $tarifaCop, $nombre]);
                $updated++;
            } else {
                $ins = $pdo->prepare(
                    'INSERT INTO cuidadores (nombre, pago_fijo, tarifa_cop) VALUES (?, ?, ?)'
                );
                $ins->execute([$nombre, $pagoFijo, $tarifaCop]);
                $inserted++;
            }
        }

        echo "  → CuidadoresSeeder: $inserted inserted, $updated updated.\n";
    }
}
