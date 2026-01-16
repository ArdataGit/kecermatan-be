// test-prisma.js
const { PrismaClient } = require('@prisma/client');
const database = new PrismaClient();

console.log('Tickets model:', database.tickets ? 'Defined' : 'Undefined');