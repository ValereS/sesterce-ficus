import { BankProfile, Transaction } from '../types';

export const genericProfile: BankProfile = {
  name: 'Generic',
  detectionRegex: /.*/, // Always matches (fallback)

  parseTransactions: (text: string): Transaction[] => {
    // Try common patterns
    const transactions: Transaction[] = [];

    // Pattern 1: Date + Description + Amount (e.g., "01/01/2024 CARREFOUR -50,00€")
    const regex1 = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\d+[,\d]+)\s*€?/g;
    let match;
    while ((match = regex1.exec(text)) !== null) {
      const amount = parseFloat(match[3].replace(',', '.'));
      transactions.push({
        date: match[1],
        description: match[2].trim(),
        amount: amount,
        isCredit: amount > 0,
      });
    }

    // Pattern 2: Date + Description on one line, Amount on next (e.g., Banque Postale)
    const lines = text.split('\n');
    let currentDate = '';
    let currentDescription = '';

    for (const line of lines) {
      const dateMatch = line.match(/^(\d{2}\/\d{2}(?:\/\d{4})?)/);
      if (dateMatch) {
        if (currentDate && currentDescription) {
          // Try to find amount in previous lines? Not sure.
        }
        currentDate = dateMatch[1];
        currentDescription = line.substring(dateMatch[0].length).trim();
        continue;
      }

      const amountMatch = line.match(/([-+]?\d+[,\d]+)/);
      if (amountMatch && currentDate && currentDescription) {
        const amount = parseFloat(amountMatch[1].replace(',', '.'));
        transactions.push({
          date: currentDate,
          description: currentDescription,
          amount: amount,
          isCredit: amount > 0,
        });
        currentDate = '';
        currentDescription = '';
      } else if (currentDate) {
        currentDescription += ' ' + line.trim();
      }
    }

    return transactions;
  },
};
