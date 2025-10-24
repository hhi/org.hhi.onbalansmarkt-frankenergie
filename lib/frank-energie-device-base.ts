import Homey from 'homey';
import {
  FrankEnergieClient,
  OnbalansmarktClient,
  type AggregatedResults,
} from './index';

/**
 * Abstract base class for all Frank Energie device types
 *
 * Provides common functionality for battery, PV, EV, and meter devices:
 * - API client initialization
 * - Flow card setup and emission
 * - Polling management
 * - Ranking/measurement tracking
 */
export abstract class FrankEnergieDeviceBase extends Homey.Device {
  protected frankEnergieClient?: FrankEnergieClient;
  protected onbalansmarktClient?: OnbalansmarktClient;
  protected pollInterval?: NodeJS.Timeout;

  // Common flow card state tracking
  protected previousRank: number | null = null;
  protected previousProviderRank: number | null = null;
  protected previousResult: number = 0;
  protected previousMode: string | null = null;
  protected milestones: Set<number> = new Set();

  /**
   * Device initialization - calls setup methods in order
   */
  async onInit() {
    this.log(`${this.constructor.name} initializing...`);

    try {
      await this.initializeClients();
      await this.setupCommonFlowCards();
      await this.setupDeviceSpecificFlowCards();
      await this.setupPolling();
      this.log(`${this.constructor.name} initialized successfully`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Failed to initialize device:', errorMsg);
      this.setUnavailable(`Initialization failed: ${errorMsg}`);
    }
  }

  /**
   * Initialize API clients - common across all devices
   */
  protected async initializeClients(): Promise<void> {
    const frankEmail = this.getSetting('frank_energie_email') as string;
    const frankPassword = this.getSetting('frank_energie_password') as string;

    if (!frankEmail || !frankPassword) {
      throw new Error('Frank Energie credentials not configured');
    }

    // Initialize Frank Energie client
    this.frankEnergieClient = new FrankEnergieClient({
      logger: (msg, ...args) => this.log(msg, ...args),
    });

    await this.frankEnergieClient.login(frankEmail, frankPassword);
    this.log('Successfully authenticated with Frank Energie');

    // Initialize Onbalansmarkt client if API key is configured
    const onbalansmarktApiKey = this.getSetting('onbalansmarkt_api_key') as string;
    if (onbalansmarktApiKey) {
      this.onbalansmarktClient = new OnbalansmarktClient({
        apiKey: onbalansmarktApiKey,
        logger: (msg, ...args) => this.log(msg, ...args),
      });
    }

    // Device-specific initialization
    await this.initializeDeviceSpecificClients();
  }

  /**
   * Setup common flow cards (rankings, measurements)
   */
  protected setupCommonFlowCards(): void {
    // Register common trigger listeners
    this.homey.flow.getTriggerCard('ranking_improved')
      .registerRunListener(this.onRankingImproved.bind(this));
    this.homey.flow.getTriggerCard('ranking_declined')
      .registerRunListener(this.onRankingDeclined.bind(this));
    this.homey.flow.getTriggerCard('measurement_sent')
      .registerRunListener(this.onMeasurementSent.bind(this));

    // Register common condition listeners
    this.homey.flow.getConditionCard('rank_in_top_x')
      .registerRunListener(this.condRankInTopX.bind(this));
    this.homey.flow.getConditionCard('provider_rank_better')
      .registerRunListener(this.condProviderRankBetter.bind(this));

    this.log('Common flow cards registered');
  }

  /**
   * Validate and sanitize poll interval setting
   * @param interval User-provided interval in minutes
   * @returns Validated interval clamped to 1-60 minutes range
   */
  private validatePollInterval(interval: unknown): number {
    // Default to 5 minutes if invalid
    const defaultInterval = 5;

    if (typeof interval !== 'number' || isNaN(interval)) {
      this.log(`Invalid poll interval type, using default: ${defaultInterval} minutes`);
      return defaultInterval;
    }

    // Clamp to valid range (1-60 minutes)
    const clamped = Math.max(1, Math.min(60, Math.round(interval)));

    if (clamped !== interval) {
      this.log(`Poll interval ${interval} out of range [1-60], clamped to ${clamped} minutes`);
    }

    return clamped;
  }

  /**
   * Setup polling interval
   */
  protected async setupPolling(): Promise<void> {
    const pollIntervalMinutes = this.validatePollInterval(this.getSetting('poll_interval'));
    const pollIntervalMs = pollIntervalMinutes * 60 * 1000;

    this.log(`Setting up polling with ${pollIntervalMinutes} minute interval`);

    // Initial poll
    await this.pollData();

    // Setup recurring poll using Homey's timer management
    this.pollInterval = this.homey.setInterval(
      async () => {
        try {
          await this.pollData();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.error('Polling failed:', errorMsg);
        }
      },
      pollIntervalMs,
    );

    this.setAvailable();
  }

  /**
   * Reset milestone tracking sets
   * Override in child classes to also reset device-specific milestone sets
   */
  protected resetMilestones(): void {
    this.milestones.clear();
    this.log('Milestone tracking reset');
  }

  /**
   * Check if milestones should be reset (monthly)
   * Resets all milestone sets if more than 30 days have passed since last reset
   */
  protected async checkAndResetMilestones(): Promise<void> {
    const lastReset = (await this.getStoreValue('lastMilestoneReset')) as number || 0;
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    if (now - lastReset > thirtyDays) {
      this.log('Monthly milestone reset triggered');
      this.resetMilestones();
      await this.setStoreValue('lastMilestoneReset', now);
    }
  }

  /**
   * Update ranking information from Onbalansmarkt
   */
  protected async updateRankings(): Promise<void> {
    if (!this.onbalansmarktClient) {
      return;
    }

    try {
      const profile = await this.onbalansmarktClient.getProfile();

      if (profile.resultToday) {
        const updatePromises: Promise<void>[] = [];

        // Update overall rank
        if (profile.resultToday.overallRank !== null) {
          updatePromises.push(
            this.setCapabilityValue('frank_energie_overall_rank', profile.resultToday.overallRank)
              .catch((error) => this.error('Failed to update overall rank:', error)),
          );
        }

        // Update provider rank
        if (profile.resultToday.providerRank !== null) {
          updatePromises.push(
            this.setCapabilityValue('frank_energie_provider_rank', profile.resultToday.providerRank)
              .catch((error) => this.error('Failed to update provider rank:', error)),
          );
        }

        await Promise.allSettled(updatePromises);

        this.log(
          `Rankings updated - Overall: #${profile.resultToday.overallRank}, ` +
          `Provider: #${profile.resultToday.providerRank}`,
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Failed to update rankings:', errorMsg);
    }
  }

  /**
   * Common trigger handlers
   */
  protected async onRankingImproved(args: any) {
    return args.device === this;
  }

  protected async onRankingDeclined(args: any) {
    return args.device === this;
  }

  protected async onMeasurementSent(args: any) {
    return args.device === this;
  }

  /**
   * Common condition handlers
   */
  protected async condRankInTopX(args: any) {
    if (args.device !== this) return false;
    const rank = args.rankType === 'overall'
      ? await this.getCapabilityValue('frank_energie_overall_rank')
      : await this.getCapabilityValue('frank_energie_provider_rank');
    return (rank as number) <= args.threshold;
  }

  protected async condProviderRankBetter(args: any) {
    if (args.device !== this) return false;
    const overallRank = await this.getCapabilityValue('frank_energie_overall_rank') as number;
    const providerRank = await this.getCapabilityValue('frank_energie_provider_rank') as number;
    return providerRank < overallRank;
  }

  /**
   * Emit common triggers
   */
  protected async emitRankingImproved(currentRank: number, previousRank: number, result: number) {
    await this.homey.flow
      .getTriggerCard('ranking_improved')
      .trigger({
        device: this,
        currentRank,
        previousRank,
        improvement: previousRank - currentRank,
        batteryResult: result,
      })
      .catch((error) => this.error('Failed to emit ranking_improved trigger:', error));
  }

  protected async emitRankingDeclined(currentRank: number, previousRank: number) {
    await this.homey.flow
      .getTriggerCard('ranking_declined')
      .trigger({
        device: this,
        currentRank,
        previousRank,
        decline: currentRank - previousRank,
      })
      .catch((error) => this.error('Failed to emit ranking_declined trigger:', error));
  }

  protected async emitMeasurementSent(result: number, charge: number, mode: string, timestamp: string) {
    await this.homey.flow
      .getTriggerCard('measurement_sent')
      .trigger({
        device: this,
        batteryResult: result,
        batteryCharge: charge,
        tradingMode: mode,
        timestamp,
      })
      .catch((error) => this.error('Failed to emit measurement_sent trigger:', error));
  }

  /**
   * Abstract methods - must be implemented by subclasses
   */
  abstract initializeDeviceSpecificClients(): Promise<void>;
  abstract setupDeviceSpecificFlowCards(): void;
  abstract pollData(): Promise<void>;

  /**
   * Lifecycle methods
   */
  async onAdded() {
    this.log(`${this.constructor.name} has been added`);
  }

  async onSettings({
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('Device settings changed:', changedKeys);

    // Stop polling during reconfiguration to avoid race conditions
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
      this.pollInterval = undefined;
      this.log('Polling stopped for settings reconfiguration');
    }

    // If credentials changed, reinitialize clients
    if (
      changedKeys.includes('frank_energie_email') ||
      changedKeys.includes('frank_energie_password') ||
      changedKeys.includes('onbalansmarkt_api_key')
    ) {
      try {
        this.log('Reinitializing clients due to credential changes');
        await this.initializeClients();
        this.log('Clients reinitialized successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to reinitialize clients:', errorMsg);
        throw new Error(`Failed to apply settings: ${errorMsg}`);
      }
    }

    // Restart polling with new configuration
    try {
      await this.setupPolling();
      this.log('Settings applied successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Failed to restart polling:', errorMsg);
      throw new Error(`Failed to restart polling: ${errorMsg}`);
    }
  }

  async onRenamed(name: string) {
    this.log(`Device renamed to: ${name}`);
  }

  async onDeleted() {
    this.log(`${this.constructor.name} has been deleted`);

    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
    }
  }
}
