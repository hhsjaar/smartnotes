const main = async () => {
  console.log('=== UJI COBA ASISTEN SUARA: ABSENSI BULAN JULI ===');
  
  const payload = {
    command: 'berapa kali ragil masuk bulan juli',
    history: []
  };

  console.log('Mengirim payload ke /api/assistant:', JSON.stringify(payload, null, 2));

  try {
    const res = await fetch('http://localhost:3000/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      console.error('Gagal memanggil API assistant:', res.status, await res.text());
      process.exit(1);
    }
    
    const data = await res.json();
    console.log('\nRespons AI:', JSON.stringify(data, null, 2));
    console.log('\n=== UJI COBA SELESAI ===');
  } catch (error) {
    console.error('Error saat melakukan test:', error);
  }
};

main().catch(console.error);
