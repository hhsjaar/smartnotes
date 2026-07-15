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
    console.log('Finding Progres attribute...');
    const attribute = await prisma.chatAttribute.findFirst({
      where: { name: 'Progres' }
    });

    if (!attribute) {
      console.log('Progres not found!');
      return;
    }

    const opts = Array.isArray(attribute.options) ? attribute.options : [];
    const optionIndex = opts.findIndex(o => o.text === 'Motong Kentang');

    if (optionIndex === -1) {
      console.log('Option Motong Kentang not found!');
      return;
    }

    const targetOption = { ...opts[optionIndex] };
    console.log('Target option state before ending:', targetOption);

    console.log('Creating history log...');
    const hist = await prisma.chatAttributeHistory.create({
      data: {
        attributeId: attribute.id,
        attributeName: attribute.name,
        optionId: targetOption.id,
        optionText: targetOption.text,
        status: 'taken',
        assignedTo: targetOption.assignedTo || 'Karyawan',
        startDate: new Date(targetOption.startDate || new Date()),
        expiryDate: new Date(targetOption.expiryDate || new Date()),
      }
    });
    console.log('History logged:', hist);

    // Restart countdown immediately
    const newStart = new Date();
    const newExpiry = calculateExpiryDate(newStart, targetOption.duration || '1 hari');

    targetOption.status = 'ready';
    targetOption.assignedTo = null;
    targetOption.startDate = newStart.toISOString();
    targetOption.expiryDate = newExpiry.toISOString();

    opts[optionIndex] = targetOption;

    console.log('Updating chat attribute options...');
    const updated = await prisma.chatAttribute.update({
      where: { id: attribute.id },
      data: {
        options: opts,
      },
    });
    console.log('Database updated successfully! New options state:', updated.options);
  } catch (err) {
    console.error('CRITICAL ERROR DURING PUT END SIMULATION:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
