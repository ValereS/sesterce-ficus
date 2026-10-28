// src/profiles/banquePostale.ts
import type { BankProfile, Transaction } from '../types';

export const banquePostaleProfile: BankProfile = {
  name: 'Banque Postale',
  detectionRegex: /Compte Courant Postal|Banque Postale|IBAN : FL/i,

  parseTransactions: (text: string): Transaction[] => {
    const transactions: Transaction[] = [];
    const lines = text.split('\n');

    // Helper: Convert DD.MM.YY to DD/MM/YYYY
    const convertPaymentDate = (dateStr: string): string => {
      const [day, month, year] = dateStr.split('.');
      return `${day}/${month}/20${year}`; // Assume 20XX
    };

    // Helper: Check if line is a header (skip these)
    const isHeaderLine = (line: string): boolean => {
      const trimmed = line.trim();
      return (
        trimmed.includes('Compte Courant Postal') ||
        trimmed.includes('IBAN :') ||
        trimmed.includes('BIC :') ||
        trimmed.includes('Date Opérations') ||
        trimmed.includes('Relevé n°') ||
        trimmed.includes('Page') ||
        trimmed.includes('Vos opérations') ||
        trimmed === '' ||
        /^\d+$/.test(trimmed) // Skip page numbers like "2/4"
      );
    };

    let currentDate = '';
    let currentDescription = '';
    let currentAmount: number | null = null;
    let currentPaymentDate: string | null = null;

    for (const line of lines) {
      if (isHeaderLine(line)) continue;

      // --- CASE 1: Line starts with a date (DD/MM or DD/MM/YYYY) ---
      const dateMatch = line.match(/^\s*(\d{2}\/\d{2}(?:\/\d{4})?)\s*(.*)/);
      if (dateMatch) {
        // Save previous transaction if exists
        if (currentDate && currentDescription && currentAmount !== null) {
          const finalDate = currentPaymentDate
            ? convertPaymentDate(currentPaymentDate)
            : currentDate;
          transactions.push({
            date: finalDate,
            description: currentDescription.trim(),
            amount: currentAmount,
            isCredit: currentAmount > 0,
          });
        }

        // Start new transaction
        currentDate = dateMatch[1];
        currentDescription = dateMatch[2].trim();
        currentAmount = null;
        currentPaymentDate = null;

        // Check for payment date (DD.MM.YY) in the same line
        const paymentDateMatch = currentDescription.match(/(\d{2}\.\d{2}\.\d{2})/);
        if (paymentDateMatch) {
          currentPaymentDate = paymentDateMatch[1];
          // Remove payment date from description
          currentDescription = currentDescription
            .replace(paymentDateMatch[1], '')
            .trim();
        }
        continue;
      }

      // --- CASE 2: Line contains an amount (e.g., "1,20" or "1 200,07") ---
      const amountMatch = line.match(/([-+]?\d{1,3}(?:[ \d]{3})*(?:,\d{2})?)/);
      if (amountMatch && currentDate) {
        const amountStr = amountMatch[1].replace(/ /g, '').replace(',', '.');
        currentAmount = parseFloat(amountStr);

        // If we have all parts, save the transaction
        if (currentDescription) {
          const finalDate = currentPaymentDate
            ? convertPaymentDate(currentPaymentDate)
            : currentDate;
          transactions.push({
            date: finalDate,
            description: currentDescription.trim(),
            amount: currentAmount,
            isCredit: currentAmount > 0,
          });
          // Reset for next transaction
          currentDate = '';
          currentDescription = '';
          currentAmount = null;
          currentPaymentDate = null;
        }
        continue;
      }

      // --- CASE 3: Line is part of the description (e.g., "CARTE NUMERO 415") ---
      if (currentDate) {
        currentDescription += ' ' + line.trim();
      }
    }

    // --- Save the last transaction if it exists ---
    if (currentDate && currentDescription && currentAmount !== null) {
      const finalDate = currentPaymentDate
        ? convertPaymentDate(currentPaymentDate)
        : currentDate;
      transactions.push({
        date: finalDate,
        description: currentDescription.trim(),
        amount: currentAmount,
        isCredit: currentAmount > 0,
      });
    }

    return transactions;
  },
};
