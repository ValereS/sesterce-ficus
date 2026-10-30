#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { stringify } = require('csv-stringify/sync');

// Type-only imports
import type { BankProfile, Transaction, GroupConfig } from './types';

// Runtime imports
const { profiles, detectProfile } = require('./profiles');
const { loadConfig, formatDate } = require('./config');

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

  // Parse CLI arguments (future: add --group <name>)
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
  const profile: BankProfile = detectProfile(text);
  console.log(`🏦 Detected bank profile: ${profile.name}`);

  const { group } = loadConfig();
  console.log(`👥 Group: ${group.members.join(', ')} (Payer: ${group.defaultPayer})`);
  console.log(`💰 Split ratios: ${JSON.stringify(group.splitRatios)}`);

  const transactions = profile.parseTransactions(text);
  if (transactions.length === 0) {
    console.error('❌ No transactions found.');
    process.exit(1);
  }

  const pdfBasename = path.basename(pdfPath, path.extname(pdfPath));
  const csvFilename = `${pdfBasename}${outputSuffix}.csv`;
  const outputPath = path.join(outputDir, csvFilename);

  const csv = generateSesterceCSV(transactions, group);
  fs.writeFileSync(outputPath, csv);
  console.log(`✅ CSV generated: ${outputPath}`);
  console.log(`   → Open in Excel to review and import to Sesterce.`);
}

async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);
  return data.text;
}

function generateSesterceCSV(
  transactions: Transaction[],
  group: GroupConfig
): string {
  const { members, defaultPayer, splitRatios, currency, defaultCategory, defaultComment, defaultTags, dateFormat } = group;

  // Calculate total ratio for splits
  const totalRatio = Object.values(splitRatios).reduce((sum, ratio) => sum + ratio, 0);

  // Define the EXACT column order you want
  const columnOrder = [
    'Date', 'Title',
    ...members.map(m => `Paid by ${m}`),
    ...members.map(m => `Paid for ${m}`),
    'Currency', 'Category', 'Exchange Rate', 'Comment', 'Tags'
  ];

  const csvData = transactions.map((t) => {
    const row: Record<string, string | number> = {
      Date: dateFormat === 'YYYYMMDD' ? t.date.replace(/\//g, '') : t.date,
      Title: t.description,
      Currency: currency,
      Category: defaultCategory,
      'Exchange Rate': 1,
      Comment: defaultComment,
      Tags: defaultTags,
    };

    // Paid by columns: Only defaultPayer pays the full amount
    members.forEach(member => {
      row[`Paid by ${member}`] = member === defaultPayer ? Math.abs(t.amount) : 0;
    });

    // Paid for columns: Split amount according to ratios
    members.forEach(member => {
      const ratio = splitRatios[member] || 0;
      const amountForMember = (Math.abs(t.amount) * ratio) / totalRatio;
      row[`Paid for ${member}`] = amountForMember;
    });

    // Create array in the exact column order
    const orderedRow = columnOrder.map(col => row[col]);
    return orderedRow;
  });

  // Generate CSV with headers in the exact order
  return [
    columnOrder.join(';'),  // Header row
    ...csvData.map(row => row.join(';'))  // Data rows
  ].join('\n');
}

main().catch((err) => console.error('❌ Error:', err.message));
