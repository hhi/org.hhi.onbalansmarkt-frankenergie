import Homey from 'homey';
import { FrankEnergieClient } from '../../lib';

/**
 * Smart PV System Driver
 *
 * Handles pairing of Frank Energie SmartPV systems (SolarEdge).
 * Credentials are configured in device settings, not during pairing.
 */
export = class SmartPvSystemDriver extends Homey.Driver {
  async onInit() {
    this.log('SmartPvSystemDriver initialized');
  }

  /**
   * Handle pairing - simplified flow
   * Automatically uses first PV system found (or aggregates all)
   */
  async onPair(session: Homey.Driver.PairSession) {
    // Handler to verify credentials and fetch PV systems
    session.setHandler('verify_and_create_pv', async (data: { email: string; password: string }) => {
      try {
        const client = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });

        await client.login(data.email, data.password);
        const pvSystems = await client.getSmartPvSystems();

        this.log(`Found ${pvSystems.length} PV systems`);

        if (pvSystems.length === 0) {
          throw new Error('No PV systems found on this Frank Energie account');
        }

        // Store credentials at app level
        // @ts-expect-error - Accessing app instance with specific methods
        this.homey.app.setCredentials?.(data.email, data.password);

        return { success: true, pvSystemCount: pvSystems.length };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to verify PV systems:', errorMsg);
        throw new Error(`Failed to verify PV systems: ${errorMsg}`);
      }
    });

    // Handler for device creation - uses first PV system
    session.setHandler('list_devices', async (data: { email: string; password: string }) => {
      const client = new FrankEnergieClient({
        logger: (msg, ...args) => this.log(msg, ...args),
      });

      await client.login(data.email, data.password);
      const pvSystems = await client.getSmartPvSystems();

      // Use first PV system (similar to battery aggregator approach)
      const firstPv = pvSystems[0];
      const deviceName = pvSystems.length > 1
        ? `Smart PV Systems (${pvSystems.length})`
        : `Smart PV System`;

      return [
        {
          name: deviceName,
          data: {
            id: firstPv.id,
            pvSystemId: firstPv.id,
          },
          settings: {
            frank_energie_email: data.email,
            frank_energie_password: data.password,
            poll_interval: 5,
          },
        },
      ];
    });
  }
};
