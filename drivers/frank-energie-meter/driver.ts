import Homey from 'homey';
import { FrankEnergieClient } from '../../lib';

/**
 * Site Meter Driver
 *
 * Handles pairing of Frank Energie site meter for tracking overall energy usage and costs.
 * Credentials are configured in device settings, not during pairing.
 */
export = class SiteMeterDriver extends Homey.Driver {
  async onInit() {
    this.log('SiteMeterDriver initialized');
  }

  /**
   * Handle pairing - minimal flow
   * User provides credentials, device will validate on first init
   */
  async onPair(session: Homey.Driver.PairSession) {
    // Verify credentials and meter access
    session.setHandler('verify_meter', async (data: { email: string; password: string }) => {
      try {
        const client = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });

        await client.login(data.email, data.password);
        this.log('Credentials verified');

        // Store credentials at app level
        // @ts-expect-error - Accessing app instance with specific methods
        this.homey.app.setCredentials?.(data.email, data.password);

        return { success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to verify credentials:', errorMsg);
        throw new Error(`Failed to verify credentials: ${errorMsg}`);
      }
    });

    // Create device with credentials and optional site reference
    session.setHandler('list_devices', async (data: { email: string; password: string; siteReference?: string }) => {
      const reference = data.siteReference?.trim() || 'default-site';

      return [
        {
          name: 'Site Energy Meter',
          data: {
            id: 'site-meter',
            type: 'meter',
          },
          settings: {
            frank_energie_email: data.email,
            frank_energie_password: data.password,
            site_reference: reference,
            poll_interval: 5,
          },
        },
      ];
    });
  }
};
