const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const k = await prisma.kategoriSoalKecermatan.count();
    const l = await prisma.kiasan.count();
    const m = await prisma.soalKecermatan.count();
    console.log(`KategoriSoalKecermatan: ${k}`);
    console.log(`Kiasan: ${l}`);
    console.log(`SoalKecermatan: ${m}`);
  } catch (e) {
    console.error('Verification failed:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
