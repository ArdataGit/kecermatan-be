
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking paketPembelian for id: 590');
  const paket = await prisma.paketPembelian.findUnique({
    where: { id: 590 }
  });
  console.log('Paket Pembelian 590:', paket);

  if (paket) {
    console.log('Checking paketPembelianKecermatan for paketPembelianId: 590');
    const items = await prisma.paketPembelianKecermatan.findMany({
      where: { paketPembelianId: 590 },
      include: {
        kategoriSoalKecermatan: true
      }
    });
    console.log(`Found ${items.length} kecermatan items:`);
    console.log(JSON.stringify(items, null, 2));
  }
}

main();
