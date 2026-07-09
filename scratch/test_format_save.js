const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSave() {
  console.log('=== TEST SIMULASI PEREKAMAN SUARA & MASTER NOTE ===');

  // Fetch folders from DB
  const folders = await prisma.folder.findMany();
  console.log(`Loaded ${folders.length} folders from database.`);

  const perusahaanFolder = folders.find(f => f.name === 'Perusahaan' && !f.parentId);
  const pribadiFolder = folders.find(f => f.name === 'Pribadi' && !f.parentId);

  if (!perusahaanFolder || !pribadiFolder) {
    console.error('Error: Folder Perusahaan atau Pribadi tidak ditemukan di database.');
    return;
  }

  console.log(`Perusahaan Folder ID: ${perusahaanFolder.id}`);
  console.log(`Pribadi Folder ID: ${pribadiFolder.id}`);

  // Mock checked target folders
  const targetFolderIds = [perusahaanFolder.id, pribadiFolder.id];

  // Mock formattedData returned by Gemini
  const formattedData = {
    notes: [
      {
        title: "Laporan Detail Pecahan 1",
        content: "Isi laporan pecahan 1",
        summary: "Summary pecahan 1",
        tags: ["Test"],
        todo_list: [],
        folderId: null,
        folderName: "Pengembangan Produk",
        parentFolderName: "Perusahaan"
      },
      {
        title: "Catatan Utuh: Rangkuman Kegiatan",
        content: "Isi laporan utuh gabungan...",
        summary: "Summary utuh",
        tags: ["Utuh"],
        todo_list: [],
        folderId: null,
        folderName: "Utuh",
        parentFolderName: null
      }
    ]
  };

  const localFolders = [...folders];
  const notesToSave = [];

  // Replicate pre-processing
  for (const note of formattedData.notes) {
    const isUtuh = note.folderName?.trim().toLowerCase() === 'utuh';
    if (isUtuh && targetFolderIds && targetFolderIds.length > 0) {
      for (const targetFolderId of targetFolderIds) {
        notesToSave.push({
          ...note,
          folderId: null,
          parentFolderId: targetFolderId,
        });
      }
    } else {
      notesToSave.push(note);
    }
  }

  console.log('\nNotes to save count:', notesToSave.length);

  // Helper create folder (mocked API call)
  const handleCreateFolderMock = async (name, parentId) => {
    console.log(`[MOCK CREATE FOLDER] Creating folder named "${name}" under parent "${parentId}"...`);
    // Check if it already exists in DB
    const existing = await prisma.folder.findFirst({
      where: {
        name,
        parentId: parentId || null
      }
    });
    if (existing) {
      console.log(`[MOCK CREATE FOLDER] Folder already exists in DB: id=${existing.id}`);
      return existing;
    }
    const created = await prisma.folder.create({
      data: {
        name,
        parentId: parentId || null
      }
    });
    console.log(`[MOCK CREATE FOLDER] Created new folder in DB: id=${created.id}`);
    return created;
  };

  for (const note of notesToSave) {
    let folderId = note.folderId;
    let finalFolderName = note.folderName || 'Tanpa Folder';
    const isUtuh = note.folderName?.trim().toLowerCase() === 'utuh';

    console.log(`\nProcessing note: "${note.title}" (folderName: "${note.folderName}", parentFolderId: "${note.parentFolderId || 'none'}")`);

    // Override block
    if (targetFolderIds && targetFolderIds.length > 0) {
      if (isUtuh) {
        console.log('-> isUtuh is true, skipping override block.');
      } else {
        const resolvedFolder = folderId ? localFolders.find(f => f.id === folderId) : null;
        const isValidTarget = resolvedFolder && (
          targetFolderIds.includes(resolvedFolder.id) ||
          (resolvedFolder.parentId && targetFolderIds.includes(resolvedFolder.parentId))
        );

        if (!isValidTarget) {
          const matchedFolder = localFolders.find(
            (f) => (targetFolderIds.includes(f.id) || (f.parentId && targetFolderIds.includes(f.parentId))) &&
            (note.folderName && f.name.toLowerCase() === note.folderName.toLowerCase())
          );
          if (matchedFolder) {
            folderId = matchedFolder.id;
            finalFolderName = matchedFolder.name;
            console.log(`-> Overridden folderId to matchedFolder: id=${folderId}, name=${finalFolderName}`);
          } else {
            const fallbackFolder = localFolders.find((f) => f.id === targetFolderIds[0]);
            if (fallbackFolder) {
              folderId = fallbackFolder.id;
              finalFolderName = fallbackFolder.name;
              console.log(`-> Overridden folderId to fallbackFolder: id=${folderId}, name=${finalFolderName}`);
            }
          }
        }
      }
    }

    // Resolve block
    if (!folderId && note.folderName) {
      let parentFolderId = null;
      if (isUtuh && note.parentFolderId) {
        parentFolderId = note.parentFolderId;
        console.log(`-> isUtuh check passed, setting parentFolderId = "${parentFolderId}"`);
      } else if (note.parentFolderName) {
        const existingParent = localFolders.find(
          (f) => !f.parentId && f.name.toLowerCase() === note.parentFolderName.toLowerCase()
        );
        if (existingParent) {
          parentFolderId = existingParent.id;
        } else {
          const newParent = await handleCreateFolderMock(note.parentFolderName, null);
          if (newParent) {
            parentFolderId = newParent.id;
            localFolders.push(newParent);
          }
        }
      }

      const targetFolderName = isUtuh ? 'Utuh' : note.folderName;
      console.log(`-> Looking in localFolders for folder name "${targetFolderName}" under parent "${parentFolderId}"...`);
      const existingFolder = localFolders.find(
        (f) => f.name.toLowerCase() === targetFolderName.toLowerCase() && f.parentId === parentFolderId
      );
      if (existingFolder) {
        folderId = existingFolder.id;
        finalFolderName = existingFolder.name;
        console.log(`-> Found existing subfolder in localFolders: id=${folderId}`);
      } else {
        console.log(`-> Not found in localFolders. Creating subfolder...`);
        const newFolder = await handleCreateFolderMock(targetFolderName, parentFolderId);
        if (newFolder) {
          folderId = newFolder.id;
          finalFolderName = newFolder.name;
          localFolders.push(newFolder);
        }
      }
    }

    console.log(`Result: Note "${note.title}" will be saved to folderId="${folderId}" (name="${finalFolderName}")`);
  }
}

testSave().catch(console.error).finally(() => prisma.$disconnect());
