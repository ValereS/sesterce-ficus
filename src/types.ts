export interface Transaction {
  date: string;
  description: string;
  amount: number;
  isCredit: boolean; // true if credit, false if debit
}

export interface BankProfile {
  name: string;
  // Regex to detect if this profile matches the PDF text
  detectionRegex: RegExp;
  // Function to parse transactions from raw text
  parseTransactions: (text: string) => Transaction[];
  // Optional: Custom CSV generation (if needed)
  generateCSV?: (transactions: Transaction[]) => string;
}
