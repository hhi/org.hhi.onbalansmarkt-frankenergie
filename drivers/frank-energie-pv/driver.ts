import Homey from 'homey';
import { FrankEnergieClient, type SmartPvSystem } from '../../lib';

/**
 * Smart PV System Driver
 *
 * Handles pairing of Frank Energie SmartPV systems (SolarEdge)
 */
export = class SmartPvSystemDriver extends Homey.Driver {
  private frankEnergieClient?: FrankEnergieClient;

  async onInit() {
    this.log('SmartPvSystemDriver initialized');
  }

  /**
   * Handle pairing
   */
  async onPair(session: any) {
    const pairData: {
      email?: string;
      password?: string;
      pvSystems?: SmartPvSystem[];
      selectedPvSystemId?: string;
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

        // Fetch PV systems
        const pvSystems = await this.frankEnergieClient.getSmartPvSystems();
        this.log(`Found ${pvSystems.length} PV systems`);

        pairData.email = data.email;
        pairData.password = data.password;
        pairData.pvSystems = pvSystems;

        return {
          pvSystems: pvSystems.map((pv) => ({
            id: pv.id,
            name: pv.displayName || `PV System ${pv.id.slice(0, 8)}`,
          })),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Login failed:', errorMsg);
        throw new Error(`Login failed: ${errorMsg}`);
      }
    });

    session.setHandler('selectPvSystem', async (data: any) => {
      pairData.selectedPvSystemId = data.pvSystemId;
      return true;
    });

    session.setHandler('list_devices', async () => {
      if (!pairData.selectedPvSystemId) {
        throw new Error('No PV system selected');
      }

      const pvSystem = pairData.pvSystems?.find(
        (pv) => pv.id === pairData.selectedPvSystemId,
      );
      if (!pvSystem) {
        throw new Error('Selected PV system not found');
      }

      return [
        {
          name: pvSystem.displayName || `Smart PV System ${pvSystem.id.slice(0, 8)}`,
          data: {
            id: pvSystem.id,
            pvSystemId: pvSystem.id,
          },
          settings: {
            frank_energie_email: pairData.email,
            frank_energie_password: pairData.password,
            poll_interval: 5,
          },
        },
      ];
    });
  }
};
