import {
  FrankEnergieDeviceBase,
  type EnodeSessionData,
} from '../../lib';

/**
 * EV Charger Device
 *
 * Manages Enode-integrated EV charging systems.
 * Tracks smart charging sessions, costs, and bonuses.
 */
export = class EvChargerDevice extends FrankEnergieDeviceBase {
  private enodeLocationId: string | null = null;

  // EV-specific state tracking
  private isCharging: boolean = false;
  private previousChargeLevel: number = 0;
  private previousSessionCosts: number = 0;
  private previousBonus: number = 0;
  private costMilestones: Set<number> = new Set();

  /**
   * Initialize EV-specific clients
   */
  async initializeDeviceSpecificClients(): Promise<void> {
    if (!this.frankEnergieClient) {
      throw new Error('FrankEnergieClient not initialized');
    }

    // Get configured location ID
    this.enodeLocationId = this.getSetting('enode_location_id') as string;
    if (!this.enodeLocationId) {
      throw new Error('Enode location ID not configured');
    }

    this.log(`EV Charger configured for location: ${this.enodeLocationId}`);
  }

  /**
   * Setup EV-specific flow cards
   */
  setupDeviceSpecificFlowCards(): void {
    // EV-specific flow cards would be defined similarly
    // For now, leverage inherited ranking and measurement cards
    this.log('EV-specific flow cards registered');
  }

  /**
   * Poll EV charging session data
   */
  async pollData(): Promise<void> {
    if (!this.frankEnergieClient) {
      throw new Error('Clients not initialized');
    }

    try {
      // Get EV charging sessions
      const enodeSessions = await this.frankEnergieClient.getEnodeSessions();

      // Update capabilities
      await this.updateCapabilities(enodeSessions);

      // Emit flow triggers
      await this.processEvFlowCardTriggers(enodeSessions);

      // Store last poll data
      await this.setStoreValue('lastPollTime', Date.now());
      await this.setStoreValue('lastEvStatus', this.isCharging ? 'charging' : 'idle');
      await this.setStoreValue('lastEvBonus', enodeSessions.totalSavings);

      this.setAvailable();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Poll EV data failed:', errorMsg);
      this.setUnavailable(`Data fetch failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Update device capabilities with EV charging data
   */
  private async updateCapabilities(sessions: EnodeSessionData): Promise<void> {
    const updatePromises: Promise<void>[] = [];

    // Check if currently charging (approximate - based on latest session)
    const latestSession = sessions.rows[sessions.rows.length - 1];
    if (latestSession && !latestSession.sessionEnd) {
      this.isCharging = true;
    } else {
      this.isCharging = false;
    }

    // Update charging status
    updatePromises.push(
      this.setCapabilityValue('onoff', this.isCharging)
        .catch((error) => this.error('Failed to update onoff:', error)),
    );

    // Update charging status as enum
    updatePromises.push(
      this.setCapabilityValue('frank_energie_ev_charging_status', this.isCharging ? 'charging' : 'idle')
        .catch((error) => this.error('Failed to update ev charging status:', error)),
    );

    // Update bonus (savings)
    if (sessions.totalSavings !== null) {
      updatePromises.push(
        this.setCapabilityValue('frank_energie_ev_bonus', sessions.totalSavings)
          .catch((error) => this.error('Failed to update ev bonus:', error)),
      );
    }

    // Update power meter with cost indicator
    updatePromises.push(
      this.setCapabilityValue('meter_power', Math.round(sessions.totalSavings * 1000))
        .catch((error) => this.error('Failed to update meter_power:', error)),
    );

    // Update battery level if available from latest session
    if (latestSession && latestSession.endCharge !== null) {
      updatePromises.push(
        this.setCapabilityValue('measure_battery', latestSession.endCharge)
          .catch((error) => this.error('Failed to update measure_battery:', error)),
      );
    }

    await Promise.allSettled(updatePromises);

    this.log(
      `EV Capabilities updated - Status: ${this.isCharging ? 'Charging' : 'Idle'}, ` +
      `Savings: €${sessions.totalSavings.toFixed(2)}, ` +
      `Sessions: ${sessions.rows.length}`,
    );
  }

  /**
   * Process and emit EV-specific flow triggers
   */
  private async processEvFlowCardTriggers(sessions: EnodeSessionData): Promise<void> {
    try {
      // Check charging status change
      const wasCharging = this.previousChargeLevel > 0;
      if (wasCharging !== this.isCharging) {
        if (this.isCharging) {
          this.log('EV Charging started');
        } else {
          this.log('EV Charging completed');
        }
      }

      // Check savings milestones
      const savingsMilestones = [10, 25, 50, 100, 250];
      for (const milestone of savingsMilestones) {
        if (this.previousBonus < milestone && sessions.totalSavings >= milestone) {
          if (!this.costMilestones.has(milestone)) {
            this.log(`EV savings milestone reached: €${milestone}`);
            this.costMilestones.add(milestone);
          }
        }
      }

      this.previousBonus = sessions.totalSavings;
      if (sessions.rows.length > 0) {
        const latestSession = sessions.rows[sessions.rows.length - 1];
        this.previousChargeLevel = latestSession.endCharge || 0;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Error processing EV flow triggers:', errorMsg);
    }
  }
};
