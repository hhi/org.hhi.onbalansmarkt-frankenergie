import Homey from 'homey';
import {
  FrankEnergieClient,
  getFrankEnergieApp,
} from '../../lib';

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
    // Session store for credentials
    let pairingData: {
      email: string;
      password: string;
    } | null = null;

    // Check if app-level credentials are already configured
    session.setHandler('check_credentials', async () => {
      const hasCredentials = getFrankEnergieApp(this.homey.app)?.hasCredentials?.() ?? false;
      return { hasCredentials };
    });

    // Get existing credentials for pre-filling form
    session.setHandler('get_credentials', async () => {
      const appCreds = getFrankEnergieApp(this.homey.app)?.getCredentials?.() ?? null;
      return {
        email: appCreds?.email || '',
        password: appCreds?.password || '',
      };
    });

    // Verify credentials and meter access with provided or app-level credentials
    session.setHandler('verify_meter', async (data?: { email?: string; password?: string }) => {
      try {
        // Get credentials from app settings or data
        const appCreds = getFrankEnergieApp(this.homey.app)?.getCredentials?.() ?? null;

        const email = data?.email || appCreds?.email;
        const password = data?.password || appCreds?.password;

        if (!email || !password) {
          throw new Error('Frank Energie credentials not configured. Please add a Battery device first or provide credentials.');
        }

        const client = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });

        await client.login(email, password);
        this.log('Credentials verified');

        // Store credentials at app level if provided
        if (data?.email && data?.password) {
          getFrankEnergieApp(this.homey.app)?.setCredentials?.(data.email, data.password);
          this.log('Stored Frank Energie credentials at app level');
        }

        return { success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to verify credentials:', errorMsg);
        throw new Error(`Failed to verify credentials: ${errorMsg}`);
      }
    });

    // Store credentials from login view
    session.setHandler('store_credentials', async (data: { email: string; password: string }) => {
      pairingData = data;
      this.log('Credentials stored for list_devices');
      return true;
    });

    // Create device with credentials and auto-discovered site reference
    session.setHandler('list_devices', async () => {
      // Get credentials from pairing data or app settings
      const appCreds = getFrankEnergieApp(this.homey.app)?.getCredentials?.() ?? null;

      const email = pairingData?.email || appCreds?.email || '';
      const password = pairingData?.password || appCreds?.password || '';

      // Auto-discover site reference from user's first electricity connection
      let reference = '';
      try {
        const client = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });
        await client.login(email, password);
        const siteRef = await client.getFirstElectricitySiteReference();

        if (siteRef) {
          reference = siteRef;
          this.log(`Auto-discovered site reference: ${reference}`);
        } else {
          this.error('No electricity connection found for meter device');
          throw new Error('No electricity connection found on this Frank Energie account. Meter device requires an active electricity connection.');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to discover site reference:', errorMsg);
        throw new Error(`Failed to discover site connection: ${errorMsg}`);
      }

      return [
        {
          name: 'Site Energy Meter',
          data: {
            id: 'site-meter',
            type: 'meter',
          },
          settings: {
            // Store credentials at device level for backwards compatibility
            frank_energie_email: email,
            frank_energie_password: password,
            site_reference: reference,
            poll_interval: 60,
          },
        },
      ];
    });
  }
};
