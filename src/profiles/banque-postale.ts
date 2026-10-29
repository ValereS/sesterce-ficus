// src/profiles/banquePostale.ts
import type { BankProfile, Transaction } from '../types';

// Enable this to see debugging info
const DEBUG = false;

export const banquePostaleProfile: BankProfile = {
  name: 'Banque Postale',
  detectionRegex: /Compte Courant Postal|Banque Postale|IBAN : FL/i,

  parseTransactions: (text: string): Transaction[] => {
    // 🧹 Clean up: Remove ONLY the 3-digit number after "CARTE NUMERO"
    const cleanedText = text
      .replace(/CARTE (?:NUMERO|NO|N°)[\s:]*\d{3}/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (DEBUG) console.log('=== CLEANED TEXT ===');
    if (DEBUG) console.log(cleanedText);
    if (DEBUG) console.log('=== END CLEANED TEXT ===\n');

    // --- FIND START AND END MARKERS ---
    // Start marker: "Ancien solde au DD/MM/YYYY AMOUNT" (e.g., "Ancien solde au 24/07/2026 3 815,74")
    const startMarkerRegex = /Ancien solde au (\d{2}\/\d{2}\/\d{4}) (\d{1,3}(?: \d{3})*?,\d{2})/;
    const startMatch = cleanedText.match(startMarkerRegex);

    let transactionText = '';
    if (startMatch) {
      // Find everything AFTER the start marker
      const startIndex = startMatch.index! + startMatch[0].length;
      transactionText = cleanedText.substring(startIndex);

      if (DEBUG) console.log(`🏁 Start marker found: "${startMatch[0]}"`);
      if (DEBUG) console.log(`Transaction text starts at index ${startIndex}`);
    } else {
      if (DEBUG) console.log('⚠️ No start marker found - using entire text');
      transactionText = cleanedText;
    }

   // End marker: "Total des" (more robust than "Total des opérations")
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
      .reduce((acc: string[][], part, index) => {
        if (part.match(/^\d{2}\/\d{2}$/)) {
          acc.push([part]);
        } else {
          if (acc.length > 0) {
            acc[acc.length - 1].push(part);
          }
        }
        return acc;
      }, []);

    for (const block of blocks) {
      if (block.length === 0) continue;

      // First part is always the date (DD/MM)
      const date = block[0];

      // Join the rest as the content
      const content = block.slice(1).join(' ');

      // Extract payment date (DD.MM.YY) if present
      let paymentDate: string | null = null;
      const paymentDateMatch = content.match(/(\d{2}\.\d{2}\.\d{2})/);
      if (paymentDateMatch) {
        paymentDate = paymentDateMatch[1];
      }

      // Extract amount (last number with 2 decimals, handling spaces)
      const amountMatches = content.match(/(\d{1,3}(?: \d{3})*?,\d{2})/g) || [];
      if (amountMatches.length === 0) {
        if (DEBUG) console.log(`❌ No amount found in block: ${content}`);
        continue;
      }

      // Use the last amount match
      const lastAmountMatch = amountMatches[amountMatches.length - 1];
      const amountStr = lastAmountMatch.replace(/ /g, '').replace(',', '.');
      const amount = parseFloat(amountStr);

      // Extract description (remove date, payment date, and amount)
      let description = content
        .replace(paymentDate || '', '')
        .replace(lastAmountMatch, '')
        .replace(date, '')
        .trim();

      // Clean description
      description = description
        .replace(/REFERENCE\s*:.*$/i, '')
        .replace(/MANDAT\s*:.*$/i, '')
        .replace(/IDENT\s*:.*$/i, '')
        .replace(/\b[A-Za-z]+\d{5,}\b/g, '')
        .replace(/\b\d{10,}\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Format date
      let finalDate = date;
      if (paymentDate) {
        const [day, month, year] = paymentDate.split('.');
        finalDate = `${day}/${month}/20${year}`;
      } else if (finalDate.match(/^\d{2}\/\d{2}$/)) {
        finalDate = `${finalDate}/2026`;
      }

      if (DEBUG) console.log(`✅ Transaction: date=${finalDate}, desc="${description}", amount=${amount}`);

      transactions.push({
        date: finalDate,
        description: description,
        amount: amount,
        isCredit: false,
      });
    }

    if (DEBUG) {
      console.log('\n=== FINAL TRANSACTIONS ===');
      console.log(transactions);
      console.log('=== END ===\n');
    }

    return transactions;
  },
};
