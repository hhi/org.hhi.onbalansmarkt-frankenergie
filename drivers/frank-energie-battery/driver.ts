import Homey from 'homey';
import { FrankEnergieClient, type SmartBattery } from '../../lib';

/**
 * Smart Battery Driver
 *
 * Handles pairing of Frank Energie SmartBattery devices
 */
export = class SmartBatteryDriver extends Homey.Driver {
  private frankEnergieClient?: FrankEnergieClient;

  async onInit() {
    this.log('SmartBatteryDriver initialized');
  }

  /**
   * Handle pairing
   */
  async onPair(session: any) {
    const pairData: { email?: string; password?: string; batteries?: SmartBattery[]; selectedBatteryId?: string; onbalansmarktApiKey?: string } = {};

    session.setHandler('login', async (data: any) => {
      try {
        // Initialize client with provided credentials
        this.frankEnergieClient = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });

        // Attempt login
        await this.frankEnergieClient.login(data.email, data.password);
        this.log('Login successful');

        // Fetch batteries
        const batteries = await this.frankEnergieClient.getSmartBatteries();
        this.log(`Found ${batteries.length} batteries`);

        pairData.email = data.email;
        pairData.password = data.password;
        pairData.batteries = batteries;

        return { batteries: batteries.map(b => ({ id: b.id, name: b.externalReference || `Battery ${b.id.slice(0, 8)}` })) };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Login failed:', errorMsg);
        throw new Error(`Login failed: ${errorMsg}`);
      }
    });

    session.setHandler('selectBattery', async (data: any) => {
      pairData.selectedBatteryId = data.batteryId;
      return true;
    });

    session.setHandler('onbalansmarktApiKey', async (data: any) => {
      pairData.onbalansmarktApiKey = data.apiKey;
      return true;
    });

    session.setHandler('list_devices', async () => {
      if (!pairData.selectedBatteryId) {
        throw new Error('No battery selected');
      }

      const battery = pairData.batteries?.find(b => b.id === pairData.selectedBatteryId);
      if (!battery) {
        throw new Error('Selected battery not found');
      }

      return [
        {
          name: battery.externalReference || `Smart Battery ${battery.id.slice(0, 8)}`,
          data: {
            id: battery.id,
            batteryId: battery.id,
          },
          settings: {
            frank_energie_email: pairData.email,
            frank_energie_password: pairData.password,
            onbalansmarkt_api_key: pairData.onbalansmarktApiKey || '',
            poll_interval: 5,
            send_measurements: true,
          },
        },
      ];
    });
  }
};
