const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Ensure category 1 exists or use the first available
    let category = await prisma.kategoriSoalKecermatan.findFirst();
    if (!category) {
        console.log("No category found. Creating one first...");
        category = await prisma.kategoriSoalKecermatan.create({
            data: { judul_kategori: "Kategori Dummy" }
        });
    }

    console.log(`Inserting 5-Item Kiasan for Category ID: ${category.id}`);

    const kiasan5 = await prisma.kiasan.create({
      data: {
        kategoriSoalKecermatanId: category.id,
        karakter: ["A", "B", "C", "D", "E"],
        kiasan: ["1", "2", "3", "4", "5"],
      },
    });
    console.log('Successfully added 5-Item Kiasan:', kiasan5);

  } catch (e) {
    console.error('Error adding Kiasan:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
