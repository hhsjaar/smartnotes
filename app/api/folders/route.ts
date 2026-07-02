import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const defaultFolders = [
  {
    name: 'Utuh',
    subfolders: []
  },
  {
    name: 'Perusahaan',
    subfolders: [
      'Belanjaan',
      'Briefing Operasional',
      'Laporan Kantor',
      'Pengembangan Produk',
      'SOP',
      'Temuan Harian',
      'Progres Harian'
    ]
  },
  {
    name: 'Polsek',
    subfolders: [
      'Temuan Harian',
      'Progres Harian',
      'Laporan Keamanan',
      'Pemberdayaan Masyarakat'
    ]
  },
  {
    name: 'Pribadi',
    subfolders: [
      'Keuangan',
      'Diskusi & Edukasi'
    ]
  }
];

export async function GET() {
  try {
    // 1. Deduplicate any folders with the same name under the same parentId (Self-Healing)
    const allFoldersList = await prisma.folder.findMany();
    const grouped = new Map<string, string[]>(); // key: parentId_nameLow, value: ids
    for (const f of allFoldersList) {
      const key = `${f.parentId || 'root'}_${f.name.toLowerCase()}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(f.id);
    }
    
    for (const [key, ids] of grouped.entries()) {
      if (ids.length > 1) {
        const keepId = ids[0];
        const otherIds = ids.slice(1);
        
        // Update subfolders
        await prisma.folder.updateMany({
          where: { parentId: { in: otherIds } },
          data: { parentId: keepId }
        });
        
        // Update notes
        await prisma.note.updateMany({
          where: { folder_id: { in: otherIds } },
          data: { folder_id: keepId }
        });
        
        // Delete duplicates
        await prisma.folder.deleteMany({
          where: { id: { in: otherIds } }
        });
      }
    }

    const count = await prisma.folder.count();
    if (count === 0) {
      // Seed default folders and subfolders on a completely fresh DB
      for (const parent of defaultFolders) {
        const createdParent = await prisma.folder.create({
          data: { name: parent.name }
        });
        for (const sub of parent.subfolders) {
          await prisma.folder.create({
            data: {
              name: sub,
              parentId: createdParent.id
            }
          });
        }
      }
    } else {
      // Auto-migrate existing flat folders if Parent Folders do not exist yet
      const perusahaanExists = await prisma.folder.findFirst({ where: { name: 'Perusahaan', parentId: null } });
      if (!perusahaanExists) {
        const perusahaan = await prisma.folder.create({ data: { name: 'Perusahaan' } });
        const polsek = await prisma.folder.create({ data: { name: 'Polsek' } });
        const pribadi = await prisma.folder.create({ data: { name: 'Pribadi' } });
        
        // Update existing flat folders to make them children of their respective parent
        const perusahaanChildren = ['Belanjaan', 'Briefing Operasional', 'Laporan Kantor', 'Pengembangan Produk', 'SOP'];
        await prisma.folder.updateMany({
          where: { name: { in: perusahaanChildren }, parentId: null },
          data: { parentId: perusahaan.id }
        });
        
        const polsekChildren = ['Laporan Keamanan', 'Pemberdayaan Masyarakat'];
        await prisma.folder.updateMany({
          where: { name: { in: polsekChildren }, parentId: null },
          data: { parentId: polsek.id }
        });
        
        const pribadiChildren = ['Keuangan', 'Diskusi & Edukasi'];
        await prisma.folder.updateMany({
          where: { name: { in: pribadiChildren }, parentId: null },
          data: { parentId: pribadi.id }
        });

        // Special case: 'Temuan Harian' and 'Progres Harian' (exist in both Perusahaan and Polsek)
        const temuanHarian = await prisma.folder.findFirst({ where: { name: 'Temuan Harian', parentId: null } });
        if (temuanHarian) {
          await prisma.folder.update({ where: { id: temuanHarian.id }, data: { parentId: perusahaan.id } });
        } else {
          await prisma.folder.create({ data: { name: 'Temuan Harian', parentId: perusahaan.id } });
        }
        await prisma.folder.create({ data: { name: 'Temuan Harian', parentId: polsek.id } });

        const progresHarian = await prisma.folder.findFirst({ where: { name: 'Progres Harian', parentId: null } });
        if (progresHarian) {
          await prisma.folder.update({ where: { id: progresHarian.id }, data: { parentId: perusahaan.id } });
        } else {
          await prisma.folder.create({ data: { name: 'Progres Harian', parentId: perusahaan.id } });
        }
        await prisma.folder.create({ data: { name: 'Progres Harian', parentId: polsek.id } });
      }
    }

    const folders = await prisma.folder.findMany({
      orderBy: {
        name: 'asc',
      },
    });
    return NextResponse.json(folders);
  } catch (error: any) {
    console.error('Error fetching folders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, parentId } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama folder tidak boleh kosong' }, { status: 400 });
    }

    const nameTrimmed = name.trim();

    // Check if folder name already exists under the same parent
    const existing = await prisma.folder.findFirst({
      where: {
        name: nameTrimmed,
        parentId: parentId || null
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Folder dengan nama ini sudah ada di lokasi ini' }, { status: 400 });
    }

    const newFolder = await prisma.folder.create({
      data: {
        name: nameTrimmed,
        parentId: parentId || null,
      },
    });

    return NextResponse.json(newFolder);
  } catch (error: any) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, parentId } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID folder diperlukan' }, { status: 400 });
    }
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama folder tidak boleh kosong' }, { status: 400 });
    }

    const nameTrimmed = name.trim();

    // Loop/cycle detection if moving folders
    if (parentId) {
      if (parentId === id) {
        return NextResponse.json({ error: 'Folder tidak bisa menjadi parent dari dirinya sendiri' }, { status: 400 });
      }

      let currentParentId = parentId;
      while (currentParentId) {
        const folderObj = await prisma.folder.findUnique({
          where: { id: currentParentId },
          select: { parentId: true }
        });
        if (folderObj?.parentId === id) {
          return NextResponse.json({ error: 'Tidak bisa memindahkan folder ke dalam subfoldernya sendiri' }, { status: 400 });
        }
        currentParentId = folderObj?.parentId || null;
      }
    }

    // Check unique constraint for rename/move under the same target parent
    let targetParentId = parentId;
    if (parentId === undefined) {
      const currentFolder = await prisma.folder.findUnique({
        where: { id },
        select: { parentId: true }
      });
      targetParentId = currentFolder?.parentId || null;
    }

    const existing = await prisma.folder.findFirst({
      where: {
        name: nameTrimmed,
        parentId: targetParentId || null,
        id: { not: id }
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Folder dengan nama ini sudah ada di lokasi ini' }, { status: 400 });
    }

    const updateData: any = { name: nameTrimmed };
    if (parentId !== undefined) {
      updateData.parentId = parentId || null;
    }

    const updatedFolder = await prisma.folder.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedFolder);
  } catch (error: any) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID folder diperlukan' }, { status: 400 });
    }

    await prisma.folder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
