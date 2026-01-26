
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paketPembelianId = 591;
  
  console.log(`Checking data for paketPembelianId: ${paketPembelianId}`);

  // 1. Check if paketPembelian exists
  const paket = await prisma.paketPembelian.findUnique({
    where: { id: paketPembelianId },
  });
  console.log('Paket found:', paket ? 'YES' : 'NO');

  // 2. Check relations
  const count = await prisma.paketPembelianBacaan.count({
    where: { paketPembelianId: paketPembelianId },
  });
  console.log(`Number of associated Bacaan categories: ${count}`);

  if (count > 0) {
      const relations = await prisma.paketPembelianBacaan.findMany({
          where: { paketPembelianId: paketPembelianId },
          include: { kategoriSoalBacaan: true }
      });
      console.log('Relations:', JSON.stringify(relations, null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
