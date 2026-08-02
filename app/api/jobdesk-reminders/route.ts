import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Fetch all jobdesk reminders
export async function GET() {
  try {
    const reminders = await prisma.jobdeskReminder.findMany({
      orderBy: { created_at: 'desc' },
    });
    return NextResponse.json(reminders);
  } catch (error) {
    console.error('Failed to fetch jobdesk reminders:', error);
    return NextResponse.json({ error: 'Failed to fetch jobdesk reminders' }, { status: 500 });
  }
}

// Create a new jobdesk reminder
export async function POST(request: Request) {
  try {
    const { title, description, intervalMinutes, whatsappNumber, employeeNames } = await request.json();
    if (!title || !intervalMinutes) {
      return NextResponse.json({ error: 'Title and interval minutes are required' }, { status: 400 });
    }

    const reminder = await prisma.jobdeskReminder.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        intervalMinutes: parseInt(intervalMinutes, 10),
        whatsappNumber: whatsappNumber || null,
        employeeNames: employeeNames || null,
        lastRun: new Date(Date.now() - parseInt(intervalMinutes, 10) * 60 * 1000), // Set to past so it runs immediately on next cron
      },
    });

    return NextResponse.json(reminder);
  } catch (error) {
    console.error('Failed to create jobdesk reminder:', error);
    return NextResponse.json({ error: 'Failed to create jobdesk reminder' }, { status: 500 });
  }
}

// Delete a jobdesk reminder
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Reminder ID is required' }, { status: 400 });
    }

    await prisma.jobdeskReminder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete jobdesk reminder:', error);
    return NextResponse.json({ error: 'Failed to delete jobdesk reminder' }, { status: 500 });
  }
}
