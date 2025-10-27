import Homey from 'homey';
import {
  FrankEnergieClient,
  OnbalansmarktClient,
  type FrankEnergieApp,
  type AppCredentials,
  type TriggerOnlyDeviceArgs,
  type ConditionOnlyDeviceArgs,
  type RankInTopXArgs,
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
  protected countdownInterval?: NodeJS.Timeout;
  protected nextPollTime: number | null = null;

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
      await this.setUnavailable(`Initialization failed: ${errorMsg}`);
    }
  }

  /**
   * Initialize API clients - common across all devices
   * Validates credentials and initializes both Frank Energie and Onbalansmarkt clients
   * Credentials are loaded from app-level settings first, then device settings (backwards compatibility)
   */
  protected async initializeClients(): Promise<void> {
    // Try to get credentials from app-level settings first
    const app = this.homey.app as FrankEnergieApp;
    const appCredentials: AppCredentials | null = app.getCredentials?.() || null;

    let frankEmail: string;
    let frankPassword: string;

    if (appCredentials) {
      // Use app-level credentials (preferred)
      frankEmail = appCredentials.email;
      frankPassword = appCredentials.password;
      this.log('Using app-level Frank Energie credentials');
    } else {
      // Fall back to device-level credentials (backwards compatibility)
      frankEmail = this.getSetting('frank_energie_email') as string;
      frankPassword = this.getSetting('frank_energie_password') as string;
      this.log('Using device-level Frank Energie credentials (legacy)');
    }

    // Validate credentials exist
    if (!frankEmail?.trim()) {
      throw new Error('Frank Energie email address not configured. Please configure credentials in app settings or device settings.');
    }

    if (!frankPassword?.trim()) {
      throw new Error('Frank Energie password not configured. Please configure credentials in app settings or device settings.');
    }

    // Initialize and test Frank Energie client
    this.frankEnergieClient = new FrankEnergieClient({
      logger: (msg, ...args) => this.log(msg, ...args),
    });

    try {
      await this.frankEnergieClient.login(frankEmail, frankPassword);
      this.log('Successfully authenticated with Frank Energie');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Frank Energie authentication failed: ${errorMsg}. Check your credentials.`);
    }

    // Initialize Onbalansmarkt client if API key is configured
    const onbalansmarktApiKey = this.getSetting('onbalansmarkt_api_key') as string;
    if (onbalansmarktApiKey?.trim()) {
      try {
        this.onbalansmarktClient = new OnbalansmarktClient({
          apiKey: onbalansmarktApiKey,
          logger: (msg, ...args) => this.log(msg, ...args),
        });
        this.log('Onbalansmarkt client initialized');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to initialize Onbalansmarkt client:', errorMsg);
        // Non-critical error - device can work without Onbalansmarkt
        this.onbalansmarktClient = undefined;
      }
    } else {
      this.onbalansmarktClient = undefined;
      this.log('Onbalansmarkt API key not configured - rankings will not be updated');
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
   * @param interval User-provided interval in minutes (can be string or number)
   * @returns Validated interval clamped to 1-60 minutes range
   */
  private validatePollInterval(interval: unknown): number {
    // Default to 15 minutes if invalid (matches default in settings)
    const defaultInterval = 15;

    let numericInterval: number;

    // Handle string values from dropdown settings
    if (typeof interval === 'string') {
      numericInterval = parseInt(interval, 10);
      if (Number.isNaN(numericInterval)) {
        this.log(`Invalid poll interval string "${interval}", using default: ${defaultInterval} minutes`);
        return defaultInterval;
      }
    } else if (typeof interval === 'number') {
      numericInterval = interval;
    } else {
      this.log(`Invalid poll interval type (${typeof interval}), using default: ${defaultInterval} minutes`);
      return defaultInterval;
    }

    // Clamp to valid range (1-60 minutes)
    const clamped = Math.max(1, Math.min(60, Math.round(numericInterval)));

    if (clamped !== numericInterval) {
      this.log(`Poll interval ${numericInterval} out of range [1-60], clamped to ${clamped} minutes`);
    }

    return clamped;
  }

  /**
   * Setup polling interval
   */
  protected async setupPolling(): Promise<void> {
    const pollIntervalSetting = this.getSetting('poll_interval');
    this.log(`Raw poll_interval setting: ${JSON.stringify(pollIntervalSetting)} (type: ${typeof pollIntervalSetting})`);

    const pollIntervalMinutes = this.validatePollInterval(pollIntervalSetting);
    const pollIntervalMs = pollIntervalMinutes * 60 * 1000;

    this.log(`Setting up polling with ${pollIntervalMinutes} minute interval (${pollIntervalMs}ms)`);

    // Initial poll - don't let errors block the setup
    try {
      await this.pollData();
      this.log('Initial poll completed successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Initial poll failed (will retry on interval):', errorMsg);
      // Continue with setup even if initial poll fails
    }

    // Set next poll time and start countdown
    this.nextPollTime = Date.now() + pollIntervalMs;
    this.startCountdownTimer();

    // Setup recurring poll using Homey's timer management
    this.pollInterval = this.homey.setInterval(
      async () => {
        try {
          await this.pollData();
          // Update next poll time after successful poll
          this.nextPollTime = Date.now() + pollIntervalMs;
          this.updatePollCountdown();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.error('Polling failed:', errorMsg);
          // Still update next poll time so countdown continues
          this.nextPollTime = Date.now() + pollIntervalMs;
          this.updatePollCountdown();
        }
      },
      pollIntervalMs,
    );

    this.log(`Polling interval started: will poll every ${pollIntervalMinutes} minutes`);
    await this.setAvailable();
  }

  /**
   * Update the countdown timer showing minutes until next poll
   * Called every minute to keep the sensor up-to-date
   */
  protected updatePollCountdown(): void {
    if (!this.nextPollTime) {
      // No poll scheduled yet, set to 0
      if (this.hasCapability('frank_energie_next_poll_minutes')) {
        this.setCapabilityValue('frank_energie_next_poll_minutes', 0).catch((err) => {
          this.error('Failed to update countdown capability:', err);
        });
      }
      return;
    }

    const now = Date.now();
    const remainingMs = this.nextPollTime - now;
    const remainingMinutes = Math.max(0, Math.ceil(remainingMs / (60 * 1000)));

    if (this.hasCapability('frank_energie_next_poll_minutes')) {
      this.setCapabilityValue('frank_energie_next_poll_minutes', remainingMinutes).catch((err) => {
        this.error('Failed to update countdown capability:', err);
      });
    }

    // If countdown reached 0 and poll should have happened, something went wrong
    if (remainingMinutes === 0 && remainingMs < -60000) {
      this.log('Warning: Poll countdown reached 0 but poll may not have executed');
    }
  }

  /**
   * Start the countdown interval timer
   * Updates the countdown capability every minute
   */
  protected startCountdownTimer(): void {
    // Clear existing countdown timer if any
    if (this.countdownInterval) {
      this.homey.clearInterval(this.countdownInterval);
    }

    // Update immediately
    this.updatePollCountdown();

    // Update every minute
    this.countdownInterval = this.homey.setInterval(
      () => {
        this.updatePollCountdown();
      },
      60 * 1000, // 1 minute
    );

    this.log('Countdown timer started');
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

        // eslint-disable-next-line node/no-unsupported-features/es-builtins
        await Promise.allSettled(updatePromises);

        this.log(
          `Rankings updated - Overall: #${profile.resultToday.overallRank}, `
          + `Provider: #${profile.resultToday.providerRank}`,
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
  protected async onRankingImproved(args: TriggerOnlyDeviceArgs) {
    return args.device === this;
  }

  protected async onRankingDeclined(args: TriggerOnlyDeviceArgs) {
    return args.device === this;
  }

  protected async onMeasurementSent(args: TriggerOnlyDeviceArgs) {
    return args.device === this;
  }

  /**
   * Common condition handlers
   */
  protected async condRankInTopX(args: RankInTopXArgs) {
    if (args.device !== this) return false;
    const rank = args.rankType === 'overall'
      ? await this.getCapabilityValue('frank_energie_overall_rank')
      : await this.getCapabilityValue('frank_energie_provider_rank');
    return (rank as number) <= args.threshold;
  }

  protected async condProviderRankBetter(args: ConditionOnlyDeviceArgs) {
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
    newSettings,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('Device settings changed:', changedKeys);

    // Handle manual actions (dropdown menu)
    if (changedKeys.includes('manual_action')) {
      const action = newSettings.manual_action as string;

      if (action === 'refresh_now') {
        this.log('Manual action: Refresh data now');
        try {
          await this.pollData();
          this.log('Manual data refresh completed successfully');
          // Reset dropdown to "none"
          await this.setSettings({ manual_action: 'none' });
          return; // Don't restart polling or reinitialize clients
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.error('Manual data refresh failed:', errorMsg);
          // Reset dropdown to "none" even on failure
          await this.setSettings({ manual_action: 'none' });
          throw new Error(`Manual refresh failed: ${errorMsg}`);
        }
      }

      // If action is "none" or unknown, just reset and return
      if (action !== 'none') {
        this.log(`Unknown manual action: ${action}`);
      }
      await this.setSettings({ manual_action: 'none' });
      return;
    }

    // Stop polling during reconfiguration to avoid race conditions
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
      this.pollInterval = undefined;
      this.log('Polling stopped for settings reconfiguration');
    }

    try {
      // If credentials changed, reinitialize clients
      if (
        changedKeys.includes('frank_energie_email')
        || changedKeys.includes('frank_energie_password')
        || changedKeys.includes('onbalansmarkt_api_key')
      ) {
        this.log('Reinitializing clients due to credential changes');
        await this.initializeClients();
        this.log('Clients reinitialized successfully');
      }

      // Restart polling with new configuration
      await this.setupPolling();
      this.log('Settings applied successfully');
      await this.setAvailable();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Failed to apply settings:', errorMsg);
      await this.setUnavailable(`Settings error: ${errorMsg}`);
      throw new Error(`Failed to apply settings: ${errorMsg}`);
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

    if (this.countdownInterval) {
      this.homey.clearInterval(this.countdownInterval);
    }
  }
}
