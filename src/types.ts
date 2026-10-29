// src/types.ts
export interface Transaction {
  date: string;
  description: string;
  amount: number;
  isCredit: boolean;
}

export interface GroupConfig {
  members: string[];
  defaultPayer: string;
  splitRatios: Record<string, number>;
  currency: string;
  defaultCategory: string;
  defaultComment: string;
  defaultTags: string;
  dateFormat: 'DD/MM/YYYY' | 'YYYYMMDD';
}

export interface SesterceConfig {
  defaultGroup: string;
  groups: Record<string, GroupConfig>;
}

export interface BankProfile {
  name: string;
  detectionRegex: RegExp;
  parseTransactions: (text: string) => Transaction[];
}
