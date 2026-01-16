const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Ensure Kiasan exists
    let kiasan = await prisma.kiasan.findFirst();
    if (!kiasan) {
        console.log("No Kiasan found. Need to create Kiasan first.");
        // Try creating category first if needed... but assuming previous steps ran
        const category = await prisma.kategoriSoalKecermatan.findFirst();
        if (category) {
             kiasan = await prisma.kiasan.create({
                data: {
                    kategoriSoalKecermatanId: category.id,
                    karakter: ['A', 'B', 'C', 'D'],
                    kiasan: ['1', '2', '3', '4']
                }
            });
        } else {
             console.error("No Category found either. Run seed-kecermatan.js first.");
             return;
        }
    }

    console.log(`Inserting SoalKecermatan for Kiasan ID: ${kiasan.id}`);

    const soal = await prisma.soalKecermatan.create({
      data: {
        kiasanId: kiasan.id,
        soal: ["A", "B", "C", "D"], // 4 items as requested
        jawaban: "A",                // 1 answer
        waktu: 60
      },
    });
    console.log('Successfully added SoalKecermatan:', soal);

  } catch (e) {
    console.error('Error adding SoalKecermatan:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
