import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let attributes = await prisma.chatAttribute.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    // If no attributes exist, seed default attributes
    if (attributes.length === 0) {
      const defaultNames = ['Sales', 'Umum', 'Progres', 'Urgent'];
      await prisma.chatAttribute.createMany({
        data: defaultNames.map(name => ({ name })),
        skipDuplicates: true,
      });
      
      attributes = await prisma.chatAttribute.findMany({
        orderBy: {
          name: 'asc',
        },
      });
    }

    return NextResponse.json(attributes);
  } catch (error: any) {
    console.error('Error fetching/seeding chat attributes:', error);
    return NextResponse.json({ error: 'Gagal mengambil data atribut obrolan' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama atribut tidak boleh kosong' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if attribute already exists (case-insensitive or exact)
    const existing = await prisma.chatAttribute.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Atribut tersebut sudah ada' }, { status: 400 });
    }

    const newAttribute = await prisma.chatAttribute.create({
      data: {
        name: trimmedName,
      },
    });

    return NextResponse.json(newAttribute);
  } catch (error: any) {
    console.error('Error creating chat attribute:', error);
    return NextResponse.json({ error: 'Gagal membuat atribut baru' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID atribut harus ditentukan' }, { status: 400 });
    }

    await prisma.chatAttribute.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true, message: 'Atribut berhasil dihapus' });
  } catch (error: any) {
    console.error('Error deleting chat attribute:', error);
    return NextResponse.json({ error: 'Gagal menghapus atribut' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, options, chatbotEnabled, action, optionId, assignedTo } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID atribut harus ditentukan' }, { status: 400 });
    }

    const attribute = await prisma.chatAttribute.findUnique({
      where: { id },
    });

    if (!attribute) {
      return NextResponse.json({ error: 'Atribut tidak ditemukan' }, { status: 404 });
    }

    // If taking or ending a timeframe option
    if (action === 'take' || action === 'end') {
      if (!optionId) {
        return NextResponse.json({ error: 'ID opsi harus ditentukan' }, { status: 400 });
      }

      const opts = Array.isArray(attribute.options) ? (attribute.options as any[]) : [];
      const optionIndex = opts.findIndex(o => o.id === optionId);

      if (optionIndex === -1) {
        return NextResponse.json({ error: 'Opsi tidak ditemukan' }, { status: 404 });
      }

      const targetOption = { ...opts[optionIndex] };

      if (action === 'take') {
        if (!assignedTo || !assignedTo.trim()) {
          return NextResponse.json({ error: 'Nama pengambil harus ditentukan' }, { status: 400 });
        }
        if (targetOption.status === 'taken') {
          return NextResponse.json({ error: 'Tugas ini sudah diambil oleh orang lain' }, { status: 400 });
        }

        const startDate = new Date();
        const expiryDate = new Date(startDate);
        const dur = (targetOption.duration || '1 hari').toLowerCase();

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

        targetOption.status = 'taken';
        targetOption.assignedTo = assignedTo.trim();
        targetOption.startDate = startDate.toISOString();
        targetOption.expiryDate = expiryDate.toISOString();
      } else if (action === 'end') {
        targetOption.status = 'ready';
        targetOption.assignedTo = null;
        targetOption.startDate = null;
        targetOption.expiryDate = null;
      }

      opts[optionIndex] = targetOption;

      const updated = await prisma.chatAttribute.update({
        where: { id },
        data: {
          options: opts,
        },
      });

      return NextResponse.json(updated);
    }

    const updated = await prisma.chatAttribute.update({
      where: { id },
      data: {
        options: Array.isArray(options) ? options : undefined,
        chatbotEnabled: typeof chatbotEnabled === 'boolean' ? chatbotEnabled : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating chat attribute:', error);
    return NextResponse.json({ error: 'Gagal memperbarui atribut' }, { status: 500 });
  }
}

