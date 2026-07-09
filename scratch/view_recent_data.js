const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== CURRENT FOLDERS IN DATABASE ===');
  const folders = await prisma.folder.findMany({
    orderBy: { name: 'asc' }
  });
  
  for (const f of folders) {
    const parent = f.parentId ? folders.find(p => p.id === f.parentId) : null;
    console.log(`Folder: "${f.name}" (ID: ${f.id}) -> Parent: ${parent ? `"${parent.name}" (${parent.id})` : 'ROOT'}`);
  }

  console.log('\n=== RECENT NOTES IN DATABASE ===');
  const notes = await prisma.note.findMany({
    orderBy: { created_at: 'desc' },
    take: 10
  });

  for (const n of notes) {
    const folder = n.folder_id ? folders.find(f => f.id === n.folder_id) : null;
    console.log(`Note: "${n.title}" -> Saved in Folder: ${folder ? `"${folder.name}" (ID: ${folder.id})` : 'ROOT'} (created_at: ${n.created_at})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
