<?php

declare(strict_types=1);

use Phinx\Seed\AbstractSeed;

/**
 * DatabaseSeeder — master seeder. Runs all seeders in the correct order.
 *
 * Usage:
 *   php vendor/bin/phinx seed:run          # runs DatabaseSeeder (calls all others)
 *   php vendor/bin/phinx seed:run -s CuidadoresSeeder   # run one seeder only
 */
class DatabaseSeeder extends AbstractSeed
{
    /**
     * Return seeders to run, in dependency order.
     * cuidadores must come first because other tables FK into it.
     */
    public function getDependencies(): array
    {
        return [
            'CuidadoresSeeder',
        ];
    }

    public function run(): void
    {
        // Dependencies are called automatically by Phinx when getDependencies() is used.
        // Add any additional seed logic here if needed in the future.
        echo "  → DatabaseSeeder: all seeds complete.\n";
    }
}
