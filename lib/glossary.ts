import { prisma } from '@/lib/prisma';

// Gelar/jabatan/pangkat umum yang sering salah dikenali mesin suara.
const COMMON_TITLES = [
  'Kapolri', 'Wakapolri', 'Kapolda', 'Wakapolda', 'Kapolres', 'Wakapolres', 'Kapolsek', 'Wakapolsek',
  'Kanit Intelkam', 'Kasat Intelkam', 'Kasi Humas', 'Bhabinkamtibmas', 'Babinsa', 'Danramil', 'Dandim', 'Danrem', 'Pangdam',
  'Komjen Pol.', 'Irjen Pol.', 'Brigjen Pol.', 'Kombes Pol.', 'AKBP', 'Kompol', 'AKP', 'Iptu', 'Ipda',
  'Aiptu', 'Aipda', 'Bripka', 'Brigadir', 'Briptu', 'Bripda',
  'Gubernur', 'Bupati', 'Wali Kota', 'Camat', 'Kepala Desa', 'Lurah',
  'Prof.', 'Dr.', 'Drs.', 'Ir.', 'H.', 'Hj.', 'S.H.', 'S.E.', 'S.Sos.', 'S.I.K.', 'M.H.', 'M.Si.', 'M.M.', 'M.Eng.', 'Ph.D.', '(Purn.)',
];

const MAX_TERMS = 300;

/** Nama, gelar, dan istilah baku: kamus manual + nama kontak karyawan. */
export async function getGlossaryTerms(): Promise<string[]> {
  try {
    const [manual, contacts] = await Promise.all([
      prisma.glossaryTerm.findMany({ orderBy: { createdAt: 'asc' }, select: { term: true } }),
      prisma.employeeContact.findMany({ select: { name: true } }),
    ]);
    const seen = new Set<string>();
    const terms: string[] = [];
    for (const t of [...manual.map((m) => m.term), ...contacts.map((c) => c.name)]) {
      const clean = (t || '').trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        terms.push(clean);
      }
    }
    return terms.slice(0, MAX_TERMS);
  } catch (error) {
    console.error('Gagal memuat kamus nama:', error);
    return [];
  }
}

/** Blok teks siap tempel ke prompt AI. Kosong bila tidak ada kamus. */
export async function getGlossaryPromptBlock(): Promise<string> {
  const terms = await getGlossaryTerms();
  const lines = [
    'PANDUAN EJAAN NAMA, GELAR, DAN ISTILAH (hasil suara sering salah dengar):',
  ];
  if (terms.length > 0) {
    lines.push('Nama/gelar/istilah baku (tulis PERSIS seperti ini jika ada ucapan yang terdengar mirip):');
    for (const t of terms) lines.push(`- ${t}`);
  }
  lines.push(`Gelar & jabatan umum yang lazim muncul: ${COMMON_TITLES.join(', ')}.`);
  lines.push('Jangan menambahkan nama atau gelar yang tidak disebutkan dalam ucapan.');
  return lines.join('\n');
}
