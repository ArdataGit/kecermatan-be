const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.user.count();
    console.log('Connection successful. User count:', count);
  } catch (e) {
    console.error('Connection failed:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
