function mergeTranscripts(accumulated, current) {
  const accClean = accumulated.trim();
  const currClean = current.trim();
  
  if (!accClean) return currClean;
  if (!currClean) return accClean;

  const accWords = accClean.split(/\s+/);
  const currWords = currClean.split(/\s+/);

  const maxOverlap = Math.min(accWords.length, currWords.length);
  let overlapLength = 0;

  for (let len = 1; len <= maxOverlap; len++) {
    let match = true;
    for (let i = 0; i < len; i++) {
      const accWord = accWords[accWords.length - len + i].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      const currWord = currWords[i].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      if (accWord !== currWord) {
        match = false;
        break;
      }
    }
    if (match) {
      overlapLength = len;
    }
  }

  if (overlapLength > 0) {
    const nonOverlapping = currWords.slice(overlapLength).join(' ');
    return nonOverlapping ? `${accClean} ${nonOverlapping}` : accClean;
  }

  return `${accClean} ${currClean}`;
}

// Test cases
console.log("Test 1 ('Oke', 'Oke jadi'):", mergeTranscripts("Oke", "Oke jadi"));
console.log("Test 2 ('Oke jadi', 'Oke jadi yang'):", mergeTranscripts("Oke jadi", "Oke jadi yang"));

// Simulation of onresult loop
let finalTranscript = "";
const results = ["Oke", "Oke jadi", "Oke jadi yang", "Oke jadi yang Perlu"];
for (let i = 0; i < results.length; i++) {
  finalTranscript = mergeTranscripts(finalTranscript, results[i]);
  console.log(`Step ${i} (input: "${results[i]}"): "${finalTranscript}"`);
}
