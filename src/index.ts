const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { stringify } = require('csv-stringify/sync');

// Type-only imports (no runtime impact)
import type { BankProfile, Transaction } from './types';

// Runtime import for profiles
const { profiles, detectProfile } = require('./profiles');

// --- CONFIGURATION ---
const DEFAULT_OUTPUT_DIR = 'output';
const DEFAULT_OUTPUT_SUFFIX = '_sestercefiscus';

// --- MAIN FUNCTION ---
async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Usage: node dist/index.js <path/to/statement.pdf> [--output-dir <dir>] [--suffix <suffix>]');
    process.exit(1);
  }

  // Extract PDF path and optional args
  const pdfPath = args[0];
  let outputDir = DEFAULT_OUTPUT_DIR;
  let outputSuffix = DEFAULT_OUTPUT_SUFFIX;

  // Parse optional arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--suffix' && args[i + 1]) {
      outputSuffix = args[i + 1];
      i++;
    }
  }

  // 1. Check if PDF file exists
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ File not found: ${pdfPath}`);
    process.exit(1);
  }

  // 2. Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created directory: ${outputDir}/`);
  }

  // 3. Extract text from PDF
  const text = await extractTextFromPDF(pdfPath);

  // 4. Detect bank profile
  const profile: BankProfile = detectProfile(text);
  console.log(`🏦 Detected bank profile: ${profile.name}`);

  // 5. Parse transactions using the detected profile
  const transactions: Transaction[] = profile.parseTransactions(text);

  if (transactions.length === 0) {
    console.error('❌ No transactions found. The PDF format may not be supported yet.');
    process.exit(1);
  }

  // 6. Generate CSV filename
  const pdfBasename = path.basename(pdfPath, path.extname(pdfPath));
  const csvFilename = `${pdfBasename}${outputSuffix}.csv`;
  const outputPath = path.join(outputDir, csvFilename);

  // 7. Generate CSV
  const csv = generateSesterceCSV(transactions, profile);

  // 8. Save CSV
  fs.writeFileSync(outputPath, csv);
  console.log(`✅ CSV generated: ${outputPath}`);
  console.log(`   → Open ${outputPath} in Excel to remove unwanted rows.`);
  console.log(`   → Import it at https://app.sesterce.io/import`);
}

// --- EXTRACT TEXT FROM PDF ---
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);
  return data.text;
}

// --- GENERATE SESTERCE-COMPATIBLE CSV ---
function generateSesterceCSV(transactions: Transaction[], profile?: BankProfile): string {
  const csvData = transactions.map((t: Transaction) => ({
    Date: t.date,
    Title: t.description,
    'Paid by You': Math.abs(t.amount),
    'Paid for You': 0,
    Currency: 'EUR',
  }));

  return stringify(csvData, { header: true, delimiter: ',' });
}

// --- EXECUTION ---
main().catch((err) => console.error('❌ Error:', err.message));
