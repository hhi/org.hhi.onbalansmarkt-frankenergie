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
export default abstract class FrankEnergieDeviceBase extends Homey.Device {
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
      await this.normalizePollIntervalSetting();
      await this.setupCommonFlowCards();
      await this.setupDeviceSpecificFlowCards();

      // Defer polling setup to avoid blocking onInit with alignment delays
      // This ensures device initialization completes quickly
      this.log('[onInit] Scheduling deferred polling setup');
      this.homey.setTimeout(async () => {
        this.log('[onInit] Starting polling after device initialization');
        try {
          await this.setupPolling();
          this.log('[onInit] Polling started successfully');
          await this.setAvailable();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.error('[onInit] Failed to start polling:', errorMsg);
          await this.setUnavailable(`Polling setup failed: ${errorMsg}`);
        }
      }, 100);

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
   * Ensure poll_interval is stored as a finite number in device settings
   * Normalizes legacy string values and resets invalid entries to a safe default
   */
  protected async normalizePollIntervalSetting(): Promise<void> {
    const pollInterval = this.getSetting('poll_interval');

    if (typeof pollInterval === 'number' && Number.isFinite(pollInterval)) {
      return;
    }

    if (typeof pollInterval === 'string') {
      const parsed = Number(pollInterval);
      if (Number.isFinite(parsed)) {
        await this.setSettings({ poll_interval: parsed });
        this.log(`Normalized poll_interval from string "${pollInterval}" to number ${parsed}`);
        return;
      }
    }

    await this.setSettings({ poll_interval: 5 });
    this.log('poll_interval setting was invalid or missing and has been reset to 5 minutes');
  }

  /**
   * Validate and sanitize poll interval setting
   * @param interval User-provided interval in minutes (can be string or number)
   * @returns Validated interval clamped to 1-1440 minutes range
   */
  private validatePollInterval(interval: unknown): number {
    // Default to 5 minutes if invalid (safe fallback)
    const defaultInterval = 5;

    let numericInterval: number;

    // Handle string values from dropdown settings (Meter driver)
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

    // Clamp to valid range (1-1440 minutes = 1 day)
    const clamped = Math.max(1, Math.min(1440, Math.round(numericInterval)));

    if (clamped !== numericInterval) {
      this.log(`Poll interval ${numericInterval} out of range [1-1440], clamped to ${clamped} minutes`);
    }

    return clamped;
  }

  /**
   * Calculate delay to next polling alignment point
   * @param pollIntervalMinutes Polling interval in minutes
   * @param startMinute Minute of the hour to align to (0-59)
   * @returns Delay in milliseconds until next alignment
   */
  private calculateAlignmentDelay(pollIntervalMinutes: number, startMinute: number): number {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    const currentMs = now.getMilliseconds();

    // Calculate minutes until next alignment point
    let minutesUntilAlignment: number;

    if (pollIntervalMinutes >= 60) {
      // For hourly or longer intervals, align to the start minute
      minutesUntilAlignment = (startMinute - currentMinute + 60) % 60;
      // If we're exactly at the alignment and less than 5 seconds past, use it
      // Otherwise wait for next cycle
      if (minutesUntilAlignment === 0 && currentSecond >= 5) {
        minutesUntilAlignment = 60;
      }
    } else {
      // For sub-hourly intervals, find next alignment point
      // Example: interval=5, start=3 → aligns at 3, 8, 13, 18, 23, 28, 33, 38, 43, 48, 53, 58
      const minutesSinceAlignment = (currentMinute - startMinute + 60) % pollIntervalMinutes;
      minutesUntilAlignment = (pollIntervalMinutes - minutesSinceAlignment) % pollIntervalMinutes;
      // If we're exactly at the alignment and less than 5 seconds past, use it
      if (minutesUntilAlignment === 0 && currentSecond >= 5) {
        minutesUntilAlignment = pollIntervalMinutes;
      }
    }

    // Convert to milliseconds and subtract current seconds/ms to align precisely
    const delayMs = (minutesUntilAlignment * 60 * 1000) - (currentSecond * 1000) - currentMs;

    return Math.max(0, delayMs);
  }

  /**
   * Setup polling interval
   */
  protected async setupPolling(): Promise<void> {
    const pollIntervalSetting = this.getSetting('poll_interval');
    const pollStartMinuteSetting = this.getSetting('poll_start_minute');

    this.log(`Raw poll_interval setting: ${JSON.stringify(pollIntervalSetting)} (type: ${typeof pollIntervalSetting})`);
    this.log(`Raw poll_start_minute setting: ${JSON.stringify(pollStartMinuteSetting)} (type: ${typeof pollStartMinuteSetting})`);

    const pollIntervalMinutes = this.validatePollInterval(pollIntervalSetting);
    const pollIntervalMs = pollIntervalMinutes * 60 * 1000;

    // Validate and clamp start minute
    let startMinute = 0;
    if (typeof pollStartMinuteSetting === 'number') {
      startMinute = Math.max(0, Math.min(59, Math.round(pollStartMinuteSetting)));
    }

    // Calculate delay to next alignment point
    const alignmentDelay = this.calculateAlignmentDelay(pollIntervalMinutes, startMinute);

    if (alignmentDelay > 0) {
      const delaySeconds = Math.round(alignmentDelay / 1000);
      this.log(`Waiting ${delaySeconds}s to align polling to minute ${startMinute}`);

      await new Promise((resolve) => {
        this.homey.setTimeout(resolve, alignmentDelay);
      });

      this.log('Alignment wait completed, starting polling');
    } else {
      this.log(`Already aligned to minute ${startMinute}, starting polling immediately`);
    }

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

    this.schedulePollInterval(pollIntervalMs);

    this.log(`Polling interval started: will poll every ${pollIntervalMinutes} minutes aligned to minute ${startMinute}`);

    // Brief delay to allow UI to synchronize before marking device as available
    // This ensures all capabilities and their options are fully rendered
    await new Promise((resolve) => {
      this.homey.setTimeout(resolve, 500);
    });

    await this.setAvailable();
  }

  /**
   * Schedule recurring polling and countdown updates
   * @param pollIntervalMs Poll interval in milliseconds
   */
  private schedulePollInterval(pollIntervalMs: number): void {
    // Clear existing polling interval so we start counting from "now"
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
    }

    // Update countdown capability immediately
    this.nextPollTime = Date.now() + pollIntervalMs;
    this.startCountdownTimer();

    this.pollInterval = this.homey.setInterval(
      async () => {
        try {
          await this.pollData();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.error('Polling failed:', errorMsg);
        } finally {
          // Always schedule the next poll and refresh countdown
          this.nextPollTime = Date.now() + pollIntervalMs;
          this.updatePollCountdown();
        }
      },
      pollIntervalMs,
    );
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
            this.setCapabilityValue('onbalansmarkt_overall_rank', profile.resultToday.overallRank)
              .catch((error) => this.error('Failed to update overall rank:', error)),
          );
        }

        // Update provider rank
        if (profile.resultToday.providerRank !== null) {
          updatePromises.push(
            this.setCapabilityValue('onbalansmarkt_provider_rank', profile.resultToday.providerRank)
              .catch((error) => this.error('Failed to update provider rank:', error)),
          );
        }

        // Update reported battery charged
        if (profile.resultToday.batteryCharged !== null && profile.resultToday.batteryCharged !== undefined) {
          updatePromises.push(
            this.setCapabilityValue('onbalansmarkt_reported_charged', profile.resultToday.batteryCharged)
              .catch((error) => this.error('Failed to update reported charged:', error)),
          );
        }

        // Update reported battery discharged
        if (profile.resultToday.batteryDischarged !== null && profile.resultToday.batteryDischarged !== undefined) {
          updatePromises.push(
            this.setCapabilityValue('onbalansmarkt_reported_discharged', profile.resultToday.batteryDischarged)
              .catch((error) => this.error('Failed to update reported discharged:', error)),
          );
        }

        // eslint-disable-next-line node/no-unsupported-features/es-builtins
        await Promise.allSettled(updatePromises);

        this.log(
          `Rankings updated - Overall: #${profile.resultToday.overallRank}, `
          + `Provider: #${profile.resultToday.providerRank}, `
          + `Reported: charged ${profile.resultToday.batteryCharged} kWh, discharged ${profile.resultToday.batteryDischarged} kWh`,
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
      ? await this.getCapabilityValue('onbalansmarkt_overall_rank')
      : await this.getCapabilityValue('onbalansmarkt_provider_rank');
    return (rank as number) <= args.threshold;
  }

  protected async condProviderRankBetter(args: ConditionOnlyDeviceArgs) {
    if (args.device !== this) return false;
    const overallRank = await this.getCapabilityValue('onbalansmarkt_overall_rank') as number;
    const providerRank = await this.getCapabilityValue('onbalansmarkt_provider_rank') as number;
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
   * Handle manual reset baseline action (override in subclasses if supported)
   * Default implementation does nothing - subclasses can override
   */
  protected async handleManualResetBaseline(): Promise<void> {
    // Default no-op - subclasses override if they support baseline reset
  }

  protected async handleManualResetExternalBatteries(): Promise<void> {
    // Default no-op - subclasses override if they support external batteries reset
  }

  protected async handleSimulateSend(): Promise<void> {
    // Default no-op - subclasses override if they support simulation
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
    // CRITICAL: First line of handler - if you don't see this, onSettings isn't being called
    this.log('[onSettings] === ENTRY POINT === changedKeys:', JSON.stringify(changedKeys));
    this.log('[onSettings] newSettings:', JSON.stringify(newSettings));
    this.log('Device settings changed:', changedKeys);

    // Handle manual actions (dropdown menu)
    if (changedKeys.includes('manual_action')) {
      const action = newSettings.manual_action as string;

      if (action === 'refresh_now') {
        this.log('Manual action: Refresh data now');
        try {
          await this.pollData();
          const pollIntervalSetting = this.getSetting('poll_interval');
          const pollIntervalMinutes = this.validatePollInterval(pollIntervalSetting);
          const pollIntervalMs = pollIntervalMinutes * 60 * 1000;
          this.schedulePollInterval(pollIntervalMs);
          this.log(`Polling schedule reset: next poll in ${pollIntervalMinutes} minutes`);
          this.log('Manual data refresh completed successfully');
          // Reset dropdown to "none" after onSettings completes
          this.homey.setTimeout(() => {
            this.setSettings({ manual_action: 'none' })
              .catch((error) => this.error('Failed to reset manual_action dropdown:', error));
          }, 100);
          return; // Don't restart polling or reinitialize clients
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.error('Manual data refresh failed:', errorMsg);
          // Reset dropdown to "none" even on failure
          this.homey.setTimeout(() => {
            this.setSettings({ manual_action: 'none' })
              .catch((err) => this.error('Failed to reset manual_action dropdown:', err));
          }, 100);
          throw new Error(`Manual refresh failed: ${errorMsg}`);
        }
      } else if (action === 'reset_baseline') {
        this.log('[SETTINGS] Manual action: Reset daily baseline - ENTERING');

        // Schedule the actual work to happen AFTER onSettings returns
        // This ensures onSettings completes immediately without blocking
        this.homey.setTimeout(async () => {
          this.log('[DEFERRED] Executing reset_baseline after onSettings completed');
          try {
            await this.handleManualResetBaseline();
            this.log('[DEFERRED] handleManualResetBaseline() completed successfully');
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.error('[DEFERRED] Manual baseline reset failed:', errorMsg);
          }
        }, 10);

        // Reset dropdown to "none" immediately
        this.homey.setTimeout(() => {
          this.setSettings({ manual_action: 'none' })
            .catch((error) => this.error('Failed to reset manual_action dropdown:', error));
        }, 100);

        this.log('[SETTINGS] Returning from onSettings immediately');
        return; // Return immediately without awaiting anything
      } else if (action === 'reset_external_batteries') {
        this.log('Manual action: Reset external batteries list');
        try {
          await this.handleManualResetExternalBatteries();
          this.log('Manual external batteries reset completed successfully');
          // Reset dropdown to "none" after onSettings completes
          this.homey.setTimeout(() => {
            this.setSettings({ manual_action: 'none' })
              .catch((error) => this.error('Failed to reset manual_action dropdown:', error));
          }, 100);
          return; // Don't restart polling or reinitialize clients
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.error('Manual external batteries reset failed:', errorMsg);
          // Reset dropdown to "none" even on failure
          this.homey.setTimeout(() => {
            this.setSettings({ manual_action: 'none' })
              .catch((err) => this.error('Failed to reset manual_action dropdown:', err));
          }, 100);
          throw new Error(`Manual external batteries reset failed: ${errorMsg}`);
        }
      } else if (action === 'simulate_send') {
        this.log('Manual action: Simulate send to Onbalansmarkt (Dry Run)');
        try {
          await this.handleSimulateSend();
          this.log('Simulation completed successfully - check logs for detailed output');
          // Reset dropdown to "none" after onSettings completes
          this.homey.setTimeout(() => {
            this.setSettings({ manual_action: 'none' })
              .catch((error) => this.error('Failed to reset manual_action dropdown:', error));
          }, 100);
          return; // Don't restart polling or reinitialize clients
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.error('Simulation failed:', errorMsg);
          // Reset dropdown to "none" even on failure
          this.homey.setTimeout(() => {
            this.setSettings({ manual_action: 'none' })
              .catch((err) => this.error('Failed to reset manual_action dropdown:', err));
          }, 100);
          throw new Error(`Simulation failed: ${errorMsg}`);
        }
      }

      // If action is "none" or unknown, just reset and return
      if (action !== 'none') {
        this.log(`Unknown manual action: ${action}`);
        this.homey.setTimeout(() => {
          this.setSettings({ manual_action: 'none' })
            .catch((error) => this.error('Failed to reset manual_action dropdown:', error));
        }, 100);
      }
      return;
    }

    // Stop polling during reconfiguration to avoid race conditions
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
      this.pollInterval = undefined;
      this.log('Polling stopped for settings reconfiguration');
    }

    // If credentials changed, reinitialize clients
    if (
      changedKeys.includes('frank_energie_email')
      || changedKeys.includes('frank_energie_password')
      || changedKeys.includes('onbalansmarkt_api_key')
    ) {
      this.log('Reinitializing clients due to credential changes');
      try {
        await this.initializeClients();
        this.log('Clients reinitialized successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('Failed to reinitialize clients:', errorMsg);
        await this.setUnavailable(`Client initialization failed: ${errorMsg}`);
        throw new Error(`Failed to reinitialize clients: ${errorMsg}`);
      }
    }

    // Defer polling restart to avoid blocking onSettings
    // This ensures settings save completes quickly
    this.log('[onSettings] Scheduling deferred polling restart');
    this.homey.setTimeout(async () => {
      this.log('[onSettings] Restarting polling after settings change');
      try {
        await this.setupPolling();
        this.log('[onSettings] Polling restarted successfully');
        await this.setAvailable();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.error('[onSettings] Failed to restart polling:', errorMsg);
        await this.setUnavailable(`Polling restart failed: ${errorMsg}`);
      }
    }, 100);

    this.log('[onSettings] Returning immediately, polling will restart in 100ms');
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
