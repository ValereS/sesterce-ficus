// src/index.ts
import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';
import { loadConfig } from './config';
import { banquePostaleProfile } from './profiles/banque-postale';
import type { GroupConfig, Transaction } from './types';

const DEFAULT_OUTPUT_DIR = 'output';
const DEFAULT_OUTPUT_SUFFIX = '_sestercfiscus';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Usage: node dist/index.js <path/to/statement.pdf>');
    process.exit(1);
  }

  const pdfPath = args[0];
  let outputDir = DEFAULT_OUTPUT_DIR;
  let outputSuffix = DEFAULT_OUTPUT_SUFFIX;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--suffix' && args[i + 1]) {
      outputSuffix = args[i + 1];
      i++;
    }
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ File not found: ${pdfPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created directory: ${outputDir}/`);
  }

  const text = await extractTextFromPDF(pdfPath);
  const profile = banquePostaleProfile;
  console.log(`🏦 Detected bank profile: ${profile.name}`);

  const { group } = loadConfig();
  console.log(`👥 Group Members: ${group.members.join(', ')}`);
  console.log(`💰 Default Payer: ${group.defaultPayer}`);
  console.log(`📊 Split Ratios:`, group.splitRatios);

  const transactions = profile.parseTransactions(text);
  if (transactions.length === 0) {
    console.error('❌ No transactions found.');
    process.exit(1);
  }

  const pdfBasename = path.basename(pdfPath, path.extname(pdfPath));
  const csvFilename = `${pdfBasename}${outputSuffix}.csv`;
  const outputPath = path.join(outputDir, csvFilename);

  const csv = generateSesterceCSV(transactions, group, profile.name);
  fs.writeFileSync(outputPath, csv);

  console.log(`✅ CSV generated: ${outputPath}`);
}

async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);
  return data.text;
}

function generateSesterceCSV(transactions: Transaction[], group: GroupConfig, profileName?: string): string {
  const { members, defaultPayer, splitRatios, currency, defaultCategory, defaultComment, defaultTags, dateFormat } = group;

  // Add "BqPt" to comment if this is Banque Postale
  const comment = profileName === 'Banque Postale' ? `${defaultComment} BqPt`.trim() : defaultComment;

  // Calculate total ratio for splits
  const totalRatio = Object.values(splitRatios).reduce((sum, ratio) => sum + ratio, 0);

  // Define column order
  const columnOrder = [
    'Date', 'Title',
    ...members.map(m => `Paid by ${m}`),
    ...members.map(m => `Paid for ${m}`),
    'Currency', 'Category', 'Exchange Rate', 'Comment', 'Tags'
  ];

  const csvData = transactions.map((t) => {
    const row: Record<string, string> = {
      Date: dateFormat === 'YYYYMMDD' ? t.date.replace(/\//g, '') : t.date,
      Title: t.description,
      Currency: currency,
      Category: defaultCategory,
      'Exchange Rate': '1.00',
      Comment: comment,  // ✅ Uses modified comment with "BqPt"
      Tags: defaultTags,
    };

    // Paid by: Only defaultPayer gets the full amount
    members.forEach(member => {
      row[`Paid by ${member}`] = member === defaultPayer ? Math.abs(t.amount).toFixed(2) : '0.00';
    });

    // Paid for: Apply split ratios from config
    members.forEach(member => {
      const ratio = splitRatios[member] || 0;
      if (ratio > 0 && totalRatio > 0) {
        const amountForMember = (Math.abs(t.amount) * ratio) / totalRatio;
        row[`Paid for ${member}`] = amountForMember.toFixed(2);
      } else {
        row[`Paid for ${member}`] = '0.00';
      }
    });

    return columnOrder.map(col => row[col]);
  });

  return [
    columnOrder.join(';'),
    ...csvData.map(row => row.join(';'))
  ].join('\n');
}

main().catch((err) => console.error('❌ Error:', err.message));
