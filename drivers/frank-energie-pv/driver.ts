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
    // Check if app-level credentials are already configured
    session.setHandler('check_credentials', async () => {
      // @ts-expect-error - Accessing app instance with specific methods
      const hasCredentials = this.homey.app.hasCredentials?.() as boolean | undefined;
      return { hasCredentials: hasCredentials || false };
    });

    // Handler to verify PV systems with provided or app-level credentials
    session.setHandler('verify_pv_system', async (data?: { email?: string; password?: string }) => {
      try {
        // Get credentials from app settings or data
        // @ts-expect-error - Accessing app instance with specific methods
        const appCreds = this.homey.app.getCredentials?.() as { email: string; password: string } | null | undefined;

        const email = data?.email || appCreds?.email;
        const password = data?.password || appCreds?.password;

        if (!email || !password) {
          throw new Error('Frank Energie credentials not configured. Please add a Battery device first or provide credentials.');
        }

        const client = new FrankEnergieClient({
          logger: (msg, ...args) => this.log(msg, ...args),
        });

        await client.login(email, password);
        const pvSystems = await client.getSmartPvSystems();

        this.log(`Found ${pvSystems.length} PV systems`);

        if (pvSystems.length === 0) {
          throw new Error('No PV systems found on this Frank Energie account');
        }

        // Store credentials at app level if provided
        if (data?.email && data?.password) {
          // @ts-expect-error - Accessing app instance with specific methods
          this.homey.app.setCredentials?.(data.email, data.password);
          this.log('Stored Frank Energie credentials at app level');
        }

        return { success: true, pvSystemCount: pvSystems.length };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to verify PV systems:', errorMsg);
        throw new Error(`Failed to verify PV systems: ${errorMsg}`);
      }
    });

    // Handler for device creation - uses first PV system
    session.setHandler('list_devices', async (data?: { email?: string; password?: string }) => {
      // Get credentials (may be from app settings or provided during pairing)
      // @ts-expect-error - Accessing app instance with specific methods
      const appCreds = this.homey.app.getCredentials?.() as { email: string; password: string } | null | undefined;

      const email = data?.email || appCreds?.email || '';
      const password = data?.password || appCreds?.password || '';

      const client = new FrankEnergieClient({
        logger: (msg, ...args) => this.log(msg, ...args),
      });

      await client.login(email, password);
      const pvSystems = await client.getSmartPvSystems();

      // Use first PV system (similar to battery aggregator approach)
      const firstPv = pvSystems[0];
      const deviceName = pvSystems.length > 1
        ? `Smart PV Systems (${pvSystems.length})`
        : 'Smart PV System';

      return [
        {
          name: deviceName,
          data: {
            id: firstPv.id,
            pvSystemId: firstPv.id,
          },
          settings: {
            // Store credentials at device level for backwards compatibility
            frank_energie_email: email,
            frank_energie_password: password,
            poll_interval: 5,
            pv_system_id: firstPv.id, // PV system ID for device initialization
          },
        },
      ];
    });
  }
};
