import Homey from 'homey';
import { FrankEnergieClient } from '../../lib';

/**
 * Smart Battery Driver
 *
 * Handles pairing of Frank Energie SmartBattery devices.
 * Creates a single device that manages ALL batteries on the account.
 */
export = class SmartBatteryDriver extends Homey.Driver {
  async onInit() {
    this.log('SmartBatteryDriver initialized');
  }

  /**
   * Handle pairing - simplified flow
   * User provides credentials, device manages all batteries automatically
   */
  async onPair(session: Homey.Driver.PairSession) {
    // Verify credentials and check for batteries
    session.setHandler('verify_credentials', async (data: { email: string; password: string }) => {
      try {
        const client = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });

        await client.login(data.email, data.password);
        const batteries = await client.getSmartBatteries();

        this.log(`Found ${batteries.length} smart batteries`);

        if (batteries.length === 0) {
          throw new Error('No smart batteries found on this Frank Energie account');
        }

        return {
          batteryCount: batteries.length,
          batteries: batteries.map((b) => ({
            id: b.id,
            name: b.externalReference || `Battery ${b.id.slice(0, 8)}`,
          })),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to verify credentials:', errorMsg);
        throw new Error(`Failed to verify credentials: ${errorMsg}`);
      }
    });

    // Create device - represents ALL batteries on the account
    session.setHandler('list_devices', async (data: { email: string; password: string; batteryCount?: number; onbalansmarktApiKey?: string }) => {
      const deviceName = data.batteryCount && data.batteryCount > 1
        ? `Frank Energie Batteries (${data.batteryCount})`
        : 'Frank Energie Battery';

      // Store credentials at app level for all devices to use
      // @ts-expect-error - Accessing app instance with specific methods
      this.homey.app.setCredentials?.(data.email, data.password);
      this.log('Stored Frank Energie credentials at app level');

      // Onbalansmarkt API key is required for battery device
      const apiKey = data.onbalansmarktApiKey || '';
      if (!apiKey.trim()) {
        this.log('Warning: No Onbalansmarkt API key provided during pairing');
      }

      return [
        {
          name: deviceName,
          data: {
            id: 'frank-energie-batteries',
            type: 'smart-battery-aggregator',
          },
          settings: {
            // Store credentials at device level for backwards compatibility
            frank_energie_email: data.email,
            frank_energie_password: data.password,
            onbalansmarkt_api_key: apiKey,
            poll_interval: 5,
            send_measurements: true,
          },
        },
      ];
    });
  }
};
