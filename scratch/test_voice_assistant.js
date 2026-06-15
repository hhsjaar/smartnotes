const main = async () => {
  console.log('=== VERIFIKASI ASISTEN SUARA: MULTI-TURN & KONFIRMASI ===');
  
  // Test 1: Minta untuk menjadwalkan pekerjaan baru
  console.log('\n[TEST 1] Mengirim perintah penjadwalan WhatsApp...');
  const res1 = await fetch('http://localhost:3000/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'Jadwalkan kirim WA ke nomor 08123456789 besok jam 9 pagi dengan pesan halo apa kabar',
      history: []
    })
  });
  
  if (!res1.ok) {
    console.error('FAIL: Request 1 gagal:', await res1.text());
    process.exit(1);
  }
  
  const data1 = await res1.json();
  console.log('Respons 1:', JSON.stringify(data1, null, 2));
  
  if (data1.action !== 'ASK_CONFIRMATION') {
    console.error('FAIL: Aksi tidak sesuai. Diharapkan "ASK_CONFIRMATION", didapat:', data1.action);
    process.exit(1);
  }
  console.log('PASS: Berhasil meminta konfirmasi (ASK_CONFIRMATION).');

  // Test 2: Kirim konfirmasi persetujuan "Ya, konfirmasi" beserta pendingAction
  console.log('\n[TEST 2] Mengirim perintah konfirmasi "Ya, konfirmasi"...');
  const res2 = await fetch('http://localhost:3000/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'Ya, konfirmasi',
      history: [
        { role: 'user', text: 'Jadwalkan kirim WA ke nomor 08123456789 besok jam 9 pagi dengan pesan halo apa kabar' },
        { role: 'model', text: data1.response }
      ],
      pendingAction: data1.payload
    })
  });
  
  if (!res2.ok) {
    console.error('FAIL: Request 2 gagal:', await res2.text());
    process.exit(1);
  }
  
  const data2 = await res2.json();
  console.log('Respons 2:', JSON.stringify(data2, null, 2));
  
  if (data2.action !== 'CONFIRM_JOB') {
    console.error('FAIL: Aksi tidak sesuai. Diharapkan "CONFIRM_JOB", didapat:', data2.action);
    process.exit(1);
  }
  console.log('PASS: Berhasil mengonfirmasi pekerjaan (CONFIRM_JOB).');
  
  console.log('\n======================================================');
  console.log('VERIFIKASI SUKSES: Alur Asisten Suara Multi-Turn & Konfirmasi berjalan sempurna!');
};

main().catch(console.error);
