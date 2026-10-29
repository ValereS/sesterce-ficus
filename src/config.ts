// src/config.ts
import * as fs from 'fs';
import * as path from 'path';
import type { SesterceConfig, GroupConfig } from './types';

const DEFAULT_GROUP_CONFIG: GroupConfig = {
  members: ['You'],
  defaultPayer: 'You',
  splitRatios: { You: 1 },
  currency: 'EUR',
  defaultCategory: 'General',
  defaultComment: '',
  defaultTags: '',
  dateFormat: 'DD/MM/YYYY',
};

const DEFAULT_CONFIG: SesterceConfig = {
  defaultGroup: 'default',
  groups: {
    default: DEFAULT_GROUP_CONFIG,
  },
};

export function loadConfig(): { group: GroupConfig; config: SesterceConfig } {
  const configPath = path.join(__dirname, './../sesterce.groups.json');
  let config: SesterceConfig = DEFAULT_CONFIG;

  try {
    if (fs.existsSync(configPath)) {
      const configFile = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configFile) as SesterceConfig;
    }
  } catch (err) {
    console.warn('⚠️ No sesterce.groups.json found or invalid. Using defaults.');
  }

  if (!config.groups[config.defaultGroup]) {
    console.warn(`⚠️ Default group "${config.defaultGroup}" not found. Using "default".`);
    config.defaultGroup = 'default';
    config.groups.default = DEFAULT_GROUP_CONFIG;
  }

  return {
    group: config.groups[config.defaultGroup],
    config: config,
  };
}

// Helper: Format date
export function formatDate(dateStr: string, dateFormat: 'DD/MM/YYYY' | 'YYYYMMDD'): string {
  if (dateFormat === 'YYYYMMDD') {
    const [day, month, year] = dateStr.split('/');
    return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
  }
  return dateStr;
}
