/**
 * Type definitions for the Frank Energie Homey App instance
 *
 * These types extend the base Homey.App interface with custom methods
 * specific to this application. Use these types to access app-level
 * functionality from drivers and devices in a type-safe manner.
 */

import Homey from 'homey';

/**
 * Frank Energie app credentials
 */
export interface AppCredentials {
  email: string;
  password: string;
}

/**
 * Extended Homey App interface with Frank Energie specific methods
 */
export interface FrankEnergieApp extends Homey.App {
  /**
   * Check if app-level credentials are configured
   * @returns True if both email and password are configured at app level
   */
  hasCredentials?: () => boolean;

  /**
   * Get app-level credentials
   * @returns Credentials object or null if not configured
   */
  getCredentials?: () => AppCredentials | null;

  /**
   * Store credentials at app level
   * @param email Frank Energie email
   * @param password Frank Energie password
   */
  setCredentials?: (email: string, password: string) => void;
}

/**
 * Type guard to check if an app instance has Frank Energie methods
 */
export function isFrankEnergieApp(app: Homey.App): app is FrankEnergieApp {
  return typeof (app as FrankEnergieApp).hasCredentials === 'function'
    && typeof (app as FrankEnergieApp).getCredentials === 'function';
}

/**
 * Return the Frank Energie app when available, otherwise null
 */
export function getFrankEnergieApp(app: Homey.App): FrankEnergieApp | null {
  return isFrankEnergieApp(app) ? app : null;
}
