import { UserProfile } from '../types';

export const COLOR_PALETTE = [
  { name: 'Sapphire Blue', hex: '#3b82f6', border: '#2563eb' },
  { name: 'Emerald Green', hex: '#10b981', border: '#059669' },
  { name: 'Amber Orange', hex: '#f59e0b', border: '#d97706' },
  { name: 'Crimson Red', hex: '#ef4444', border: '#dc2626' },
  { name: 'Amethyst Purple', hex: '#8b5cf6', border: '#7c3aed' },
  { name: 'Cyan Wave', hex: '#06b6d4', border: '#0891b2' },
  { name: 'Rose Pink', hex: '#f43f5e', border: '#e11d48' },
  { name: 'Indigo Violet', hex: '#6366f1', border: '#4f46e5' },
];

const ANIMAL_NAMES = [
  'Panda', 'Fox', 'Otter', 'Falcon', 'Tiger', 'Eagle', 'Koala', 'Hawk',
  'Badger', 'Dolphin', 'Lynx', 'Raven', 'Wolf', 'Leopard', 'Jaguar', 'Cheetah'
];

const ADJECTIVES = [
  'Clever', 'Swift', 'Curious', 'Brave', 'Bright', 'Calm', 'Chill', 'Keen',
  'Quick', 'Hyper', 'Sonic', 'Noble', 'Gentle', 'Wired', 'Cosmic', 'Solar'
];

const USER_NAME_KEY = 'coderpad_user_name';
const USER_COLOR_KEY = 'coderpad_user_color';

export function getStoredUser(): UserProfile {
  let name = localStorage.getItem(USER_NAME_KEY);
  let color = localStorage.getItem(USER_COLOR_KEY);

  if (!name) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
    name = `${adj} ${animal}`;
    localStorage.setItem(USER_NAME_KEY, name);
  }

  if (!color) {
    const randomColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].hex;
    color = randomColor;
    localStorage.setItem(USER_COLOR_KEY, color);
  }

  return { name, color };
}

export function saveStoredUser(profile: UserProfile): void {
  localStorage.setItem(USER_NAME_KEY, profile.name.trim());
  localStorage.setItem(USER_COLOR_KEY, profile.color);
}
