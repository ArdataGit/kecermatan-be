const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('Altering latihanKiasan table to make kategoriLatihanKecermatanId nullable...');
    
    // Modify column definition to allow NULL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`latihanKiasan\` 
      MODIFY COLUMN \`kategoriLatihanKecermatanId\` INTEGER NULL;
    `);

    console.log('Table latihanKiasan altered successfully.');
  } catch (e) {
    console.error('Error altering table:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
