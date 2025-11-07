import {
  BatteryAggregator,
  BatteryMetricsStore,
  TradingModeDetector,
  type SmartBattery,
  type SmartBatterySummary,
  type AggregatedResults,
  type TradingMode,
  type ExternalBatteryMetrics,
  FrankEnergieDeviceBase,
  type TriggerOnlyDeviceArgs,
  type ResultPositiveNegativeArgs,
  type ResultPositiveArgs,
  type ResultExceedsThresholdArgs,
  type TradingModeMatchesArgs,
  type FrankSlimActiveArgs,
  type SendNotificationArgs,
  type SendRichNotificationArgs,
  type ActionOnlyDeviceArgs,
  type ToggleMeasurementSendingArgs,
  type LogToTimelineArgs,
  type ReceiveBatteryMetricsArgs,
  type ReceiveBatteryDailyMetricsArgs,
} from '../../lib';

/**
 * Smart Battery Device
 *
 * Manages individual or aggregated Frank Energie smart batteries.
 * Tracks trading results and sends measurements to Onbalansmarkt.com
 */
export = class SmartBatteryDevice extends FrankEnergieDeviceBase {
  private batteryAggregator?: BatteryAggregator;
  private batteries: SmartBattery[] = [];
  private externalBatteryMetrics?: BatteryMetricsStore;

  // External battery tracking (from flow cards)
  // Stores battery ID -> { type, activationTime (timestamp when first added) }
  private externalBatteries: Map<string, { type: 'total' | 'daily'; activationTime: number }> = new Map();

  // Battery-specific state tracking
  private previousBatteryCount: number = 0;
  private previousTotalResult: number = 0;

  // Manual baseline reset timer (scheduled for 23:59)
  private manualResetTimeout: NodeJS.Timeout | null = null;

  // Picker update debouncing (prevent UI race conditions from rapid updates)
  private pickerUpdateTimeout: NodeJS.Timeout | null = null;
  private pickerUpdatePending: boolean = false;
  private lastPickerHash: string = '';

  /**
   * Initialize battery-specific clients
   */
  async initializeDeviceSpecificClients(): Promise<void> {
    if (!this.frankEnergieClient) {
      throw new Error('FrankEnergieClient not initialized');
    }

    // Initialize battery aggregator
    this.batteryAggregator = new BatteryAggregator({
      frankEnergieClient: this.frankEnergieClient,
      logger: (msg, ...args) => this.log(msg, ...args),
    });

    // Fetch available batteries
    this.batteries = await this.frankEnergieClient.getSmartBatteries();
    this.log(`Found ${this.batteries.length} smart batteries`);

    if (this.batteries.length === 0) {
      throw new Error('No smart batteries found on Frank Energie account');
    }

    // Ensure Onbalansmarkt reported capabilities exist (migration for v0.0.34+)
    await this.ensureOnbalansmarktReportedCapabilities();

    // Ensure external battery capabilities exist (migration for existing devices)
    await this.ensureExternalBatteryAggregatedCapabilities();

    // Ensure recovery state capability exists (migration for existing devices)
    await this.ensureRecoveryStateCapability();

    // Setup individual battery capabilities
    await this.setupIndividualBatteryCapabilities();

    // Initialize external battery metrics store
    this.externalBatteryMetrics = new BatteryMetricsStore({
      device: this,
      logger: (msg, ...args) => this.log(msg, ...args),
      onAutomaticReset: () => this.handleAutomaticBaselineReset(),
    });
    this.log('External battery metrics store initialized');

    // Schedule automatic daily reset at 00:00
    this.externalBatteryMetrics.scheduleAutomaticReset();

    // Ensure day reset happens even if app was running at midnight
    await this.externalBatteryMetrics.ensureDayReset();

    // Load external batteries from store
    await this.loadExternalBatteries();

    // Initialize recovery state to not scheduled (only if capability exists)
    if (this.hasCapability('frank_energie_recovery_state')) {
      try {
        await this.setCapabilityValue(
          'frank_energie_recovery_state',
          'Not scheduled',
        );
        this.log('Recovery state initialized to not scheduled');
      } catch (error) {
        this.error('Failed to initialize recovery state:', error);
      }
    }
  }

  /**
   * Ensure Onbalansmarkt reported capabilities exist
   * This is needed for migration of existing devices that were paired before v0.0.34
   */
  private async ensureOnbalansmarktReportedCapabilities(): Promise<void> {
    const requiredCapabilities = [
      'onbalansmarkt_reported_charged',
      'onbalansmarkt_reported_discharged',
    ];

    let capabilitiesAdded = false;

    for (const capabilityId of requiredCapabilities) {
      if (!this.hasCapability(capabilityId)) {
        this.log(`Adding missing Onbalansmarkt capability: ${capabilityId}`);
        await this.addCapability(capabilityId);
        capabilitiesAdded = true;
      }
    }

    if (capabilitiesAdded) {
      // Brief delay to allow UI to register new capabilities
      await new Promise((resolve) => {
        this.homey.setTimeout(resolve, 300);
      });
      this.log('Onbalansmarkt reported capabilities added');
    } else {
      this.log('Onbalansmarkt reported capabilities already exist');
    }
  }

  /**
   * Ensure aggregated external battery capabilities exist
   * This is needed for migration of existing devices that were paired before these capabilities were added
   */
  private async ensureExternalBatteryAggregatedCapabilities(): Promise<void> {
    const requiredCapabilities = [
      'external_battery_daily_charged',
      'external_battery_daily_discharged',
      'external_battery_current_charged',
      'external_battery_current_discharged',
      'external_battery_startofday_charged',
      'external_battery_startofday_discharged',
      'external_battery_percentage',
      'external_battery_count',
      'external_battery_selector',
    ];

    // Check if we need to refresh capabilities (v0.0.14+ added "id" field to capability definitions)
    const needsRefresh = await this.getStoreValue('capabilities_refreshed_v014') !== true;

    // Track if any capabilities were added or refreshed
    let capabilitiesModified = false;

    for (const capabilityId of requiredCapabilities) {
      if (!this.hasCapability(capabilityId)) {
        this.log(`Adding missing capability: ${capabilityId}`);
        await this.addCapability(capabilityId);
        capabilitiesModified = true;
      } else if (needsRefresh) {
        // Refresh capability to load new definition with "id" field
        this.log(`Refreshing capability definition: ${capabilityId}`);
        await this.removeCapability(capabilityId);
        await this.addCapability(capabilityId);
        capabilitiesModified = true;
      }
    }

    // Brief delay to allow UI to register new/refreshed capabilities
    // This ensures pickers and other UI elements are properly initialized
    if (capabilitiesModified) {
      await new Promise((resolve) => {
        this.homey.setTimeout(resolve, 300);
      });
      this.log('UI synchronization delay applied after capability modifications');
    }

    // Initialize selector to 'none'
    if (this.hasCapability('external_battery_selector')) {
      try {
        await this.setCapabilityValue('external_battery_selector', 'none');
        const currentValue = await this.getCapabilityValue('external_battery_selector');
        this.log(`external_battery_selector initialized. Current value: ${currentValue}`);
      } catch (error) {
        this.error('Failed to initialize external_battery_selector:', error);
      }
    }

    if (needsRefresh) {
      await this.setStoreValue('capabilities_refreshed_v014', true);
      this.log('External battery capabilities refreshed with new definitions');
    } else {
      this.log('External battery aggregated capabilities verified');
    }

    this.log(`ensureExternalBatteryAggregatedCapabilities completed. externalBatteries Map size: ${this.externalBatteries.size}`);
  }

  /**
   * Ensure recovery state capability exists
   * This is needed for migration of existing devices that were paired before this capability was added
   */
  private async ensureRecoveryStateCapability(): Promise<void> {
    const capabilityId = 'frank_energie_recovery_state';

    if (!this.hasCapability(capabilityId)) {
      this.log(`Adding missing recovery state capability: ${capabilityId}`);
      await this.addCapability(capabilityId);

      // Brief delay to allow UI to register new capability
      await new Promise((resolve) => {
        this.homey.setTimeout(resolve, 300);
      });

      this.log('Recovery state capability added');
    } else {
      this.log('Recovery state capability already exists');
    }
  }

  /**
   * Setup dynamic capabilities for individual batteries
   * Batteries are ranked by totalResult (Top 10: highest first)
   */
  private async setupIndividualBatteryCapabilities(): Promise<void> {
    if (!this.frankEnergieClient) {
      this.error('FrankEnergieClient not available for battery setup');
      return;
    }

    // Fetch summaries for all batteries to get totalResult
    const batteryDataPromises = this.batteries.map(async (battery) => {
      try {
        const summary = await this.frankEnergieClient!.getSmartBatterySummary(battery.id);
        return { battery, summary };
      } catch (error) {
        this.error(`Failed to fetch summary for battery ${battery.id}:`, error);
        // Return with zero totalResult if fetch fails
        return {
          battery,
          summary: {
            totalResult: 0,
            lastKnownStateOfCharge: 0,
            lastKnownStatus: 'unknown',
            lastUpdate: new Date().toISOString(),
          },
        };
      }
    });

    const batteryData = await Promise.all(batteryDataPromises);

    // Sort by totalResult (highest first) - Top 10 ranking
    batteryData.sort((a, b) => b.summary.totalResult - a.summary.totalResult);

    // Setup capabilities for sorted batteries (Top 10)
    for (let i = 0; i < batteryData.length; i++) {
      const { battery } = batteryData[i];
      const capabilityId = `battery_${i + 1}_total`;

      // Add capability if it doesn't exist
      if (!this.hasCapability(capabilityId)) {
        await this.addCapability(capabilityId);
        this.log(`Added capability: ${capabilityId}`);
      }

      // Set capability title to brand + externalReference
      const displayName = battery.externalReference
        ? `${battery.brand} - ${battery.externalReference}`
        : `${battery.brand} (${battery.id.slice(0, 8)})`;

      await this.setCapabilityOptions(capabilityId, {
        title: {
          en: displayName,
          nl: displayName,
        },
        units: {
          en: '€',
          nl: '€',
        },
        decimals: 2,
      });

      this.log(`Configured capability ${capabilityId}: ${displayName} (Rank: ${i + 1})`);
    }
  }

  /**
   * Setup battery-specific flow cards
   */
  setupDeviceSpecificFlowCards(): void {
    // Battery triggers
    this.homey.flow.getTriggerCard('daily_results_available')
      .registerRunListener(this.onDailyResultsAvailable.bind(this));
    this.homey.flow.getTriggerCard('result_positive_negative')
      .registerRunListener(this.onResultPositiveNegative.bind(this));
    this.homey.flow.getTriggerCard('milestone_reached')
      .registerRunListener(this.onMilestoneReached.bind(this));
    this.homey.flow.getTriggerCard('top_performer_alert')
      .registerRunListener(this.onTopPerformerAlert.bind(this));
    this.homey.flow.getTriggerCard('trading_mode_changed')
      .registerRunListener(this.onTradingModeChanged.bind(this));
    this.homey.flow.getTriggerCard('frank_slim_bonus_detected')
      .registerRunListener(this.onFrankSlimBonusDetected.bind(this));
    this.homey.flow.getTriggerCard('new_battery_added')
      .registerRunListener(this.onNewBatteryAdded.bind(this));

    // Battery conditions
    this.homey.flow.getConditionCard('result_positive')
      .registerRunListener(this.condResultPositive.bind(this));
    this.homey.flow.getConditionCard('result_exceeds_threshold')
      .registerRunListener(this.condResultExceedsThreshold.bind(this));
    this.homey.flow.getConditionCard('trading_mode_matches')
      .registerRunListener(this.condTradingModeMatches.bind(this));
    this.homey.flow.getConditionCard('frank_slim_active')
      .registerRunListener(this.condFrankSlimActive.bind(this));

    // Battery actions
    this.homey.flow.getActionCard('send_notification')
      .registerRunListener(this.actionSendNotification.bind(this));
    this.homey.flow.getActionCard('send_rich_notification')
      .registerRunListener(this.actionSendRichNotification.bind(this));
    this.homey.flow.getActionCard('force_data_poll')
      .registerRunListener(this.actionForceDataPoll.bind(this));
    this.homey.flow.getActionCard('toggle_measurement_sending')
      .registerRunListener(this.actionToggleMeasurementSending.bind(this));
    this.homey.flow.getActionCard('log_to_timeline')
      .registerRunListener(this.actionLogToTimeline.bind(this));
    this.homey.flow.getActionCard('receive_battery_metrics')
      .registerRunListener(this.actionReceiveBatteryMetrics.bind(this));
    this.homey.flow.getActionCard('receive_battery_daily_metrics')
      .registerRunListener(this.actionReceiveBatteryDailyMetrics.bind(this));
    this.homey.flow.getActionCard('reset_baseline')
      .registerRunListener(this.actionResetBaseline.bind(this));

    this.log('Battery-specific flow cards registered');
  }

  /**
   * Override resetMilestones to ensure battery-specific milestone sets are cleared
   */
  protected resetMilestones(): void {
    super.resetMilestones();
    this.log('Battery device milestones reset');
  }

  /**
   * Poll battery data and update device capabilities
   */
  async pollData(): Promise<void> {
    if (!this.frankEnergieClient || !this.batteryAggregator) {
      throw new Error('Clients not initialized');
    }

    // Check if milestones should be reset (monthly)
    await this.checkAndResetMilestones();

    try {
      // Get aggregated results from all batteries
      const now = new Date();
      const results = await this.batteryAggregator.getAggregatedResults(now, now);

      // Get battery details for trading mode detection
      const primaryBattery = this.batteries[0];
      const batteryDetails = await this.frankEnergieClient.getSmartBattery(primaryBattery.id);
      const tradingModeInfo = TradingModeDetector.detectTradingMode(batteryDetails.settings!);

      // Update device capabilities
      await this.updateCapabilities(results);

      // Update individual battery capabilities
      await this.updateIndividualBatteryCapabilities();

      // Emit flow card triggers
      await this.processBatteryFlowCardTriggers(results, tradingModeInfo.mode);

      // Send measurements to Onbalansmarkt if enabled
      const sendMeasurements = this.getSetting('send_measurements') as boolean;
      if (sendMeasurements && results.periodTradingResult !== 0) {
        await this.sendMeasurement(results, tradingModeInfo.mode);

        // Wait for Onbalansmarkt to process the measurement and recalculate rankings
        this.log('Waiting 5 seconds for Onbalansmarkt to update rankings...');
        await new Promise((resolve) => {
          this.homey.setTimeout(resolve, 5000);
        });
      }

      // Update ranking information (after measurement has been processed)
      await this.updateRankings();

      // Store last poll data
      await this.setStoreValue('lastPollTime', Date.now());
      await this.setStoreValue('lastBatteryId', primaryBattery.id);
      await this.setStoreValue('lastBatteryResult', results.periodTradingResult);
      await this.setStoreValue('lastBatteryResultTotal', results.totalTradingResult);
      await this.setStoreValue('lastTradingMode', tradingModeInfo.mode);
      await this.setStoreValue('lastFrankSlim', results.periodFrankSlim);

      await this.setAvailable();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Poll data failed:', errorMsg);
      await this.setUnavailable(`Data fetch failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Update device capabilities with battery results
   */
  private async updateCapabilities(results: AggregatedResults): Promise<void> {
    const updatePromises: Promise<void>[] = [];

    // Update battery trading result (custom capability)
    if (results.periodTradingResult !== null) {
      updatePromises.push(
        this.setCapabilityValue('frank_energie_trading_result', results.periodTradingResult)
          .catch((error) => this.error('Failed to update frank_energie_trading_result:', error)),
      );
    }

    // Update lifetime total trading result
    if (results.totalTradingResult !== null) {
      updatePromises.push(
        this.setCapabilityValue('frank_energie_lifetime_total', results.totalTradingResult)
          .catch((error) => this.error('Failed to update frank_energie_lifetime_total:', error)),
      );
    }

    // Update Frank Slim bonus
    if (results.periodFrankSlim !== null) {
      updatePromises.push(
        this.setCapabilityValue('frank_energie_frank_slim_bonus', results.periodFrankSlim)
          .catch((error) => this.error('Failed to update frank_energie_frank_slim_bonus:', error)),
      );
    }

    // Update EPEX result
    if (results.periodEpexResult !== null) {
      updatePromises.push(
        this.setCapabilityValue('frank_energie_epex_result', results.periodEpexResult)
          .catch((error) => this.error('Failed to update frank_energie_epex_result:', error)),
      );
    }

    // Update Imbalance result
    if (results.periodImbalanceResult !== null) {
      updatePromises.push(
        this.setCapabilityValue('frank_energie_imbalance_result', results.periodImbalanceResult)
          .catch((error) => this.error('Failed to update frank_energie_imbalance_result:', error)),
      );
    }

    // Update battery mode (custom capability)
    const mode = await this.getStoreValue('lastTradingMode') as string;
    if (mode) {
      updatePromises.push(
        this.setCapabilityValue('frank_energie_battery_mode', mode)
          .catch((error) => this.error('Failed to update frank_energie_battery_mode:', error)),
      );
    }

    // eslint-disable-next-line node/no-unsupported-features/es-builtins
    await Promise.allSettled(updatePromises);

    this.log(
      `Capabilities updated - Total: €${results.periodTradingResult.toFixed(2)} `
      + `(EPEX: €${results.periodEpexResult.toFixed(2)}, Trading: €${results.periodTradingResult.toFixed(2)}, `
      + `Imbalance: €${results.periodImbalanceResult.toFixed(2)}, Frank Slim: €${results.periodFrankSlim.toFixed(2)}), `
      + `Lifetime: €${results.totalTradingResult.toFixed(2)}, Batteries: ${results.batteryCount}`,
    );
  }

  /**
   * Update individual battery capabilities with their totalResult values
   * Batteries are ranked by totalResult (Top 10: highest first)
   */
  private async updateIndividualBatteryCapabilities(): Promise<void> {
    if (!this.frankEnergieClient) {
      return;
    }

    // Fetch summaries for all batteries to get totalResult
    const batteryDataPromises = this.batteries.map(async (battery) => {
      try {
        const summary = await this.frankEnergieClient!.getSmartBatterySummary(battery.id);
        return { battery, summary };
      } catch (error) {
        this.error(`Failed to fetch summary for battery ${battery.id}:`, error);
        return null;
      }
    });

    const batteryDataResults = await Promise.all(batteryDataPromises);
    const batteryData = batteryDataResults.filter(
      (data): data is { battery: SmartBattery; summary: SmartBatterySummary } => data !== null,
    );

    // Sort by totalResult (highest first) - Top 10 ranking
    batteryData.sort((a, b) => b.summary.totalResult - a.summary.totalResult);

    // Update capabilities in sorted order (Top 10)
    const updatePromises: Promise<void>[] = [];

    for (let i = 0; i < batteryData.length; i++) {
      const { battery, summary } = batteryData[i];
      const capabilityId = `battery_${i + 1}_total`;

      if (summary.totalResult !== undefined) {
        const updatePromise = this.setCapabilityValue(capabilityId, summary.totalResult)
          .then(() => {
            const displayName = battery.externalReference
              ? `${battery.brand} - ${battery.externalReference}`
              : `${battery.brand} (${battery.id.slice(0, 8)})`;
            this.log(
              `Updated ${capabilityId} (Rank ${i + 1}): ${displayName} - €${summary.totalResult.toFixed(2)}`,
            );
          })
          .catch((error) => {
            this.error(`Failed to update ${capabilityId}:`, error);
          });

        updatePromises.push(updatePromise);
      }
    }

    // eslint-disable-next-line node/no-unsupported-features/es-builtins
    await Promise.allSettled(updatePromises);
  }

  /**
   * Process and emit battery-specific flow triggers
   */
  private async processBatteryFlowCardTriggers(results: AggregatedResults, mode: string): Promise<void> {
    try {
      const now = new Date();
      const today = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });

      // Get current rankings
      const overallRank = await this.getCapabilityValue('onbalansmarkt_overall_rank') as number | null;
      const providerRank = await this.getCapabilityValue('onbalansmarkt_provider_rank') as number | null;

      // Emit: Daily Results Available
      await this.emitDailyResultsAvailable(
        results.periodTradingResult,
        results.totalTradingResult,
        overallRank || 0,
        providerRank || 0,
        mode,
        today,
      );

      // Emit: Ranking Improved/Declined
      if (this.previousRank !== null && overallRank !== null) {
        if (overallRank < this.previousRank) {
          await this.emitRankingImproved(overallRank, this.previousRank, results.periodTradingResult);
        } else if (overallRank > this.previousRank) {
          await this.emitRankingDeclined(overallRank, this.previousRank);
        }
      }
      if (overallRank !== null) {
        this.previousRank = overallRank;
      }

      // Emit: Result Positive/Negative
      if (results.periodTradingResult !== 0) {
        await this.emitResultPositiveNegative(results.periodTradingResult, results.totalTradingResult, mode);
      }

      // Emit: Milestone Reached
      const milestones = [10, 25, 50, 100, 150, 200, 250, 500];
      for (const milestone of milestones) {
        if (this.previousTotalResult < milestone && results.totalTradingResult >= milestone) {
          if (!this.milestones.has(milestone)) {
            await this.emitMilestoneReached(results.totalTradingResult, milestone);
            this.milestones.add(milestone);
          }
        }
      }
      this.previousTotalResult = results.totalTradingResult;

      // Emit: Top Performer Alert
      if (overallRank !== null && overallRank <= 100 && (this.previousRank === null || this.previousRank > 100)) {
        await this.emitTopPerformerAlert(overallRank, 'overall');
      }

      // Emit: Trading Mode Changed
      if (this.previousMode !== null && this.previousMode !== mode) {
        await this.emitTradingModeChanged(mode, this.previousMode);
      }
      this.previousMode = mode;

      // Emit: Frank Slim Bonus Detected
      if (results.periodFrankSlim > 0) {
        await this.emitFrankSlimBonusDetected(results.periodFrankSlim, results.periodTradingResult);
      }

      // Emit: New Battery Added
      if (this.previousBatteryCount > 0 && results.batteryCount > this.previousBatteryCount) {
        await this.emitNewBatteryAdded(results.batteryCount, this.previousBatteryCount);
      }
      this.previousBatteryCount = results.batteryCount;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Error processing battery flow triggers:', errorMsg);
    }
  }

  /**
   * Simulate sending measurement (dry run for debugging/testing)
   * Logs all data that would be sent without actually calling the API
   */
  async simulateSendMeasurement(): Promise<void> {
    this.log('='.repeat(80));
    this.log('SIMULATION: Onbalansmarkt API Send (Dry Run)');
    this.log('='.repeat(80));

    if (!this.onbalansmarktClient) {
      this.log('❌ Onbalansmarkt client not initialized (API key missing?)');
      return;
    }

    if (!this.frankEnergieClient) {
      this.log('❌ Frank Energie client not initialized');
      return;
    }

    try {
      // Get current trading results
      const aggregatedResults = await this.batteryAggregator!.getAggregatedResults(
        new Date(),
        new Date(),
      );

      // Get trading mode
      const battery = await this.frankEnergieClient.getSmartBattery(this.batteries[0].id);
      if (!battery.settings) {
        throw new Error('Battery settings not available');
      }
      const tradingModeInfo = TradingModeDetector.detectTradingMode(battery.settings);

      // Get external battery metrics
      const batteryCharge = await this.getStoreValue('lastBatteryCharge') as number || 0;
      const externalBatteryPercentage = this.getCapabilityValue('external_battery_percentage') as number | null;
      const externalBatteryDailyCharged = this.getCapabilityValue('external_battery_daily_charged') as number | null;
      const externalBatteryDailyDischarged = this.getCapabilityValue('external_battery_daily_discharged') as number | null;
      const loadBalancingActive = this.getSetting('load_balancing_active') as boolean;

      // Build measurement object
      const measurement = {
        timestamp: new Date(),
        batteryResult: aggregatedResults.periodTradingResult,
        batteryResultTotal: aggregatedResults.totalTradingResult,
        batteryResultEpex: aggregatedResults.periodEpexResult,
        batteryResultImbalance: aggregatedResults.periodImbalanceResult,
        batteryResultCustom: aggregatedResults.periodFrankSlim,
        mode: tradingModeInfo.mode,
        batteryCharge: externalBatteryPercentage !== null ? Math.round(externalBatteryPercentage) : null,
        chargedToday: externalBatteryDailyCharged !== null ? Math.round(externalBatteryDailyCharged) : null,
        dischargedToday: externalBatteryDailyDischarged !== null ? Math.round(externalBatteryDailyDischarged) : null,
        loadBalancing: loadBalancingActive ? 'on' : 'off',
      };

      // Log detailed measurement data
      this.log('\n📊 Measurement Data that would be sent:');
      this.log('-'.repeat(80));
      this.log(`  Timestamp:              ${measurement.timestamp.toISOString()}`);
      this.log(`  Trading Mode:           ${measurement.mode}`);
      this.log('');
      this.log('💰 Trading Results:');
      this.log(`  Period Result:          €${measurement.batteryResult?.toFixed(2) ?? 'null'}`);
      this.log(`  Lifetime Total:         €${measurement.batteryResultTotal?.toFixed(2) ?? 'null'}`);
      this.log(`  EPEX Result:            €${measurement.batteryResultEpex?.toFixed(2) ?? 'null'}`);
      this.log(`  Imbalance Result:       €${measurement.batteryResultImbalance?.toFixed(2) ?? 'null'}`);
      this.log(`  Frank Slim Bonus:       €${measurement.batteryResultCustom?.toFixed(2) ?? 'null'}`);
      this.log('');
      this.log('🔋 External Battery Metrics:');
      this.log(`  Battery Charge:         ${measurement.batteryCharge !== null ? `${measurement.batteryCharge}%` : 'null'}`);
      this.log(`  Charged Today:          ${measurement.chargedToday !== null ? `${measurement.chargedToday} kWh` : 'null'}`);
      this.log(`  Discharged Today:       ${measurement.dischargedToday !== null ? `${measurement.dischargedToday} kWh` : 'null'}`);
      this.log(`  Load Balancing:         ${measurement.loadBalancing}`);
      this.log('-'.repeat(80));

      // Log JSON format
      this.log('\n📝 JSON Payload:');
      this.log(JSON.stringify(measurement, null, 2));

      this.log('\n✅ SIMULATION COMPLETE - No data was actually sent to Onbalansmarkt');
      this.log('   To enable real sending, turn on "Send measurements" in settings');
      this.log('='.repeat(80));

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('❌ Simulation failed:', errorMsg);
      this.log('='.repeat(80));
      throw error;
    }
  }

  /**
   * Override handleSimulateSend to call simulation method
   */
  protected async handleSimulateSend(): Promise<void> {
    await this.simulateSendMeasurement();
  }

  /**
   * Send measurement to Onbalansmarkt API
   */
  private async sendMeasurement(results: AggregatedResults, mode: TradingMode): Promise<void> {
    if (!this.onbalansmarktClient) {
      return;
    }

    try {
      const batteryCharge = await this.getStoreValue('lastBatteryCharge') as number || 0;
      const uploadTimestamp = new Date();

      // Get external battery metrics (rounded to whole numbers)
      const externalBatteryPercentage = this.getCapabilityValue('external_battery_percentage') as number | null;
      const externalBatteryDailyCharged = this.getCapabilityValue('external_battery_daily_charged') as number | null;
      const externalBatteryDailyDischarged = this.getCapabilityValue('external_battery_daily_discharged') as number | null;

      // Get load balancing setting (convert boolean to 'on'/'off')
      const loadBalancingActive = this.getSetting('load_balancing_active') as boolean;

      await this.onbalansmarktClient.sendMeasurement({
        timestamp: uploadTimestamp,
        batteryResult: results.periodTradingResult,
        batteryResultTotal: results.totalTradingResult,
        batteryResultEpex: results.periodEpexResult,
        batteryResultImbalance: results.periodImbalanceResult,
        batteryResultCustom: results.periodFrankSlim,
        mode,
        // External battery metrics (whole numbers)
        batteryCharge: externalBatteryPercentage !== null ? Math.round(externalBatteryPercentage) : null,
        chargedToday: externalBatteryDailyCharged !== null ? Math.round(externalBatteryDailyCharged) : null,
        dischargedToday: externalBatteryDailyDischarged !== null ? Math.round(externalBatteryDailyDischarged) : null,
        loadBalancingActive: loadBalancingActive ? 'on' : 'off',
      });

      // Update last upload timestamp capability
      await this.setCapabilityValue('frank_energie_last_upload', uploadTimestamp.toISOString())
        .catch((error) => this.error('Failed to update last upload timestamp:', error));

      // Emit: Measurement Sent trigger
      await this.emitMeasurementSent(
        results.periodTradingResult,
        batteryCharge,
        mode,
        uploadTimestamp.toISOString(),
      );

      this.log('Measurement sent to Onbalansmarkt');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Failed to send measurement:', errorMsg);
    }
  }

  // ===== Battery Trigger Handlers =====

  private async onDailyResultsAvailable(args: TriggerOnlyDeviceArgs) {
    return args.device === this;
  }

  private async onResultPositiveNegative(args: ResultPositiveNegativeArgs) {
    if (args.device !== this) return false;
    const isPositive = args.isPositive === 'positive';
    const lastResult = await this.getStoreValue('lastBatteryResult') as number || 0;
    return isPositive ? lastResult > 0 : lastResult < 0;
  }

  private async onMilestoneReached(args: TriggerOnlyDeviceArgs) {
    return args.device === this;
  }

  private async onTopPerformerAlert(args: TriggerOnlyDeviceArgs) {
    return args.device === this;
  }

  private async onTradingModeChanged(args: TriggerOnlyDeviceArgs) {
    return args.device === this;
  }

  private async onFrankSlimBonusDetected(args: TriggerOnlyDeviceArgs) {
    return args.device === this;
  }

  private async onNewBatteryAdded(args: TriggerOnlyDeviceArgs) {
    return args.device === this;
  }

  // ===== Battery Condition Handlers =====

  private async condResultPositive(args: ResultPositiveArgs) {
    if (args.device !== this) return false;
    const lastResult = await this.getStoreValue('lastBatteryResult') as number || 0;
    return lastResult > args.threshold;
  }

  private async condResultExceedsThreshold(args: ResultExceedsThresholdArgs) {
    if (args.device !== this) return false;
    const totalResult = await this.getStoreValue('lastBatteryResultTotal') as number || 0;
    return totalResult > args.threshold;
  }

  private async condTradingModeMatches(args: TradingModeMatchesArgs) {
    if (args.device !== this) return false;
    const currentMode = await this.getStoreValue('lastTradingMode') as string;
    return currentMode === args.mode;
  }

  private async condFrankSlimActive(args: FrankSlimActiveArgs) {
    if (args.device !== this) return false;
    const frankSlim = await this.getStoreValue('lastFrankSlim') as number || 0;
    return frankSlim > args.threshold;
  }

  // ===== Battery Action Handlers =====

  private async actionSendNotification(args: SendNotificationArgs) {
    if (args.device !== this) return;
    const title = args.title || 'Trading Update';
    let message = args.message || 'No message';

    if (args.includeMetrics) {
      const result = await this.getStoreValue('lastBatteryResult') as number || 0;
      const rank = await this.getCapabilityValue('onbalansmarkt_overall_rank') as number;
      const mode = await this.getStoreValue('lastTradingMode') as string;
      message += `\n\nResult: €${result.toFixed(2)}\nRank: #${rank}\nMode: ${mode}`;
    }

    this.log(`Sending notification: ${title}`);
    await this.homey.notifications.createNotification({ excerpt: `${title}\n${message}` });
  }

  private async actionSendRichNotification(args: SendRichNotificationArgs) {
    if (args.device !== this) return;

    const batteryResult = await this.getStoreValue('lastBatteryResult') as number || 0;
    const totalResult = await this.getStoreValue('lastBatteryResultTotal') as number || 0;
    const overallRank = await this.getCapabilityValue('onbalansmarkt_overall_rank') as number;
    const providerRank = await this.getCapabilityValue('onbalansmarkt_provider_rank') as number;
    const mode = await this.getStoreValue('lastTradingMode') as string;

    let message = '';
    switch (args.type) {
      case 'daily_summary':
        message = `Daily Results\nResult: €${batteryResult.toFixed(2)}\nMonthly Total: €${totalResult.toFixed(2)}\nRank: #${overallRank}\nMode: ${mode}`;
        break;
      case 'ranking_update':
        message = `Ranking Update\nOverall: #${overallRank}\nProvider: #${providerRank}`;
        break;
      case 'result_only':
        message = `Trading Result\n€${batteryResult.toFixed(2)}`;
        break;
      case 'monthly_milestone':
        message = `Monthly Milestone\nTotal: €${totalResult.toFixed(2)}`;
        break;
      default:
        message = `Notification\nResult: €${batteryResult.toFixed(2)}`;
        break;
    }

    this.log(`Sending rich notification: ${args.type}`);
    await this.homey.notifications.createNotification({ excerpt: message });
  }

  private async actionForceDataPoll(args: ActionOnlyDeviceArgs) {
    if (args.device !== this) return;
    this.log('Force data poll triggered via flow');
    await this.pollData();
  }

  private async actionToggleMeasurementSending(args: ToggleMeasurementSendingArgs) {
    if (args.device !== this) return;

    const currentValue = this.getSetting('send_measurements') as boolean;
    let newValue = currentValue;

    switch (args.state) {
      case 'on':
        newValue = true;
        break;
      case 'off':
        newValue = false;
        break;
      case 'toggle':
        newValue = !currentValue;
        break;
      default:
        this.error(`Invalid measurement sending state: ${args.state}`);
        return;
    }

    if (newValue !== currentValue) {
      await this.setSettings({ send_measurements: newValue });
      this.log(`Measurement sending toggled to: ${newValue}`);
    }
  }

  /**
   * Action: Log event to Homey timeline
   * Creates a visible timeline notification and stores entry locally
   */
  private async actionLogToTimeline(args: LogToTimelineArgs) {
    if (args.device !== this) return;

    const batteryResult = await this.getStoreValue('lastBatteryResult') as number || 0;
    let logMessage = args.event || 'Trading event logged';

    if (args.includeResult) {
      logMessage += ` (€${batteryResult.toFixed(2)})`;
    }

    // Send notification to Homey timeline (visible in app)
    try {
      await this.homey.notifications.createNotification({
        excerpt: `${this.getName()}: ${logMessage}`,
      });
      this.log(`Timeline notification sent: ${logMessage}`);
    } catch (error) {
      this.error('Failed to create timeline notification:', error);
    }

    // Store locally for reference
    await this.setStoreValue('lastTimelineEntry', {
      message: logMessage,
      timestamp: Date.now(),
    });
  }

  /**
   * Sanitize battery ID to make it safe for use in capability IDs
   * Replaces spaces and special characters with underscores, converts to lowercase
   */
  private sanitizeBatteryId(batteryId: string): string {
    return batteryId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Ensure individual battery capabilities exist for a given battery ID
   * Creates capabilities dynamically if they don't exist
   * Returns the capability IDs for charged, discharged, and percentage
   */
  private async ensureExternalBatteryCapabilities(batteryId: string): Promise<{
    chargedId: string;
    dischargedId: string;
    percentageId: string;
  }> {
    const sanitizedId = this.sanitizeBatteryId(batteryId);
    const chargedId = `external_battery_${sanitizedId}_charged`;
    const dischargedId = `external_battery_${sanitizedId}_discharged`;
    const percentageId = `external_battery_${sanitizedId}_percentage`;

    // Create charged capability if it doesn't exist
    if (!this.hasCapability(chargedId)) {
      await this.addCapability(chargedId);
      await this.setCapabilityOptions(chargedId, {
        title: {
          en: `${batteryId} Charged`,
          nl: `${batteryId} Geladen`,
        },
        units: { en: 'kWh', nl: 'kWh' },
        decimals: 2,
      });
      this.log(`Created capability: ${chargedId} for battery ${batteryId}`);
    }

    // Create discharged capability if it doesn't exist
    if (!this.hasCapability(dischargedId)) {
      await this.addCapability(dischargedId);
      await this.setCapabilityOptions(dischargedId, {
        title: {
          en: `${batteryId} Discharged`,
          nl: `${batteryId} Geleverd`,
        },
        units: { en: 'kWh', nl: 'kWh' },
        decimals: 2,
      });
      this.log(`Created capability: ${dischargedId} for battery ${batteryId}`);
    }

    // Create percentage capability if it doesn't exist
    if (!this.hasCapability(percentageId)) {
      await this.addCapability(percentageId);
      await this.setCapabilityOptions(percentageId, {
        title: {
          en: `${batteryId} Level`,
          nl: `${batteryId} Niveau`,
        },
        units: { en: '%', nl: '%' },
        decimals: 0,
      });
      this.log(`Created capability: ${percentageId} for battery ${batteryId}`);
    }

    return { chargedId, dischargedId, percentageId };
  }

  /**
   * Action: Receive battery metrics from external sources
   * Stores metrics and triggers aggregation/flow cards
   */
  private async actionReceiveBatteryMetrics(args: ReceiveBatteryMetricsArgs) {
    if (args.device !== this) return;

    if (!this.externalBatteryMetrics) {
      this.error('External battery metrics store not initialized');
      throw new Error('External battery metrics store not initialized');
    }

    // Register battery in selector (if new)
    this.log(`Flow card 'receive_battery_metrics' triggered with battery_id: ${args.battery_id}`);
    await this.registerExternalBattery(args.battery_id, 'total');

    this.log(`Receiving metrics for battery ${args.battery_id}: charged=${args.total_charged_kwh} kWh, discharged=${args.total_discharged_kwh} kWh, percentage=${args.battery_percentage}%`);

    // Store the metric and get aggregated results
    const aggregated: ExternalBatteryMetrics = await this.externalBatteryMetrics.storeMetric({
      batteryId: args.battery_id,
      totalChargedKwh: args.total_charged_kwh,
      totalDischargedKwh: args.total_discharged_kwh,
      batteryPercentage: args.battery_percentage,
    });

    // Update aggregated device capabilities
    await this.setCapabilityValue('external_battery_daily_charged', aggregated.dailyChargedKwh);
    await this.setCapabilityValue('external_battery_daily_discharged', aggregated.dailyDischargedKwh);
    await this.setCapabilityValue('external_battery_current_charged', aggregated.currentChargedKwh);
    await this.setCapabilityValue('external_battery_current_discharged', aggregated.currentDischargedKwh);
    await this.setCapabilityValue('external_battery_startofday_charged', aggregated.startOfDayChargedKwh);
    await this.setCapabilityValue('external_battery_startofday_discharged', aggregated.startOfDayDischargedKwh);
    await this.setCapabilityValue('external_battery_percentage', aggregated.averageBatteryPercentage);
    await this.setCapabilityValue('external_battery_count', aggregated.batteryCount);

    // Update individual battery capabilities
    const batteryData = aggregated.batteries.find((b) => b.id === args.battery_id);
    if (batteryData) {
      const capIds = await this.ensureExternalBatteryCapabilities(args.battery_id);
      await this.setCapabilityValue(capIds.chargedId, batteryData.dailyChargedKwh);
      await this.setCapabilityValue(capIds.dischargedId, batteryData.dailyDischargedKwh);
      await this.setCapabilityValue(capIds.percentageId, batteryData.percentage);
      this.log(`Updated individual battery ${args.battery_id}: `
        + `charged=${batteryData.dailyChargedKwh.toFixed(2)} kWh, `
        + `discharged=${batteryData.dailyDischargedKwh.toFixed(2)} kWh, `
        + `level=${batteryData.percentage}%`);
    }

    // Trigger flow card with aggregated data
    await this.homey.flow.getTriggerCard('external_battery_metrics_updated').trigger(this, {
      daily_charged_kwh: aggregated.dailyChargedKwh,
      daily_discharged_kwh: aggregated.dailyDischargedKwh,
      average_percentage: aggregated.averageBatteryPercentage,
      battery_count: aggregated.batteryCount,
    });

    this.log(
      `External battery metrics updated - Daily: charged ${aggregated.dailyChargedKwh.toFixed(2)} kWh, `
      + `discharged ${aggregated.dailyDischargedKwh.toFixed(2)} kWh, avg ${aggregated.averageBatteryPercentage.toFixed(1)}%, count ${aggregated.batteryCount}`,
    );
  }

  /**
   * Action: Receive daily battery metrics from external sources
   * For batteries that provide daily values directly (no lifetime totals)
   * Stores metrics and triggers aggregation/flow cards
   */
  private async actionReceiveBatteryDailyMetrics(args: ReceiveBatteryDailyMetricsArgs) {
    if (args.device !== this) return;

    if (!this.externalBatteryMetrics) {
      this.error('External battery metrics store not initialized');
      throw new Error('External battery metrics store not initialized');
    }

    // Register battery in selector (if new)
    this.log(`Flow card 'receive_battery_daily_metrics' triggered with battery_id: ${args.battery_id}`);
    await this.registerExternalBattery(args.battery_id, 'daily');

    this.log(`Receiving daily metrics for battery ${args.battery_id}: `
      + `daily charged=${args.daily_charged_kwh} kWh, daily discharged=${args.daily_discharged_kwh} kWh, percentage=${args.battery_percentage}%`);

    // Store the daily metric and get aggregated results
    const aggregated: ExternalBatteryMetrics = await this.externalBatteryMetrics.storeDailyMetric({
      batteryId: args.battery_id,
      dailyChargedKwh: args.daily_charged_kwh,
      dailyDischargedKwh: args.daily_discharged_kwh,
      batteryPercentage: args.battery_percentage,
    });

    // Update aggregated device capabilities
    await this.setCapabilityValue('external_battery_daily_charged', aggregated.dailyChargedKwh);
    await this.setCapabilityValue('external_battery_daily_discharged', aggregated.dailyDischargedKwh);
    await this.setCapabilityValue('external_battery_current_charged', aggregated.currentChargedKwh);
    await this.setCapabilityValue('external_battery_current_discharged', aggregated.currentDischargedKwh);
    await this.setCapabilityValue('external_battery_startofday_charged', aggregated.startOfDayChargedKwh);
    await this.setCapabilityValue('external_battery_startofday_discharged', aggregated.startOfDayDischargedKwh);
    await this.setCapabilityValue('external_battery_percentage', aggregated.averageBatteryPercentage);
    await this.setCapabilityValue('external_battery_count', aggregated.batteryCount);

    // Update individual battery capabilities
    const batteryData = aggregated.batteries.find((b) => b.id === args.battery_id);
    if (batteryData) {
      const capIds = await this.ensureExternalBatteryCapabilities(args.battery_id);
      await this.setCapabilityValue(capIds.chargedId, batteryData.dailyChargedKwh);
      await this.setCapabilityValue(capIds.dischargedId, batteryData.dailyDischargedKwh);
      await this.setCapabilityValue(capIds.percentageId, batteryData.percentage);
      this.log(
        `Updated individual battery ${args.battery_id}: `
        + `charged=${batteryData.dailyChargedKwh.toFixed(2)} kWh, `
        + `discharged=${batteryData.dailyDischargedKwh.toFixed(2)} kWh, `
        + `${batteryData.percentage}%`,
      );
    }

    // Trigger flow card with aggregated data
    await this.homey.flow.getTriggerCard('external_battery_metrics_updated').trigger(this, {
      daily_charged_kwh: aggregated.dailyChargedKwh,
      daily_discharged_kwh: aggregated.dailyDischargedKwh,
      average_percentage: aggregated.averageBatteryPercentage,
      battery_count: aggregated.batteryCount,
    });

    this.log(
      `External battery daily metrics updated - Daily: charged ${aggregated.dailyChargedKwh.toFixed(2)} kWh, `
      + `discharged ${aggregated.dailyDischargedKwh.toFixed(2)} kWh, avg ${aggregated.averageBatteryPercentage.toFixed(1)}%, count ${aggregated.batteryCount}`,
    );
  }

  /**
   * Emergency baseline reset (flow card action)
   * Resets startOfDay to current values for recovery
   */
  private async actionResetBaseline(): Promise<void> {
    if (!this.externalBatteryMetrics) {
      this.error('External battery metrics store not initialized');
      throw new Error('External battery metrics store not initialized');
    }

    this.log('Reset baseline action triggered by user (flow card)');
    await this.externalBatteryMetrics.emergencyResetBaseline();
    this.log('Baseline reset completed successfully');
  }

  /**
   * Handle automatic baseline reset (called at 00:00)
   * Callback from BatteryMetricsStore when automatic daily reset occurs
   */
  private async handleAutomaticBaselineReset(): Promise<void> {
    this.log('Automatic baseline reset executed at 00:00');
    // No UI state update needed - this is normal daily operation
  }

  /**
   * Handle manual reset baseline action from settings dropdown
   * Schedules a one-time reset at 23:59 to capture most recent daily values
   * Overrides base class to implement baseline reset
   */
  protected async handleManualResetBaseline(): Promise<void> {
    this.log('[BASELINE] Starting handleManualResetBaseline');

    if (!this.externalBatteryMetrics) {
      this.error('[BASELINE] External battery metrics store not initialized');
      throw new Error('External battery metrics store not initialized');
    }
    this.log('[BASELINE] External battery metrics store check passed');

    // Cancel any existing manual reset timer
    if (this.manualResetTimeout) {
      this.homey.clearTimeout(this.manualResetTimeout);
      this.manualResetTimeout = null;
      this.log('[BASELINE] Cancelled previous manual baseline reset timer');
    }

    // Calculate milliseconds until next 23:59
    this.log('[BASELINE] Calculating next 23:59 time');
    const now = new Date();
    const next2359 = new Date(now);
    next2359.setHours(23, 59, 0, 0); // 23:59:00 today

    // Determine if scheduling for today or tomorrow
    const isToday = now.getTime() < next2359.getTime();
    if (!isToday) {
      next2359.setDate(next2359.getDate() + 1);
    }

    const msUntilReset = next2359.getTime() - now.getTime();
    const minutesUntilReset = Math.floor(msUntilReset / 1000 / 60);
    this.log(`[BASELINE] Calculated time: ${minutesUntilReset} minutes until reset`);

    // Schedule one-time reset at 23:59
    this.log('[BASELINE] Scheduling timeout');
    this.manualResetTimeout = this.homey.setTimeout(async () => {
      this.log('Executing scheduled manual baseline reset at 23:59');

      await this.externalBatteryMetrics!.emergencyResetBaseline();

      // Update recovery state to not scheduled (only if capability exists)
      if (this.hasCapability('frank_energie_recovery_state')) {
        try {
          await this.setCapabilityValue(
            'frank_energie_recovery_state',
            'Not scheduled',
          );
          this.log('Manual baseline reset completed successfully at 23:59');
        } catch (error) {
          this.error('Failed to update recovery state after reset:', error);
        }
      }

      this.manualResetTimeout = null;
    }, msUntilReset);

    this.log(`[BASELINE] Timeout scheduled, method completing now (${minutesUntilReset} minutes until reset)`);

    // Defer capability update to avoid timer interference
    // Schedule it to run 500ms after onSettings completes
    this.log('[BASELINE] Scheduling deferred capability update');
    this.homey.setTimeout(() => {
      if (this.hasCapability('frank_energie_recovery_state')) {
        const stateValue = isToday
          ? 'Scheduled for today at 23:59'
          : 'Scheduled for tomorrow at 23:59';

        this.log(`[BASELINE] Deferred update - setting capability to: ${stateValue}`);
        this.setCapabilityValue('frank_energie_recovery_state', stateValue)
          .then(() => {
            this.log(`[BASELINE] Deferred update successful: ${stateValue}`);
          })
          .catch((error) => {
            this.error('[BASELINE] Deferred update failed:', error);
          });
      }
    }, 500);
  }

  /**
   * Handle manual reset external batteries action from settings dropdown
   * Clears the list of registered external batteries and all persisted metrics
   * Starts with a clean slate - list will be rebuilt from flow cards
   */
  protected async handleManualResetExternalBatteries(): Promise<void> {
    const previousCount = this.externalBatteries.size;

    // Clear the in-memory Map
    this.externalBatteries.clear();

    // Clear the persisted externalBatteries list
    await this.setStoreValue('externalBatteries', {});

    // Clear all persisted ExternalBatteryMetrics data (storeKey: 'batteryMetrics')
    if (this.externalBatteryMetrics) {
      await this.externalBatteryMetrics.clear();
      this.log('External battery metrics data cleared from store');
    }

    // Update picker to show only "none" option
    await this.updateBatterySelectorCapability();

    // Reset all external battery capabilities to 0
    const resetPromises: Promise<void>[] = [];

    try {
      resetPromises.push(this.setCapabilityValue('external_battery_selector', 'none'));
      resetPromises.push(this.setCapabilityValue('external_battery_count', 0));
      resetPromises.push(this.setCapabilityValue('external_battery_daily_charged', 0));
      resetPromises.push(this.setCapabilityValue('external_battery_daily_discharged', 0));
      resetPromises.push(this.setCapabilityValue('external_battery_current_charged', 0));
      resetPromises.push(this.setCapabilityValue('external_battery_current_discharged', 0));
      resetPromises.push(this.setCapabilityValue('external_battery_startofday_charged', 0));
      resetPromises.push(this.setCapabilityValue('external_battery_startofday_discharged', 0));
      resetPromises.push(this.setCapabilityValue('external_battery_percentage', 0));

      // eslint-disable-next-line node/no-unsupported-features/es-builtins
      await Promise.allSettled(resetPromises);

      this.log('External battery capabilities reset to 0');
    } catch (error) {
      this.error('Failed to reset external battery capabilities:', error);
    }

    this.log(`External batteries list cleared: removed ${previousCount} batteries. Starting with clean slate - list will be rebuilt from flow cards.`);
  }

  // ===== Trigger Emission Methods =====

  private async emitDailyResultsAvailable(
    result: number,
    totalResult: number,
    overallRank: number,
    providerRank: number,
    mode: string,
    date: string,
  ) {
    await this.homey.flow
      .getTriggerCard('daily_results_available')
      .trigger({
        device: this,
        batteryResult: result,
        batteryResultTotal: totalResult,
        overallRank,
        providerRank,
        tradingMode: mode,
        resultDate: date,
      })
      .catch((error) => this.error('Failed to emit daily_results_available trigger:', error));
  }

  private async emitResultPositiveNegative(result: number, totalResult: number, mode: string) {
    await this.homey.flow
      .getTriggerCard('result_positive_negative')
      .trigger({
        device: this,
        batteryResult: result,
        batteryResultTotal: totalResult,
        tradingMode: mode,
      })
      .catch((error) => this.error('Failed to emit result_positive_negative trigger:', error));
  }

  private async emitMilestoneReached(totalResult: number, threshold: number) {
    await this.homey.flow
      .getTriggerCard('milestone_reached')
      .trigger({
        device: this,
        batteryResultTotal: totalResult,
        overThreshold: totalResult - threshold,
      })
      .catch((error) => this.error('Failed to emit milestone_reached trigger:', error));
  }

  private async emitTopPerformerAlert(currentRank: number, rankType: string) {
    let percentile: string;
    if (currentRank <= 10) {
      percentile = 'Top 1%';
    } else if (currentRank <= 50) {
      percentile = 'Top 5%';
    } else {
      percentile = 'Top 10%';
    }
    await this.homey.flow
      .getTriggerCard('top_performer_alert')
      .trigger({
        device: this,
        currentRank,
        percentile,
      })
      .catch((error) => this.error('Failed to emit top_performer_alert trigger:', error));
  }

  private async emitTradingModeChanged(newMode: string, previousMode: string) {
    await this.homey.flow
      .getTriggerCard('trading_mode_changed')
      .trigger({
        device: this,
        newMode,
        previousMode,
      })
      .catch((error) => this.error('Failed to emit trading_mode_changed trigger:', error));
  }

  private async emitFrankSlimBonusDetected(bonusAmount: number, result: number) {
    await this.homey.flow
      .getTriggerCard('frank_slim_bonus_detected')
      .trigger({
        device: this,
        bonusAmount,
        batteryResult: result,
      })
      .catch((error) => this.error('Failed to emit frank_slim_bonus_detected trigger:', error));
  }

  private async emitNewBatteryAdded(newCount: number, previousCount: number) {
    await this.homey.flow
      .getTriggerCard('new_battery_added')
      .trigger({
        device: this,
        newBatteryCount: newCount,
        previousBatteryCount: previousCount,
      })
      .catch((error) => this.error('Failed to emit new_battery_added trigger:', error));
  }

  /**
   * Load external batteries from device store
   */
  private async loadExternalBatteries(): Promise<void> {
    const stored = (await this.getStoreValue('externalBatteries')) as
      Record<string, 'total' | 'daily' | { type: 'total' | 'daily'; activationTime: number }> | undefined;

    if (stored && Object.keys(stored).length > 0) {
      // Convert to new format (handle migration from old format)
      for (const [id, value] of Object.entries(stored)) {
        if (typeof value === 'string') {
          // Old format: just the type string - add current time as activation time
          this.externalBatteries.set(id, {
            type: value,
            activationTime: Date.now(),
          });
        } else {
          // New format: already has type and activationTime
          this.externalBatteries.set(id, value);
        }
      }

      // Detailed logging of what was loaded
      const batteryDetails = Array.from(this.externalBatteries.entries())
        .map(([id, data]) => `${id} (${data.type})`)
        .join(', ');

      this.log(`Loaded ${this.externalBatteries.size} external batteries from store: ${batteryDetails}`);
      this.log(`externalBatteries Map contents: ${JSON.stringify(Object.fromEntries(this.externalBatteries))}`);

      // Update selector with loaded batteries
      await this.updateBatterySelectorCapability();
    } else {
      this.log('No external batteries found in store');
      this.log(`Stored value: ${JSON.stringify(stored)}`);
    }
  }

  /**
   * Register an external battery (from flow card)
   */
  private async registerExternalBattery(batteryId: string, type: 'total' | 'daily'): Promise<void> {
    const isNewBattery = !this.externalBatteries.has(batteryId);
    const previousData = this.externalBatteries.get(batteryId);
    const typeChanged = previousData && previousData.type !== type;

    if (isNewBattery) {
      // New battery: capture activation time
      const activationTime = Date.now();
      this.externalBatteries.set(batteryId, { type, activationTime });
      this.log(`Registered external battery: ${batteryId} (${type}) at ${new Date(activationTime).toLocaleTimeString()}`);
      this.log(`Map now contains ${this.externalBatteries.size} batteries: ${Array.from(this.externalBatteries.keys()).join(', ')}`);

      // Persist to store
      const stored = Object.fromEntries(this.externalBatteries);
      this.log(`Persisting to store: ${JSON.stringify(stored)}`);
      await this.setStoreValue('externalBatteries', stored);

      // Schedule debounced picker update (prevent race conditions from rapid updates)
      this.schedulePickerUpdate();
    } else if (typeChanged) {
      // Type changed: preserve original activation time
      this.log(`Battery ${batteryId} type changed from ${previousData.type} to ${type}`);
      this.externalBatteries.set(batteryId, {
        type,
        activationTime: previousData.activationTime, // Keep original activation time
      });
      this.log(`Map now contains ${this.externalBatteries.size} batteries: ${Array.from(this.externalBatteries.keys()).join(', ')}`);

      // Persist to store
      const stored = Object.fromEntries(this.externalBatteries);
      this.log(`Persisting to store: ${JSON.stringify(stored)}`);
      await this.setStoreValue('externalBatteries', stored);

      // Schedule debounced picker update (prevent race conditions from rapid updates)
      this.schedulePickerUpdate();
    } else {
      this.log(`Battery ${batteryId} already registered (${type}), skipping registration`);
    }
  }

  /**
   * Schedule a debounced picker update
   * Prevents UI race conditions when rapid updates arrive from external batteries
   *
   * How it works:
   * - First update request: Schedule update in 2 seconds
   * - Subsequent updates within 2 seconds: Cancel previous timer, reschedule for 2 seconds
   * - Result: Picker only updates after 2 seconds of inactivity
   */
  private schedulePickerUpdate(): void {
    // Cancel any pending update
    if (this.pickerUpdateTimeout) {
      this.homey.clearTimeout(this.pickerUpdateTimeout);
      this.pickerUpdateTimeout = null;
    }

    // Mark update as pending
    this.pickerUpdatePending = true;
    this.log('Picker update scheduled (2 second debounce)');

    // Schedule update after 2 seconds of inactivity
    this.pickerUpdateTimeout = this.homey.setTimeout(async () => {
      if (this.pickerUpdatePending) {
        this.log('Executing debounced picker update');
        await this.updateBatterySelectorCapability();
        this.pickerUpdatePending = false;
        this.pickerUpdateTimeout = null;
      }
    }, 2000); // 2 second debounce delay
  }

  /**
   * Update battery selector picker capability with registered batteries
   */
  private async updateBatterySelectorCapability(): Promise<void> {
    if (!this.hasCapability('external_battery_selector')) {
      this.log('external_battery_selector capability not yet available, skipping update');
      return;
    }

    this.log(`updateBatterySelectorCapability called. externalBatteries Map size: ${this.externalBatteries.size}`);
    this.log(`Current Map contents: ${JSON.stringify(Object.fromEntries(this.externalBatteries))}`);

    // Create hash of battery IDs and types (excluding timestamps)
    // This determines if the picker options have actually changed
    const batteryHash = Array.from(this.externalBatteries.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort for consistent hash
      .map(([id, data]) => `${id}:${data.type}`)
      .join('|');

    // Skip update if nothing changed (same batteries, same types)
    if (batteryHash === this.lastPickerHash) {
      this.log('Picker options unchanged, skipping UI update');
      return;
    }

    this.log(`Picker options changed. Old hash: "${this.lastPickerHash}", New hash: "${batteryHash}"`);
    this.lastPickerHash = batteryHash;

    const batteryValues: Array<{ id: string; title: { en: string; nl: string } }> = [];

    // Add all registered batteries
    for (const [batteryId, data] of this.externalBatteries.entries()) {
      // Use stored activation time (fixed timestamp from when battery was first added)
      const date = new Date(data.activationTime);
      const day = String(date.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const dateTimeString = `; ${day}-${month} ${hours}:${minutes}:${seconds}`;

      batteryValues.push({
        id: batteryId,
        title: {
          en: `${batteryId} (${data.type}${dateTimeString})`,
          nl: `${batteryId} (${data.type}${dateTimeString})`,
        },
      });
      this.log(`  Adding to picker: ${batteryId} (${data.type}${dateTimeString})`);
    }

    // Always add "none" option first
    // Get earliest activation time from all batteries
    let activationTime = '';
    if (this.externalBatteries.size > 0) {
      let earliestTime: number | null = null;
      for (const data of this.externalBatteries.values()) {
        if (earliestTime === null || data.activationTime < earliestTime) {
          earliestTime = data.activationTime;
        }
      }

      if (earliestTime) {
        const date = new Date(earliestTime);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        activationTime = ` ${hours}:${minutes}:${seconds}`;
      }
    }

    batteryValues.unshift({
      id: 'none',
      title: {
        en: `— Participating batteries —${activationTime}`,
        nl: `— Participerende batterijen —${activationTime}`,
      },
    });

    this.log(`Final picker values to set: ${JSON.stringify(batteryValues, null, 2)}`);

    try {
      // Get current value before updating options
      const currentValue = await this.getCapabilityValue('external_battery_selector') as string;
      this.log(`Current picker value before update: ${currentValue}`);

      // Reset to 'none' first to force UI refresh
      await this.setCapabilityValue('external_battery_selector', 'none');

      // Small delay to allow UI to process the reset
      await new Promise((resolve) => {
        this.homey.setTimeout(resolve, 100);
      });

      // Update the picker options
      await this.setCapabilityOptions('external_battery_selector', {
        values: batteryValues,
      });

      // Longer delay to allow UI to synchronize with new picker options
      // This ensures the picker is fully rendered before restoring value
      await new Promise((resolve) => {
        this.homey.setTimeout(resolve, 500);
      });

      // Restore previous value if it still exists in the new options
      const valueStillExists = batteryValues.some((v) => v.id === currentValue);
      if (valueStillExists && currentValue !== 'none') {
        await this.setCapabilityValue('external_battery_selector', currentValue);
        this.log(`Restored picker value to: ${currentValue}`);
      } else {
        this.log(`Picker value remains: none (previous value '${currentValue}' no longer valid)`);
      }

      this.log(`Updated battery selector with ${this.externalBatteries.size} batteries: ${Array.from(this.externalBatteries.keys()).join(', ') || 'none'}`);
    } catch (error) {
      this.error('Failed to update battery selector capability:', error);
      this.error('Error details:', JSON.stringify(error));
    }
  }

  /**
   * Diagnostic method: Dump current picker capability state
   * Useful for debugging picker display issues
   */
  async diagnosticDumpPickerState(): Promise<void> {
    try {
      if (!this.hasCapability('external_battery_selector')) {
        this.log('DIAG: external_battery_selector capability not found');
        return;
      }

      const currentValue = await this.getCapabilityValue('external_battery_selector');
      this.log(`DIAG: Current picker value: ${currentValue}`);
      this.log(`DIAG: Map contents: ${JSON.stringify(Object.fromEntries(this.externalBatteries))}`);
      this.log(`DIAG: Stored value: ${JSON.stringify(await this.getStoreValue('externalBatteries'))}`);
    } catch (error) {
      this.error('Failed to dump picker diagnostics:', error);
    }
  }

  /**
   * Device cleanup on removal
   * Stops timers and cleanup resources
   */
  async onUninit() {
    this.log('Smart Battery Device uninitializing...');

    // Cancel manual baseline reset timer if scheduled
    if (this.manualResetTimeout) {
      this.homey.clearTimeout(this.manualResetTimeout);
      this.manualResetTimeout = null;

      // Reset recovery state to not scheduled (only if capability exists)
      if (this.hasCapability('frank_energie_recovery_state')) {
        try {
          await this.setCapabilityValue(
            'frank_energie_recovery_state',
            'Not scheduled',
          );
          this.log('Recovery state reset to not scheduled');
        } catch (error) {
          this.error('Failed to reset recovery state:', error);
        }
      }

      this.log('Cancelled manual baseline reset timer');
    }

    // Cancel pending picker update if scheduled
    if (this.pickerUpdateTimeout) {
      this.homey.clearTimeout(this.pickerUpdateTimeout);
      this.pickerUpdateTimeout = null;
      this.pickerUpdatePending = false;
      this.log('Cancelled pending picker update');
    }

    if (this.externalBatteryMetrics) {
      this.externalBatteryMetrics.destroy();
    }
  }
};
