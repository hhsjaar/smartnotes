const path = require('path');
const fs = require('fs');
const https = require('https');

// Native environment variable parser without external dependencies
const loadEnvFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        let val = valParts.join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        const cleanKey = key.trim();
        if (!process.env[cleanKey]) {
          process.env[cleanKey] = val;
        }
      }
    });
  }
};

loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP Status ${response.statusCode}: ${response.statusMessage}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(true));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function main() {
  console.log('🚀 Memulai migrasi foto dari Supabase Storage ke Local VPS Storage...');

  const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Find all ChatMessages with Supabase storage URLs
  const messages = await prisma.chatMessage.findMany({
    where: {
      imageUrl: {
        contains: 'supabase.co'
      }
    }
  });

  console.log(`📋 Ditemukan ${messages.length} foto di Supabase Storage yang akan dipindahkan ke VPS.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const oldUrl = msg.imageUrl;

    try {
      const urlParts = oldUrl.split('/');
      const rawFileName = urlParts[urlParts.length - 1] || `legacy-${Date.now()}.jpg`;
      const fileName = rawFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const localFilePath = path.join(uploadDir, fileName);
      const newUrl = `/api/uploads/${fileName}`;

      console.log(`[${i + 1}/${messages.length}] Mengunduh: ${fileName}...`);
      await downloadFile(oldUrl, localFilePath);

      // Update Database
      await prisma.chatMessage.update({
        where: { id: msg.id },
        data: { imageUrl: newUrl }
      });

      console.log(`   ✅ Sukses! URL DB diperbarui ke: ${newUrl}`);
      successCount++;
    } catch (err) {
      console.error(`   ❌ Gagal mengunduh foto ID ${msg.id}: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log(`🎉 Migrasi Selesai!`);
  console.log(`✅ Berhasil dipindahkan ke VPS: ${successCount} foto`);
  console.log(`❌ Gagal (Storage Supabase masih terkunci): ${failCount} foto`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Error during migration:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
