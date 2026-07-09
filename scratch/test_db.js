const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const folders = await prisma.folder.findMany();
  console.log('Folders:', folders);
  const notes = await prisma.note.findMany();
  console.log('Notes count:', notes.length);
  for (const note of notes) {
    console.log(`- Note: id=${note.id}, title="${note.title}", folder_id=${note.folder_id}, created_at=${note.created_at}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
