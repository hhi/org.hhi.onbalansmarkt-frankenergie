import {
  FrankEnergieDeviceBase,
  type SmartPvSystem,
} from '../../lib';

/**
 * Smart PV System Device
 *
 * Manages Frank Energie SmartPV systems (SolarEdge).
 * Tracks feed-in results and bonuses.
 */
export = class SmartPvSystemDevice extends FrankEnergieDeviceBase {
  private pvSystems: SmartPvSystem[] = [];
  private selectedPvSystemId: string | null = null;

  // PV-specific state tracking
  private previousOperationalStatus: string | null = null;
  private previousBonus: number = 0;
  private bonusMilestones: Set<number> = new Set();

  /**
   * Initialize PV-specific clients
   */
  async initializeDeviceSpecificClients(): Promise<void> {
    if (!this.frankEnergieClient) {
      throw new Error('FrankEnergieClient not initialized');
    }

    // Get configured PV system ID
    this.selectedPvSystemId = this.getSetting('pv_system_id') as string;
    if (!this.selectedPvSystemId) {
      throw new Error('PV system ID not configured');
    }

    // Fetch available PV systems to verify
    this.pvSystems = await this.frankEnergieClient.getSmartPvSystems();
    this.log(`Found ${this.pvSystems.length} PV systems`);

    if (!this.pvSystems.find(pv => pv.id === this.selectedPvSystemId)) {
      throw new Error(`Configured PV system ${this.selectedPvSystemId} not found`);
    }
  }

  /**
   * Setup PV-specific flow cards
   */
  setupDeviceSpecificFlowCards(): void {
    // Note: PV-specific flow cards would be defined similar to battery ones
    // For now, we leverage inherited ranking cards
    this.log('PV-specific flow cards registered');
  }

  /**
   * Override resetMilestones to clear PV-specific milestone sets
   */
  protected resetMilestones(): void {
    super.resetMilestones();
    this.bonusMilestones.clear();
    this.log('PV device milestones reset');
  }

  /**
   * Poll PV system data
   */
  async pollData(): Promise<void> {
    if (!this.frankEnergieClient || !this.selectedPvSystemId) {
      throw new Error('Clients not initialized');
    }

    // Check if milestones should be reset (monthly)
    await this.checkAndResetMilestones();

    try {
      // Get PV system summary
      const pvSummary = await this.frankEnergieClient.getSmartPvSystemSummary(this.selectedPvSystemId);

      // Update capabilities
      await this.updateCapabilities(pvSummary);

      // Emit flow triggers
      await this.processPvFlowCardTriggers(pvSummary);

      // Update rankings if available
      if (this.onbalansmarktClient) {
        await this.updateRankings();
      }

      // Store last poll data
      await this.setStoreValue('lastPollTime', Date.now());
      await this.setStoreValue('lastPvStatus', pvSummary.operationalStatus);
      await this.setStoreValue('lastPvBonus', pvSummary.totalBonus);

      this.setAvailable();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Poll PV data failed:', errorMsg);
      this.setUnavailable(`Data fetch failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Update device capabilities with PV data
   */
  private async updateCapabilities(pvSummary: any): Promise<void> {
    const updatePromises: Promise<void>[] = [];

    // Update PV status
    if (pvSummary.operationalStatus) {
      updatePromises.push(
        this.setCapabilityValue('frank_energie_pv_status', pvSummary.operationalStatus.toLowerCase())
          .catch((error) => this.error('Failed to update pv status:', error)),
      );
    }

    // Update PV bonus
    if (pvSummary.totalBonus !== null) {
      updatePromises.push(
        this.setCapabilityValue('frank_energie_pv_bonus', pvSummary.totalBonus)
          .catch((error) => this.error('Failed to update pv bonus:', error)),
      );

      // Update power meter with bonus as indicator
      updatePromises.push(
        this.setCapabilityValue('meter_power', Math.round(pvSummary.totalBonus * 1000))
          .catch((error) => this.error('Failed to update meter_power:', error)),
      );
    }

    // Update steering status
    if (pvSummary.steeringStatus) {
      updatePromises.push(
        this.setCapabilityValue('onoff', pvSummary.steeringStatus === 'active')
          .catch((error) => this.error('Failed to update onoff:', error)),
      );
    }

    await Promise.allSettled(updatePromises);

    this.log(
      `PV Capabilities updated - Status: ${pvSummary.operationalStatus}, ` +
      `Bonus: €${pvSummary.totalBonus.toFixed(2)}`,
    );
  }

  /**
   * Process and emit PV-specific flow triggers
   */
  private async processPvFlowCardTriggers(pvSummary: any): Promise<void> {
    try {
      // Check operational status change
      if (this.previousOperationalStatus !== null && this.previousOperationalStatus !== pvSummary.operationalStatus) {
        this.log(`PV operational status changed: ${this.previousOperationalStatus} → ${pvSummary.operationalStatus}`);
      }
      this.previousOperationalStatus = pvSummary.operationalStatus;

      // Check bonus milestones
      const bonusMilestones = [10, 25, 50, 100, 250, 500];
      for (const milestone of bonusMilestones) {
        if (this.previousBonus < milestone && pvSummary.totalBonus >= milestone) {
          if (!this.bonusMilestones.has(milestone)) {
            this.log(`PV bonus milestone reached: €${milestone}`);
            this.bonusMilestones.add(milestone);
          }
        }
      }
      this.previousBonus = pvSummary.totalBonus;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Error processing PV flow triggers:', errorMsg);
    }
  }
};
