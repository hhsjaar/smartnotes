import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
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
    const { name } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama folder tidak boleh kosong' }, { status: 400 });
    }

    const nameTrimmed = name.trim();

    // Check if folder name already exists
    const existing = await prisma.folder.findUnique({
      where: { name: nameTrimmed }
    });

    if (existing) {
      return NextResponse.json({ error: 'Folder dengan nama ini sudah ada' }, { status: 400 });
    }

    const newFolder = await prisma.folder.create({
      data: {
        name: nameTrimmed,
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
    const { id, name } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID folder diperlukan' }, { status: 400 });
    }
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nama folder tidak boleh kosong' }, { status: 400 });
    }

    const nameTrimmed = name.trim();

    // Check unique constraint for rename
    const existing = await prisma.folder.findFirst({
      where: {
        name: nameTrimmed,
        id: { not: id }
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Folder dengan nama ini sudah ada' }, { status: 400 });
    }

    const updatedFolder = await prisma.folder.update({
      where: { id },
      data: {
        name: nameTrimmed,
      },
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
