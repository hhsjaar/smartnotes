import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { target, message } = await request.json();

    if (!target || !message) {
      return NextResponse.json(
        { error: 'Target nomor telepon dan isi pesan wajib diisi.' },
        { status: 400 }
      );
    }

    const token = process.env.FONNTE_API_TOKEN;
    if (!token) {
      console.error('FONNTE_API_TOKEN is not configured in environment variables.');
      return NextResponse.json(
        { error: 'Konfigurasi Fonnte API Token belum diset di server.' },
        { status: 500 }
      );
    }

    // Clean up the target number (remove anything except digits, e.g. spaces, dashes, + sign)
    let cleanedTarget = target.replace(/[^0-9]/g, '');

    // Fonnte accepts targets with or without country code. We pass countryCode = '62' by default
    // to handle numbers starting with 0 (e.g. 0812... -> 62812...)
    const formData = new FormData();
    formData.append('target', cleanedTarget);
    formData.append('message', message);
    formData.append('countryCode', '62');

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
      },
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || !data.status) {
      console.error('Fonnte API Error response:', data);
      return NextResponse.json(
        { 
          error: data.reason || 'Gagal mengirim pesan melalui Fonnte API.',
          details: data 
        },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pesan WhatsApp berhasil dikirim!',
      data: data,
    });
  } catch (error: any) {
    console.error('Error in whatsapp api route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
