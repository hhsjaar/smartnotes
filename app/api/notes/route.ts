import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const notes = await prisma.note.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });
    return NextResponse.json(notes);
  } catch (error: any) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, summary, tags, todo_list, folder_id } = body;
    
    const newNote = await prisma.note.create({
      data: {
        title: title ?? 'Catatan Baru',
        content: content ?? '',
        summary: summary ?? '',
        tags: tags ?? [],
        todo_list: todo_list ?? [],
        folder_id: folder_id || null,
      },
    });
    
    return NextResponse.json(newNote);
  } catch (error: any) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, title, content, summary, tags, todo_list, folder_id } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Prepare update data dynamically based on what's passed
    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = title;
    if (content !== undefined) dataToUpdate.content = content;
    if (summary !== undefined) dataToUpdate.summary = summary;
    if (tags !== undefined) dataToUpdate.tags = tags;
    if (todo_list !== undefined) dataToUpdate.todo_list = todo_list;
    if (folder_id !== undefined) dataToUpdate.folder_id = folder_id || null;

    const updatedNote = await prisma.note.update({
      where: { id },
      data: dataToUpdate,
    });
    
    return NextResponse.json(updatedNote);
  } catch (error: any) {
    console.error('Error updating note:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.note.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting note:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
