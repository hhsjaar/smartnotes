import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper function to calculate expiry date based on start date and duration text
function calculateExpiryDate(startDate: Date, duration: string): Date {
  const expiryDate = new Date(startDate);
  const dur = (duration || '1 hari').toLowerCase();

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
  return expiryDate;
}

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

    // Process expired task countdowns
    const now = new Date();
    let hasExpiredUpdates = false;

    for (const attr of attributes) {
      const opts = Array.isArray(attr.options) ? (attr.options as any[]) : [];
      let isChanged = false;
      const newOpts = [];

      for (const opt of opts) {
        if (opt.hasTimeframe) {
          if (!opt.expiryDate) {
            const newStart = new Date();
            const newExpiry = calculateExpiryDate(newStart, opt.duration || '1 hari');
            newOpts.push({
              ...opt,
              status: 'ready',
              assignedTo: null,
              startDate: newStart.toISOString(),
              expiryDate: newExpiry.toISOString()
            });
            isChanged = true;
          } else {
            const expDate = new Date(opt.expiryDate);
            if (expDate <= now) {
              await prisma.chatAttributeHistory.create({
                data: {
                  attributeId: attr.id,
                  attributeName: attr.name,
                  optionId: opt.id,
                  optionText: opt.text,
                  status: opt.status === 'taken' ? 'taken' : 'expired',
                  assignedTo: opt.status === 'taken' ? opt.assignedTo : null,
                  startDate: new Date(opt.startDate || now),
                  expiryDate: expDate,
                }
              });

              const newStart = new Date();
              const newExpiry = calculateExpiryDate(newStart, opt.duration || '1 hari');

              newOpts.push({
                ...opt,
                status: 'ready',
                assignedTo: null,
                startDate: newStart.toISOString(),
                expiryDate: newExpiry.toISOString()
              });
              isChanged = true;
            } else {
              newOpts.push(opt);
            }
          }
        } else {
          newOpts.push(opt);
        }
      }

      if (isChanged) {
        await prisma.chatAttribute.update({
          where: { id: attr.id },
          data: { options: newOpts }
        });
        hasExpiredUpdates = true;
      }
    }

    if (hasExpiredUpdates) {
      attributes = await prisma.chatAttribute.findMany({
        orderBy: {
          name: 'asc',
        },
      });
    }

    return NextResponse.json(attributes, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
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
    const { id, options, chatbotEnabled, action, optionId, assignedTo, name } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID atribut harus ditentukan' }, { status: 400 });
    }

    const attribute = await prisma.chatAttribute.findUnique({
      where: { id },
    });

    if (!attribute) {
      return NextResponse.json({ error: 'Atribut tidak ditemukan' }, { status: 404 });
    }

    // Handle attribute name edit/renaming
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json({ error: 'Nama atribut tidak boleh kosong' }, { status: 400 });
      }

      const oldName = attribute.name;
      if (trimmedName !== oldName) {
        if (oldName === 'Umum') {
          return NextResponse.json({ error: 'Atribut "Umum" tidak dapat diubah namanya' }, { status: 400 });
        }

        const existing = await prisma.chatAttribute.findFirst({
          where: {
            name: {
              equals: trimmedName,
              mode: 'insensitive',
            },
            id: {
              not: id,
            },
          },
        });
        if (existing) {
          return NextResponse.json({ error: 'Nama atribut tersebut sudah digunakan' }, { status: 400 });
        }

        // Rename across all referencing tables in a transaction
        await prisma.$transaction([
          prisma.chatAttribute.update({
            where: { id },
            data: { name: trimmedName },
          }),
          prisma.chatMessage.updateMany({
            where: { attribute: oldName },
            data: { attribute: trimmedName },
          }),
          prisma.chatAttributeHistory.updateMany({
            where: { attributeName: oldName },
            data: { attributeName: trimmedName },
          }),
        ]);
        
        // Update local reference so subsequent updates in this request use the new name
        attribute.name = trimmedName;
      }
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

        targetOption.status = 'taken';
        targetOption.assignedTo = assignedTo.trim();

        // If it somehow doesn't have start/expiry dates (legacy), set them
        if (!targetOption.startDate || !targetOption.expiryDate) {
          const startDate = new Date();
          const expiryDate = calculateExpiryDate(startDate, targetOption.duration || '1 hari');
          targetOption.startDate = startDate.toISOString();
          targetOption.expiryDate = expiryDate.toISOString();
        }

        // Record Check In / Ambil to history
        await prisma.chatAttributeHistory.create({
          data: {
            attributeId: attribute.id,
            attributeName: attribute.name,
            optionId: targetOption.id,
            optionText: targetOption.text,
            status: 'check-in',
            assignedTo: targetOption.assignedTo,
            startDate: new Date(targetOption.startDate),
            expiryDate: new Date(targetOption.expiryDate),
          }
        });
      } else if (action === 'end') {
        // Record Check Out / Selesai in history
        await prisma.chatAttributeHistory.create({
          data: {
            attributeId: attribute.id,
            attributeName: attribute.name,
            optionId: targetOption.id,
            optionText: targetOption.text,
            status: 'check-out',
            assignedTo: targetOption.assignedTo || 'Karyawan',
            startDate: new Date(targetOption.startDate || new Date()),
            expiryDate: new Date(targetOption.expiryDate || new Date()),
          }
        });

        // Restart countdown immediately
        const newStart = new Date();
        const newExpiry = calculateExpiryDate(newStart, targetOption.duration || '1 hari');

        targetOption.status = 'ready';
        targetOption.assignedTo = null;
        targetOption.startDate = newStart.toISOString();
        targetOption.expiryDate = newExpiry.toISOString();
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

