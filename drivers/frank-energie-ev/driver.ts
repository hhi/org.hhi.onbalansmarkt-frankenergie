import Homey from 'homey';
import { FrankEnergieClient } from '../../lib';

/**
 * EV Charger Driver
 *
 * Handles pairing of Enode-integrated EV chargers via Frank Energie.
 * Credentials are configured in device settings, not during pairing.
 */
export = class EvChargerDriver extends Homey.Driver {
  async onInit() {
    this.log('EvChargerDriver initialized');
  }

  /**
   * Handle pairing - minimal flow
   * Uses app-level credentials if available, otherwise requires credentials
   */
  async onPair(session: Homey.Driver.PairSession) {
    // Check if app-level credentials are already configured
    session.setHandler('check_credentials', async () => {
      // @ts-expect-error - Accessing app instance with specific methods
      const hasCredentials = this.homey.app.hasCredentials?.() as boolean | undefined;
      return { hasCredentials: hasCredentials || false };
    });

    // Verify EV charger exists with provided or app-level credentials
    session.setHandler('verify_charger', async (data: { email?: string; password?: string }) => {
      try {
        // Get credentials from app settings or data
        // @ts-expect-error - Accessing app instance with specific methods
        const appCreds = this.homey.app.getCredentials?.() as { email: string; password: string } | null | undefined;

        const email = data.email || appCreds?.email;
        const password = data.password || appCreds?.password;

        if (!email || !password) {
          throw new Error('Frank Energie credentials not configured. Please add a Battery device first or provide credentials.');
        }

        const client = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });

        await client.login(email, password);
        const sessions = await client.getEnodeSessions();

        this.log(`Found ${sessions.rows.length} charging sessions`);

        if (sessions.rows.length === 0) {
          throw new Error('No EV charger found. Ensure your EV is connected via Enode.');
        }

        // Store credentials at app level if provided
        if (data.email && data.password) {
          // @ts-expect-error - Accessing app instance with specific methods
          this.homey.app.setCredentials?.(data.email, data.password);
          this.log('Stored Frank Energie credentials at app level');
        }

        return { sessionCount: sessions.rows.length };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to verify EV charger:', errorMsg);
        throw new Error(`Failed to verify EV charger: ${errorMsg}`);
      }
    });

    // Create device with credentials
    session.setHandler('list_devices', async (data: { email?: string; password?: string }) => {
      // Get credentials (may be from app settings or provided during pairing)
      // @ts-expect-error - Accessing app instance with specific methods
      const appCreds = this.homey.app.getCredentials?.() as { email: string; password: string } | null | undefined;

      const email = data.email || appCreds?.email || '';
      const password = data.password || appCreds?.password || '';

      // Fetch Enode location ID from sessions
      let locationId = 'default-location';
      try {
        const client = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });
        await client.login(email, password);
        const sessions = await client.getEnodeSessions();

        // Get location ID from first session if available
        if (sessions.rows.length > 0 && sessions.rows[0].locationId) {
          locationId = sessions.rows[0].locationId;
          this.log(`Using Enode location ID: ${locationId}`);
        } else {
          this.log('Warning: No location ID found in sessions, using default');
        }
      } catch (error) {
        this.error('Failed to fetch location ID, using default:', error);
      }

      return [
        {
          name: 'EV Charger',
          data: {
            id: 'ev-charger',
            type: 'ev-charger',
          },
          settings: {
            // Store credentials at device level for backwards compatibility
            frank_energie_email: email,
            frank_energie_password: password,
            poll_interval: 5,
            poll_start_minute: 0,
            enode_location_id: locationId,
          },
        },
      ];
    });
  }
};
