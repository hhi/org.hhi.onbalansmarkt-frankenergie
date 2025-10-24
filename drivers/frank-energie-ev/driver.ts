import Homey from 'homey';
import { FrankEnergieClient } from '../../lib';

/**
 * EV Charger Driver
 *
 * Handles pairing of Enode-integrated EV chargers via Frank Energie
 */
export = class EvChargerDriver extends Homey.Driver {
  private frankEnergieClient?: FrankEnergieClient;

  async onInit() {
    this.log('EvChargerDriver initialized');
  }

  /**
   * Handle pairing
   */
  async onPair(session: any) {
    const pairData: {
      email?: string;
      password?: string;
      chargeLimit?: number;
    } = {};

    session.setHandler('login', async (data: any) => {
      try {
        // Initialize client with provided credentials
        this.frankEnergieClient = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });

        // Attempt login
        await this.frankEnergieClient.login(data.email, data.password);
        this.log('Login successful');

        // Fetch Enode sessions to verify EV charger connectivity
        const sessions = await this.frankEnergieClient.getEnodeSessions();
        this.log(`Found ${sessions.rows.length} charging sessions`);

        pairData.email = data.email;
        pairData.password = data.password;

        return {
          hasCharger: sessions.rows.length > 0,
          sessionCount: sessions.rows.length,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Login failed:', errorMsg);
        throw new Error(`Login failed: ${errorMsg}`);
      }
    });

    session.setHandler('setChargeLimit', async (data: any) => {
      // Validate charge limit (typically 0-32 amps for standard chargers)
      const limit = Math.min(Math.max(data.chargeLimit || 16, 0), 32);
      pairData.chargeLimit = limit;
      return true;
    });

    session.setHandler('list_devices', async () => {
      return [
        {
          name: 'EV Charger',
          data: {
            id: 'ev-charger',
            type: 'ev-charger',
          },
          settings: {
            frank_energie_email: pairData.email,
            frank_energie_password: pairData.password,
            charge_limit: pairData.chargeLimit || 16,
            poll_interval: 5,
          },
        },
      ];
    });
  }
};
