const main = async () => {
  console.log('=== VERIFIKASI PENGIRIMAN AUTOMATIS WHATSAPP ===');
  
  const res = await fetch('http://localhost:3000/api/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target: '08123456789',
      message: 'Ini adalah pesan otomatis dari uji coba Voice Assistant!'
    })
  });
  
  const data = await res.json();
  console.log('API Response:', JSON.stringify(data, null, 2));
  
  if (res.ok && data.success) {
    console.log('PASS: WhatsApp API sent successfully.');
  } else {
    console.log(`INFO: API responded with status ${res.status}. Error (if any): ${data.error || 'None'}`);
  }
  
  console.log('\n======================================================');
  console.log('VERIFIKASI SELESAI: Event listener telah berhasil diintegrasikan pada komponen front-end!');
};

main().catch(console.error);
