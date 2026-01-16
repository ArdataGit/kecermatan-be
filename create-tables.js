const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Creating KategoriSoalKecermatan...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`KategoriSoalKecermatan\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`judul_kategori\` VARCHAR(191) NOT NULL,
        \`keterangan\` TEXT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    console.log('Creating Kiasan...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Kiasan\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`kategoriSoalKecermatanId\` INTEGER NOT NULL,
        \`karakter\` JSON NOT NULL,
        \`kiasan\` JSON NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL,
        INDEX \`Kiasan_kategoriSoalKecermatanId_idx\`(\`kategoriSoalKecermatanId\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    console.log('Creating SoalKecermatan...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`SoalKecermatan\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`kiasanId\` INTEGER NOT NULL,
        \`soal\` JSON NOT NULL,
        \`jawaban\` VARCHAR(191) NOT NULL,
        \`waktu\` INTEGER NOT NULL DEFAULT 0,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL,
        INDEX \`SoalKecermatan_kiasanId_idx\`(\`kiasanId\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    console.log('Adding constraints...');
    try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE \`Kiasan\` ADD CONSTRAINT \`Kiasan_kategoriSoalKecermatanId_fkey\` FOREIGN KEY (\`kategoriSoalKecermatanId\`) REFERENCES \`KategoriSoalKecermatan\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE;
        `);
    } catch (e) { console.log('Constraint Kiasan might already exist'); }

    try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE \`SoalKecermatan\` ADD CONSTRAINT \`SoalKecermatan_kiasanId_fkey\` FOREIGN KEY (\`kiasanId\`) REFERENCES \`Kiasan\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE;
        `);
    } catch (e) { console.log('Constraint SoalKecermatan might already exist'); }

    console.log('Tables created successfully.');
  } catch (e) {
    console.error('Error creating tables:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
