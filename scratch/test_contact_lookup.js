const main = async () => {
  console.log('=== VERIFIKASI PENCARIAN NAMA KONTAK WHATSAPP ===');
  
  const mockContacts = [
    { name: 'Budi', number: '6281234567890' },
    { name: 'Siti', number: '6289999999999' }
  ];

  // Test 1: Direct WhatsApp send by contact name "Budi"
  console.log('\n[TEST 1] Mengirim perintah langsung: "Kirim WA ke Budi berisi besok rapat jam 9"...');
  const res1 = await fetch('http://localhost:3000/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'Kirim WA ke Budi berisi besok rapat jam 9',
      history: [],
      contacts: mockContacts
    })
  });
  
  if (!res1.ok) {
    console.error('FAIL: Request 1 gagal:', await res1.text());
    process.exit(1);
  }
  
  const data1 = await res1.json();
  console.log('Respons 1:', JSON.stringify(data1, null, 2));
  
  if (data1.action !== 'SEND_WHATSAPP' || data1.payload.recipient !== '6281234567890') {
    console.error('FAIL: Gagal memetakan nama "Budi" ke nomor Budi.');
    process.exit(1);
  }
  console.log('PASS: Berhasil mencocokkan nama "Budi" ke nomor telepon 6281234567890.');

  // Test 2: Scheduled WhatsApp send by contact name "Siti"
  console.log('\n[TEST 2] Mengirim perintah penjadwalan: "Jadwalkan kirim WA ke Siti besok jam 8 pagi dengan pesan halo"...');
  const res2 = await fetch('http://localhost:3000/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'Jadwalkan kirim WA ke Siti besok jam 8 pagi dengan pesan halo',
      history: [],
      contacts: mockContacts
    })
  });
  
  if (!res2.ok) {
    console.error('FAIL: Request 2 gagal:', await res2.text());
    process.exit(1);
  }
  
  const data2 = await res2.json();
  console.log('Respons 2:', JSON.stringify(data2, null, 2));
  
  if (data2.action !== 'ASK_CONFIRMATION' || data2.payload.payload.recipient !== '6289999999999') {
    console.error('FAIL: Gagal memetakan nama "Siti" ke nomor Siti dalam penjadwalan.');
    process.exit(1);
  }
  console.log('PASS: Berhasil mencocokkan nama "Siti" ke nomor telepon 6289999999999 dalam penjadwalan.');
  
  console.log('\n======================================================');
  console.log('VERIFIKASI SUKSES: Pencarian kontak oleh Asisten Suara AI berjalan sempurna!');
};

main().catch(console.error);
