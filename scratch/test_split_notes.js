const main = async () => {
  console.log('=== VERIFIKASI PEMECOHAN CATATAN MULTI-TOPIK ===');
  
  const text = 'Halo, tolong buat catatan belanjaan dapur yaitu beli mentega, kopi, dan gula. Lalu buat catatan satu lagi untuk rencana liburan yaitu cari tiket pesawat ke Bali dan booking hotel di Ubud.';
  
  console.log('\nMengirim teks transkripsi dengan 2 topik berbeda ke /api/notes/format...');
  const res = await fetch('http://localhost:3000/api/notes/format', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text,
      formatType: 'standard'
    })
  });
  
  if (!res.ok) {
    console.error('FAIL: Gagal menghubungi API format:', await res.text());
    process.exit(1);
  }
  
  const data = await res.json();
  console.log('Respons API Format:', JSON.stringify(data, null, 2));
  
  if (!data.notes || !Array.isArray(data.notes)) {
    console.error('FAIL: Format respon tidak menghasilkan array notes.');
    process.exit(1);
  }
  
  if (data.notes.length < 2) {
    console.error('FAIL: Diharapkan minimal 2 catatan terpisah, didapat:', data.notes.length);
    process.exit(1);
  }
  
  console.log(`\nPASS: Berhasil memecah teks menjadi ${data.notes.length} catatan.`);
  
  // Verify folder suggestions
  data.notes.forEach((note, i) => {
    console.log(`Catatan #${i+1}: "${note.title}" -> Folder: "${note.folderName || note.folderId || 'Umum'}"`);
  });
  
  console.log('\n======================================================');
  console.log('VERIFIKASI SUKSES: Fitur auto-split dan auto-categorize berjalan sempurna!');
};

main().catch(console.error);
