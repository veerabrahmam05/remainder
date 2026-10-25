import { Appearance } from 'react-native';
import type { ThemeMode } from '../data/settings';

/**
 * Forces the app's color scheme. 'system' clears the override so it follows the device.
 * Because this goes through RN's Appearance API, useColorScheme(), the status bar, switches and
 * native pickers/dialogs all follow it, not just our own theme tokens.
 */
export function applyThemeMode(mode: ThemeMode): void {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}
