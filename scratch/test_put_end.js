const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Finding Progres attribute...');
    const attr = await prisma.chatAttribute.findFirst({
      where: { name: 'Progres' }
    });

    if (!attr) {
      console.log('Progres attribute not found!');
      return;
    }

    console.log('Simulating action === "end" with first option...');
    const opts = Array.isArray(attr.options) ? attr.options : [];
    if (opts.length === 0) {
      console.log('No options found!');
      return;
    }

    const targetOption = opts[0];
    // Force set taken fields to simulate ending a taken task
    targetOption.status = 'taken';
    targetOption.assignedTo = 'Budi';
    // targetOption.startDate is null in DB currently

    console.log('Creating history log...');
    await prisma.chatAttributeHistory.create({
      data: {
        attributeId: attr.id,
        attributeName: attr.name,
        optionId: targetOption.id,
        optionText: targetOption.text,
        status: 'taken',
        assignedTo: targetOption.assignedTo || 'Karyawan',
        startDate: new Date(targetOption.startDate || new Date()),
        expiryDate: new Date(targetOption.expiryDate || new Date()),
      }
    });

    console.log('History log created successfully!');
  } catch (err) {
    console.error('Simulation error:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
