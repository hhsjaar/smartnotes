import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Fetch all contacts
export async function GET() {
  try {
    const contacts = await prisma.employeeContact.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(contacts);
  } catch (error) {
    console.error('Failed to fetch employee contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

// Create a new contact
export async function POST(request: Request) {
  try {
    const { name, number } = await request.json();
    if (!name || !number) {
      return NextResponse.json({ error: 'Name and phone number are required' }, { status: 400 });
    }

    // Clean number to keep only digits
    let cleanedNumber = number.replace(/[^0-9]/g, '');
    if (cleanedNumber.startsWith('0')) {
      cleanedNumber = '62' + cleanedNumber.substring(1);
    }

    const contact = await prisma.employeeContact.create({
      data: {
        name: name.trim(),
        number: cleanedNumber,
      },
    });

    return NextResponse.json(contact);
  } catch (error: any) {
    console.error('Failed to create employee contact:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Nomor telepon sudah terdaftar.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Gagal menambahkan kontak' }, { status: 500 });
  }
}

// Delete a contact
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    await prisma.employeeContact.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete employee contact:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
