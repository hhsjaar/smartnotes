import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();
    const serverPasscode = process.env.ADMIN_PASSCODE || 'admin123';

    if (passcode === serverPasscode) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Passcode Admin salah!' }, { status: 401 });
    }
  } catch (error: any) {
    console.error('Error during passcode verification:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
