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
