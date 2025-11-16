'use strict';

import Homey from 'homey';

/**
 * Frank Energie App
 *
 * Manages app-level settings including shared Frank Energie credentials
 * that are used by all device types (battery, EV, PV, meter).
 */
module.exports = class FrankEnergieApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Frank Energie App initialized');

    // Enable debug inspector if DEBUG environment variable is set
    if (process.env.DEBUG === '1') {
      this.log('Development mode detected, enabling debug inspector');
      try {
        // Dynamically import the debug inspector
        // @ts-expect-error - Dynamic import of ESM module in CommonJS context
        const { default: enableDebugInspector } = await import('./app-debug');
        await enableDebugInspector();
        this.log('Debug inspector enabled');
      } catch (error) {
        this.error('Failed to enable debug inspector:', error);
      }
    }

    // Initialize app settings if not present
    this.initializeAppSettings();
  }

  /**
   * Initialize app-level settings with defaults
   */
  private initializeAppSettings() {
    // Check if credentials are already set
    const email = this.homey.settings.get('frank_energie_email');
    const password = this.homey.settings.get('frank_energie_password');

    if (!email || !password) {
      this.log('App-level credentials not yet configured');
      // Will be set during first device pairing
    } else {
      this.log('App-level credentials found');
    }
  }

  /**
   * Get Frank Energie credentials from app settings
   * @returns Credentials object or null if not configured
   */
  getCredentials(): { email: string; password: string } | null {
    const email = this.homey.settings.get('frank_energie_email') as string | undefined;
    const password = this.homey.settings.get('frank_energie_password') as string | undefined;

    if (email && password) {
      return { email, password };
    }

    return null;
  }

  /**
   * Set Frank Energie credentials at app level
   * @param email Frank Energie email
   * @param password Frank Energie password
   */
  setCredentials(email: string, password: string): void {
    this.homey.settings.set('frank_energie_email', email);
    this.homey.settings.set('frank_energie_password', password);
    this.log('App-level credentials updated');
  }

  /**
   * Check if app-level credentials are configured
   * @returns true if credentials are set
   */
  hasCredentials(): boolean {
    return this.getCredentials() !== null;
  }

};
