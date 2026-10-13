import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/adminAuth';

const unauthorized = () => NextResponse.json({ error: 'Akses admin diperlukan' }, { status: 401 });

// GET: daftar kamus manual
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const terms = await prisma.glossaryTerm.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(terms);
}

// POST: tambah satu atau banyak istilah (dipisah baris baru)
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const { term } = await request.json();
    const items: string[] = String(term || '')
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.slice(0, 200));
    if (items.length === 0) {
      return NextResponse.json({ error: 'Istilah tidak boleh kosong' }, { status: 400 });
    }
    await prisma.glossaryTerm.createMany({ data: items.map((t) => ({ term: t })), skipDuplicates: true });
    const terms = await prisma.glossaryTerm.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json(terms);
  } catch (error) {
    console.error('Gagal menambah kamus:', error);
    return NextResponse.json({ error: 'Gagal menambah istilah' }, { status: 500 });
  }
}

// DELETE: hapus satu istilah
export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID harus ditentukan' }, { status: 400 });
  try {
    await prisma.glossaryTerm.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Istilah tidak ditemukan' }, { status: 404 });
  }
}
