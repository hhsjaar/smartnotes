const main = async () => {
  console.log('=== TESTING ASSISTANT FOR SHOPPING LIST REQUEST ===');
  
  const res = await fetch('http://localhost:3001/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'tolong buatkan list daftar belanjaan buat besok',
      history: []
    })
  });
  
  if (!res.ok) {
    console.error('Request failed:', await res.text());
    process.exit(1);
  }
  
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
};

main().catch(console.error);
