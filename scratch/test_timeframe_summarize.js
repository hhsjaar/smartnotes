const main = async () => {
  console.log('=== VERIFIKASI ASISTEN SUARA: RANGKUMAN FOLDER & FILTER WAKTU ===');
  
  const command = 'rangkumkan catatan saya di folder SOP selama 7 hari';
  console.log(`\nMengirim perintah: "${command}"`);
  
  const res = await fetch('http://localhost:3000/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: command,
      history: [],
      contacts: [],
      selectedNote: null
    })
  });
  
  if (!res.ok) {
    console.error('FAIL: Request gagal:', await res.text());
    process.exit(1);
  }
  
  const data = await res.json();
  console.log('Respons:', JSON.stringify(data, null, 2));
  
  if (data.action !== 'SUMMARIZE_FOLDER') {
    console.error('FAIL: Aksi tidak sesuai. Diharapkan "SUMMARIZE_FOLDER", didapat:', data.action);
    process.exit(1);
  }
  
  const payload = data.payload;
  console.log('\nPayload Detail:');
  console.log(`- folderName: ${payload.folderName}`);
  console.log(`- timeframeDays: ${payload.timeframeDays}`);
  console.log(`- summary: ${payload.summary}`);
  console.log(`- notesSummarized: ${JSON.stringify(payload.notesSummarized)}`);

  if (!payload.folderName || payload.timeframeDays !== 7 || !payload.summary) {
    console.error('FAIL: Parameter payload tidak valid/tidak lengkap.');
    process.exit(1);
  }
  
  console.log('\n======================================================');
  console.log('VERIFIKASI SUKSES: Fitur Rangkuman Folder & Filter Waktu Asisten berjalan sempurna!');
};

main().catch(console.error);
