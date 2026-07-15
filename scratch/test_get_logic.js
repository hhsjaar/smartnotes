const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateExpiryDate(startDate, duration) {
  const expiryDate = new Date(startDate);
  const dur = (duration || '1 hari').toLowerCase();

  if (dur.includes('1 hari')) {
    expiryDate.setDate(expiryDate.getDate() + 1);
  } else if (dur.includes('3 hari')) {
    expiryDate.setDate(expiryDate.getDate() + 3);
  } else if (dur.includes('7 hari')) {
    expiryDate.setDate(expiryDate.getDate() + 7);
  } else if (dur.includes('2 minggu')) {
    expiryDate.setDate(expiryDate.getDate() + 14);
  } else if (dur.includes('1 bulan')) {
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  } else {
    expiryDate.setDate(expiryDate.getDate() + 1);
  }
  return expiryDate;
}

async function main() {
  try {
    console.log('Simulating GET /api/chat/attributes...');
    let attributes = await prisma.chatAttribute.findMany({
      orderBy: { name: 'asc' },
    });

    const now = new Date();
    let hasExpiredUpdates = false;

    for (const attr of attributes) {
      const opts = Array.isArray(attr.options) ? attr.options : [];
      let isChanged = false;
      const newOpts = [];

      for (const opt of opts) {
        if (opt.hasTimeframe && opt.expiryDate) {
          const expDate = new Date(opt.expiryDate);
          if (expDate <= now) {
            console.log(`Found expired option: ${opt.text} in attribute ${attr.name}`);
            isChanged = true;
          } else {
            newOpts.push(opt);
          }
        } else {
          newOpts.push(opt);
        }
      }
    }
    console.log('Simulation completed successfully!');
  } catch (err) {
    console.error('Simulation failed with error:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
