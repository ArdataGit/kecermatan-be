const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.kategoriSoalKecermatan.create({
      data: {
        judul_kategori: 'Kecermatan Huruf',
        keterangan: 'Soal kecermatan tipe huruf acak',
      },
    });
    console.log('Successfully added category:', result);
  } catch (e) {
    console.error('Error adding category:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
