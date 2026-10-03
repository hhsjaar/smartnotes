import { NextResponse } from 'next/server';
import { createAdminToken, getAdminPasscode } from '@/lib/adminAuth';

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();
    const serverPasscode = getAdminPasscode();

    if (passcode === serverPasscode) {
      return NextResponse.json({ success: true, token: createAdminToken() });
    } else {
      return NextResponse.json({ success: false, error: 'Passcode Admin salah!' }, { status: 401 });
    }
  } catch (error: any) {
    console.error('Error during passcode verification:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
