// src/profiles/banquePostale.ts
import type { BankProfile, Transaction } from '../types';

// Enable this to see debugging info
const DEBUG = false;

// 🏷 TRANSACTION TYPE DETECTION (Debit/Credit based on keywords)
const determineTransactionType = (description: string): boolean => {
  const debitKeywords = ['ACHAT CB', 'PRELEVEMENT', 'RETRAIT', 'FRAIS', 'COTISATION', 'PAIEMENT', 'CARTE'];
  const creditKeywords = ['VIREMENT', 'SALAIRE', 'REMBOURSEMENT', 'VERSEMENT', 'CREDIT'];

  const upperDesc = description.toUpperCase();

  for (const keyword of debitKeywords) {
    if (upperDesc.includes(keyword.toUpperCase())) return false; // DEBIT
  }
  for (const keyword of creditKeywords) {
    if (upperDesc.includes(keyword.toUpperCase())) return true; // CREDIT
  }
  return false; // Default to debit
};

// 🧹 CLEAN DESCRIPTION: Trim "ACHAT CB " and other noise
const cleanDescription = (text: string): string => {
  return text
    .replace(/ACHAT CB /g, '')  // ✅ Trim "ACHAT CB " from descriptions
    .replace(/REFERENCE\s*:.*$/i, '')
    .replace(/MANDAT\s*:.*$/i, '')
    .replace(/IDENT\s*:.*$/i, '')
    .replace(/\b[A-Za-z]+\d{5,}\b/g, '')
    .replace(/\b\d{10,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// 💰 EXTRACT AMOUNT: Helper function
const extractAmount = (text: string): number | null => {
  // Match numbers with 2 decimal places (e.g., "74,00" or "1 200,00")
  const amountMatches = text.match(/(\d{1,3}(?: \d{3})*?,\d{2})/g) || [];
  if (amountMatches.length === 0) return null;

  // Use the last match
  const lastAmountMatch = amountMatches[amountMatches.length - 1];
  const amountStr = lastAmountMatch.replace(/ /g, '').replace(',', '.');
  return parseFloat(amountStr);
};

export const banquePostaleProfile: BankProfile = {
  name: 'Banque Postale',
  detectionRegex: /Compte Courant Postal|Banque Postale|IBAN : FL/i,

  parseTransactions: (text: string, groupConfig?: {
    members: string[];
    defaultPayer: string;
    splitRatios: Record<string, number>;
  }): Transaction[] => {
    // 🧹 Clean up: Remove ONLY the 3-digit number after "CARTE NUMERO"
    const cleanedText = text
      .replace(/CARTE (?:NUMERO|NO|N°)[\s:]*\d{3}/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (DEBUG) console.log('=== CLEANED TEXT ===');
    if (DEBUG) console.log(cleanedText);
    if (DEBUG) console.log('=== END CLEANED TEXT ===\n');

    // --- FIND START AND END MARKERS ---
    const startMarkerRegex = /Ancien solde au (\d{2}\/\d{2}\/\d{4}) (\d{1,3}(?: \d{3})*?,\d{2})/;
    const startMatch = cleanedText.match(startMarkerRegex);

    let transactionText = '';
    if (startMatch) {
      const startIndex = startMatch.index! + startMatch[0].length;
      transactionText = cleanedText.substring(startIndex);
      if (DEBUG) console.log(`🏁 Start marker found: "${startMatch[0]}"`);
    } else {
      if (DEBUG) console.log('⚠️ No start marker found - using entire text');
      transactionText = cleanedText;
    }

    // End marker: "Total des"
    const endMarkerIndex = transactionText.search(/Total des/i);
    if (endMarkerIndex !== -1) {
      transactionText = transactionText.substring(0, endMarkerIndex);
      if (DEBUG) console.log(`🛑 End marker found at index ${endMarkerIndex}`);
    } else {
      if (DEBUG) console.log('⚠️ No end marker found - using text until end');
    }

    if (DEBUG) console.log('=== TRANSACTION TEXT ===');
    if (DEBUG) console.log(transactionText);
    if (DEBUG) console.log('=== END TRANSACTION TEXT ===\n');

    // --- PROCESS TRANSACTIONS ---
    const transactions: Transaction[] = [];

    // Split into transaction blocks using DD/MM as delimiter
    const blocks = transactionText.split(/(\d{2}\/\d{2})/g)
      .filter(part => part.trim() !== '')
      .reduce((acc: string[][], part) => {
        if (part.match(/^\d{2}\/\d{2}$/)) {
          acc.push([part]);
        } else if (acc.length > 0) {
          acc[acc.length - 1].push(part);
        }
        return acc;
      }, [] as string[][]);

    for (const block of blocks) {
      if (block.length === 0) continue;

      const date = block[0];
      const content = block.slice(1).join(' ');

      // Extract payment date (DD.MM.YY)
      let paymentDate: string | null = null;
      const paymentDateMatch = content.match(/(\d{2}\.\d{2}\.\d{2})/);
      if (paymentDateMatch) {
        paymentDate = paymentDateMatch[1];
      }

      // Extract amount
      const amount = extractAmount(content);
      if (amount === null) {
        if (DEBUG) console.log(`❌ No amount found in block: ${content}`);
        continue;
      }

      // Remove amount from description (e.g., "AVIA 1,20" → "AVIA")
      const amountStr = amount.toFixed(2).replace('.', ',');
      let description = content
        .replace(paymentDate || '', '')
        .replace(amountStr, '')
        .replace(date, '')
        .trim();
      description = cleanDescription(description);

      // Format date
      let finalDate = date;
      if (paymentDate) {
        const [day, month, year] = paymentDate.split('.');
        finalDate = `${day}/${month}/20${year}`;
      } else if (finalDate.match(/^\d{2}\/\d{2}$/)) {
        finalDate = `${finalDate}/2026`;
      }

      // Determine if credit or debit
      const isCredit = determineTransactionType(description);

      if (DEBUG) console.log(`✅ Transaction: date=${finalDate}, desc="${description}", amount=${amount}, isCredit=${isCredit}`);

      transactions.push({
        date: finalDate,
        description: description,
        amount: isCredit ? amount : -amount,  // Negative for debit
        isCredit: isCredit,
      });
    }

    if (DEBUG) {
      console.log('\n=== FINAL TRANSACTIONS ===');
      console.log(transactions);
      console.log('=== END ===\n');
    }

    return transactions;
  }
};
