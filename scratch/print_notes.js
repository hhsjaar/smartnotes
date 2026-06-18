const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const main = async () => {
  const notes = await prisma.note.findMany();
  console.log('Notes in database:', notes.length);
  notes.forEach((note, i) => {
    console.log(`\n--- Note #${i+1} ---`);
    console.log(`ID: ${note.id}`);
    console.log(`Title: ${note.title}`);
    console.log(`Summary: ${note.summary}`);
    console.log(`Tags: ${JSON.stringify(note.tags)}`);
    console.log(`Folder ID: ${note.folder_id}`);
    console.log(`Created At: ${note.created_at}`);
  });
  process.exit(0);
};

main().catch(console.error);
