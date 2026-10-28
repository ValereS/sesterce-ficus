// Type-only imports
import type { BankProfile } from '../types';

// Runtime imports for profiles
const banquePostaleProfile = require('./banque-postale').banquePostaleProfile;
const lclProfile = require('./lcl').lclProfile;
const defaultProfile = require('./default').defaultProfile;

export const profiles: BankProfile[] = [
  banquePostaleProfile,
  lclProfile,
  defaultProfile,
];

// Auto-detect the bank profile from PDF text
export function detectProfile(text: string): BankProfile {
  for (const profile of profiles) {
    if (profile.detectionRegex.test(text)) {
      return profile;
    }
  }
  return defaultProfile; // Fallback
}
