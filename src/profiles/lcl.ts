import { BankProfile, Transaction } from '../types';

/**
 * NOT TESTED !
 */
export const lclProfile: BankProfile = {
  name: 'LCL',
  detectionRegex: /LCL|Crédit Lyonnais/i,

  parseTransactions: (text: string): Transaction[] => {
    // Example parser for LCL (adjust based on their format)
    const transactions: Transaction[] = [];
    const regex = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\d+[,\d]+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const amount = parseFloat(match[3].replace(',', '.'));
      transactions.push({
        date: match[1],
        description: match[2].trim(),
        amount: amount,
        isCredit: amount > 0,
      });
    }

    return transactions;
  },
};
