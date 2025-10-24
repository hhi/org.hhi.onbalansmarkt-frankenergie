import Homey from 'homey';
import { FrankEnergieClient } from '../../lib';

/**
 * Site Meter Driver
 *
 * Handles pairing of Frank Energie site meter for tracking overall energy usage and costs
 */
export = class SiteMeterDriver extends Homey.Driver {
  private frankEnergieClient?: FrankEnergieClient;

  async onInit() {
    this.log('SiteMeterDriver initialized');
  }

  /**
   * Handle pairing
   */
  async onPair(session: any) {
    const pairData: {
      email?: string;
      password?: string;
      siteReference?: string;
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

        pairData.email = data.email;
        pairData.password = data.password;

        return {
          success: true,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Login failed:', errorMsg);
        throw new Error(`Login failed: ${errorMsg}`);
      }
    });

    session.setHandler('confirmSite', async (data: any) => {
      pairData.siteReference = data.siteReference || 'default-site';
      return true;
    });

    session.setHandler('list_devices', async () => {
      return [
        {
          name: 'Site Energy Meter',
          data: {
            id: 'site-meter',
            type: 'meter',
          },
          settings: {
            frank_energie_email: pairData.email,
            frank_energie_password: pairData.password,
            site_reference: pairData.siteReference || '',
            poll_interval: 5,
          },
        },
      ];
    });
  }
};
