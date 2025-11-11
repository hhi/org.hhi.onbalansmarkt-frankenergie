/**
 * Battery Metrics Store
 *
 * Aggregates battery metrics from multiple physical batteries using associative arrays.
 * Handles total values (cumulative) and calculates daily deltas automatically.
 */

import type { Device } from 'homey';

export interface BatteryMetric {
  batteryId: string;
  totalChargedKwh: number;
  totalDischargedKwh: number;
  batteryPercentage: number;
}

export interface BatteryDailyMetric {
  batteryId: string;
  dailyChargedKwh: number;
  dailyDischargedKwh: number;
  batteryPercentage: number;
}

export interface ExternalBatteryMetrics {
  dailyChargedKwh: number;
  dailyDischargedKwh: number;
  currentChargedKwh: number;
  currentDischargedKwh: number;
  startOfDayChargedKwh: number;
  startOfDayDischargedKwh: number;
  averageBatteryPercentage: number;
  batteryCount: number;
  batteries: Array<{
    id: string;
    dailyChargedKwh: number;
    dailyDischargedKwh: number;
    currentChargedKwh: number;
    currentDischargedKwh: number;
    percentage: number;
  }>;
  lastUpdated: number;
}

interface StoredMetrics {
  current: {
    discharged: Record<string, number>;
    charged: Record<string, number>;
    percentage: Record<string, number>;
  };
  startOfDay: {
    discharged: Record<string, number>;
    charged: Record<string, number>;
  };
  dailyOnly: {
    // Batteries that provide daily values directly (no delta calculation needed)
    dailyCharged: Record<string, number>;
    dailyDischarged: Record<string, number>;
    percentage: Record<string, number>;
  };
  lastUpdated: Record<string, number>; // Timestamp per battery (ms since epoch)
  lastResetDate: string; // YYYY-MM-DD format
}

export interface BatteryMetricsStoreConfig {
  device: Device;
  logger?: (message: string, ...args: unknown[]) => void;
  onBeforeAutomaticReset?: (dailyChargedKwh: number, dailyDischargedKwh: number) => Promise<void>;
  onAutomaticReset?: () => Promise<void>;
}

export class BatteryMetricsStore {
  private device: Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private onBeforeAutomaticReset?: (dailyChargedKwh: number, dailyDischargedKwh: number) => Promise<void>;
  private onAutomaticReset?: () => Promise<void>;
  private readonly storeKey = 'batteryMetrics';
  private resetInterval: NodeJS.Timeout | null = null;
  private resetTimeout: NodeJS.Timeout | null = null;

  constructor(config: BatteryMetricsStoreConfig) {
    this.device = config.device;
    this.logger = config.logger || (() => {});
    this.onBeforeAutomaticReset = config.onBeforeAutomaticReset;
    this.onAutomaticReset = config.onAutomaticReset;
  }

  /**
   * Get current date in YYYY-MM-DD format (Europe/Amsterdam timezone)
   */
  private getCurrentDate(): string {
    const now = new Date();
    return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
  }

  /**
   * Get stored metrics, initializing if needed
   */
  private async getStoredMetrics(): Promise<StoredMetrics> {
    const stored = await this.device.getStoreValue(this.storeKey) as StoredMetrics | undefined;

    if (!stored) {
      const initial: StoredMetrics = {
        current: {
          discharged: {},
          charged: {},
          percentage: {},
        },
        startOfDay: {
          discharged: {},
          charged: {},
        },
        dailyOnly: {
          dailyCharged: {},
          dailyDischarged: {},
          percentage: {},
        },
        lastUpdated: {},
        lastResetDate: this.getCurrentDate(),
      };
      await this.device.setStoreValue(this.storeKey, initial);
      return initial;
    }

    // Ensure dailyOnly exists (for backward compatibility)
    if (!stored.dailyOnly) {
      stored.dailyOnly = {
        dailyCharged: {},
        dailyDischarged: {},
        percentage: {},
      };
    }

    // Ensure lastUpdated exists (for backward compatibility)
    if (!stored.lastUpdated) {
      stored.lastUpdated = {};
    }

    return stored;
  }

  /**
   * Save metrics to store
   */
  private async saveMetrics(metrics: StoredMetrics): Promise<void> {
    await this.device.setStoreValue(this.storeKey, metrics);
  }

  /**
   * Check if we need to reset daily counters (new day started)
   * Internal helper used by storeMetric and other methods
   */
  private async checkAndResetIfNeeded(metrics: StoredMetrics): Promise<StoredMetrics> {
    const currentDate = this.getCurrentDate();

    if (metrics.lastResetDate !== currentDate) {
      this.logger(`BatteryMetricsStore: New day detected (${metrics.lastResetDate} → ${currentDate}), resetting daily counters`);

      // Move current totals to startOfDay (for cumulative batteries)
      metrics.startOfDay.discharged = { ...metrics.current.discharged };
      metrics.startOfDay.charged = { ...metrics.current.charged };

      // Reset daily-only values to zero (for daily-reset batteries)
      metrics.dailyOnly.dailyCharged = {};
      metrics.dailyOnly.dailyDischarged = {};
      // Keep percentage (doesn't reset)

      metrics.lastResetDate = currentDate;

      await this.saveMetrics(metrics);
    }

    return metrics;
  }

  /**
   * Ensure daily reset is applied (public method, call on device init)
   * Checks if a new day has started and resets daily counters accordingly
   */
  async ensureDayReset(): Promise<void> {
    let metrics = await this.getStoredMetrics();
    await this.checkAndResetIfNeeded(metrics);
  }

  /**
   * Store a battery metric update
   * @param metric Battery metric with total (cumulative) values
   * @returns Aggregated metrics across all batteries
   */
  async storeMetric(metric: BatteryMetric): Promise<ExternalBatteryMetrics> {
    let metrics = await this.getStoredMetrics();

    // Check if we need to reset for new day
    metrics = await this.checkAndResetIfNeeded(metrics);

    // Initialize startOfDay for new battery if not present
    if (metrics.startOfDay.discharged[metric.batteryId] === undefined) {
      metrics.startOfDay.discharged[metric.batteryId] = metric.totalDischargedKwh;
      this.logger(`BatteryMetricsStore: Initialized startOfDay discharged for battery ${metric.batteryId}: ${metric.totalDischargedKwh}`);
    }
    if (metrics.startOfDay.charged[metric.batteryId] === undefined) {
      metrics.startOfDay.charged[metric.batteryId] = metric.totalChargedKwh;
      this.logger(`BatteryMetricsStore: Initialized startOfDay charged for battery ${metric.batteryId}: ${metric.totalChargedKwh}`);
    }

    // Update current values in associative arrays
    metrics.current.discharged[metric.batteryId] = metric.totalDischargedKwh;
    metrics.current.charged[metric.batteryId] = metric.totalChargedKwh;
    metrics.current.percentage[metric.batteryId] = metric.batteryPercentage;

    // Update last invocation timestamp
    metrics.lastUpdated[metric.batteryId] = Date.now();

    // Save updated metrics
    await this.saveMetrics(metrics);

    this.logger(
      `BatteryMetricsStore: Updated battery ${metric.batteryId} - Discharged: ${metric.totalDischargedKwh} kWh, Charged: ${metric.totalChargedKwh} kWh, Percentage: ${metric.batteryPercentage}%`,
    );

    // Calculate and return aggregated metrics
    return this.calculateAggregatedMetrics(metrics);
  }

  /**
   * Store a battery daily metric update (for batteries that report daily values directly)
   * @param metric Battery daily metric with today's values (no delta calculation needed)
   * @returns Aggregated metrics across all batteries
   */
  async storeDailyMetric(metric: BatteryDailyMetric): Promise<ExternalBatteryMetrics> {
    let metrics = await this.getStoredMetrics();

    // Check if we need to reset for new day
    metrics = await this.checkAndResetIfNeeded(metrics);

    // Store daily values directly (no startOfDay tracking needed)
    metrics.dailyOnly.dailyCharged[metric.batteryId] = metric.dailyChargedKwh;
    metrics.dailyOnly.dailyDischarged[metric.batteryId] = metric.dailyDischargedKwh;
    metrics.dailyOnly.percentage[metric.batteryId] = metric.batteryPercentage;

    // Update last invocation timestamp
    metrics.lastUpdated[metric.batteryId] = Date.now();

    // Save updated metrics
    await this.saveMetrics(metrics);

    this.logger(
      `BatteryMetricsStore: Updated daily battery ${metric.batteryId} -`,
      `Daily Discharged: ${metric.dailyDischargedKwh} kWh, Daily Charged: ${metric.dailyChargedKwh} kWh,`,
      `Percentage: ${metric.batteryPercentage}%`,
    );

    // Calculate and return aggregated metrics
    return this.calculateAggregatedMetrics(metrics);
  }

  /**
   * Get current aggregated metrics without storing new data
   */
  async getAggregatedMetrics(): Promise<ExternalBatteryMetrics> {
    let metrics = await this.getStoredMetrics();
    metrics = await this.checkAndResetIfNeeded(metrics);
    return this.calculateAggregatedMetrics(metrics);
  }

  /**
   * Calculate aggregated metrics from stored data
   */
  private calculateAggregatedMetrics(metrics: StoredMetrics): ExternalBatteryMetrics {
    const batteries: ExternalBatteryMetrics['batteries'] = [];

    let totalDailyCharged = 0;
    let totalDailyDischarged = 0;
    let totalCurrentCharged = 0;
    let totalCurrentDischarged = 0;
    let totalStartOfDayCharged = 0;
    let totalStartOfDayDischarged = 0;
    let totalPercentage = 0;
    let batteryCount = 0;

    // Process cumulative batteries (with delta calculation)
    const cumulativeBatteryIds = Object.keys(metrics.current.discharged);
    for (const batteryId of cumulativeBatteryIds) {
      const currentDischarged = metrics.current.discharged[batteryId] || 0;
      const currentCharged = metrics.current.charged[batteryId] || 0;
      const startDischarged = metrics.startOfDay.discharged[batteryId] || currentDischarged;
      const startCharged = metrics.startOfDay.charged[batteryId] || currentCharged;
      const percentage = metrics.current.percentage[batteryId] || 0;

      // Calculate daily delta
      const dailyDischarged = Math.max(0, currentDischarged - startDischarged);
      const dailyCharged = Math.max(0, currentCharged - startCharged);

      batteries.push({
        id: batteryId,
        dailyChargedKwh: dailyCharged,
        dailyDischargedKwh: dailyDischarged,
        currentChargedKwh: currentCharged,
        currentDischargedKwh: currentDischarged,
        percentage,
      });

      totalDailyDischarged += dailyDischarged;
      totalDailyCharged += dailyCharged;
      totalCurrentCharged += currentCharged;
      totalCurrentDischarged += currentDischarged;
      totalStartOfDayCharged += startCharged;
      totalStartOfDayDischarged += startDischarged;
      totalPercentage += percentage;
      batteryCount++;
    }

    // Process daily-only batteries (direct values, no delta calculation)
    const dailyOnlyBatteryIds = Object.keys(metrics.dailyOnly.dailyCharged);
    for (const batteryId of dailyOnlyBatteryIds) {
      const dailyCharged = metrics.dailyOnly.dailyCharged[batteryId] || 0;
      const dailyDischarged = metrics.dailyOnly.dailyDischarged[batteryId] || 0;
      const percentage = metrics.dailyOnly.percentage[batteryId] || 0;

      batteries.push({
        id: batteryId,
        dailyChargedKwh: dailyCharged,
        dailyDischargedKwh: dailyDischarged,
        currentChargedKwh: 0, // Daily-only batteries don't track cumulative values
        currentDischargedKwh: 0,
        percentage,
      });

      totalDailyDischarged += dailyDischarged;
      totalDailyCharged += dailyCharged;
      // Don't add to current totals for daily-only batteries
      totalPercentage += percentage;
      batteryCount++;
    }

    const aggregated: ExternalBatteryMetrics = {
      dailyChargedKwh: totalDailyCharged,
      dailyDischargedKwh: totalDailyDischarged,
      currentChargedKwh: totalCurrentCharged,
      currentDischargedKwh: totalCurrentDischarged,
      startOfDayChargedKwh: totalStartOfDayCharged,
      startOfDayDischargedKwh: totalStartOfDayDischarged,
      averageBatteryPercentage: batteryCount > 0 ? totalPercentage / batteryCount : 0,
      batteryCount,
      batteries,
      lastUpdated: Date.now(),
    };

    this.logger(
      `BatteryMetricsStore: Aggregated metrics - Daily charged: ${aggregated.dailyChargedKwh.toFixed(2)} kWh,`,
      `Daily discharged: ${aggregated.dailyDischargedKwh.toFixed(2)} kWh,`,
      `Current total charged: ${aggregated.currentChargedKwh.toFixed(2)} kWh,`,
      `Current total discharged: ${aggregated.currentDischargedKwh.toFixed(2)} kWh,`,
      `Start of day charged: ${aggregated.startOfDayChargedKwh.toFixed(2)} kWh,`,
      `Start of day discharged: ${aggregated.startOfDayDischargedKwh.toFixed(2)} kWh,`,
      `Avg percentage: ${aggregated.averageBatteryPercentage.toFixed(1)}%, Batteries: ${batteryCount}`,
    );

    return aggregated;
  }

  /**
   * Remove a battery from tracking
   */
  async removeBattery(batteryId: string): Promise<void> {
    const metrics = await this.getStoredMetrics();

    delete metrics.current.discharged[batteryId];
    delete metrics.current.charged[batteryId];
    delete metrics.current.percentage[batteryId];
    delete metrics.startOfDay.discharged[batteryId];
    delete metrics.startOfDay.charged[batteryId];
    delete metrics.lastUpdated[batteryId];

    await this.saveMetrics(metrics);
    this.logger(`BatteryMetricsStore: Removed battery ${batteryId}`);
  }

  /**
   * Get list of tracked battery IDs
   */
  async getTrackedBatteries(): Promise<string[]> {
    const metrics = await this.getStoredMetrics();
    return Object.keys(metrics.current.discharged);
  }

  /**
   * Get last update timestamp for a specific battery
   * @param batteryId Battery identifier
   * @returns Timestamp in milliseconds since epoch, or undefined if battery not found
   */
  async getLastUpdateTime(batteryId: string): Promise<number | undefined> {
    const metrics = await this.getStoredMetrics();
    return metrics.lastUpdated[batteryId];
  }

  /**
   * Clear all stored metrics (useful for testing or reset)
   */
  async clear(): Promise<void> {
    await this.device.unsetStoreValue(this.storeKey);
    this.logger('BatteryMetricsStore: Cleared all metrics');
  }

  /**
   * Schedule automatic daily reset at 00:00 (Europe/Amsterdam timezone)
   * Called on device init to ensure proper daily baseline management
   */
  scheduleAutomaticReset(): void {
    // Calculate milliseconds until next 00:00 (Amsterdam timezone)
    const now = new Date();

    // Get current Amsterdam date/time
    const amsterdamNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));

    // Calculate next 00:00 in Amsterdam time
    const next00Amsterdam = new Date(amsterdamNow);
    next00Amsterdam.setDate(next00Amsterdam.getDate() + 1);
    next00Amsterdam.setHours(0, 0, 0, 0);

    // Convert back to UTC for scheduling
    const offset = amsterdamNow.getTime() - now.getTime();
    const next00UTC = new Date(next00Amsterdam.getTime() - offset);

    const msUntilReset = next00UTC.getTime() - now.getTime();

    // Schedule first reset using Homey's setTimeout (auto-cleanup on app restart)
    this.resetTimeout = this.device.homey.setTimeout(async () => {
      await this.performAutomaticReset();

      // Then schedule daily resets every 24 hours using setInterval
      this.resetInterval = this.device.homey.setInterval(
        async () => {
          await this.performAutomaticReset();
        },
        24 * 60 * 60 * 1000, // 24 hours
      );
    }, msUntilReset);

    this.logger(
      `BatteryMetricsStore: Scheduled automatic reset at 00:00 Amsterdam time (${(msUntilReset / 1000 / 60).toFixed(0)} minutes from now)`,
    );
  }

  /**
   * Perform the actual reset at 00:00
   * Sets startOfDay = current (last known values from previous day)
   * Ensures delta calculation starts correctly for new day
   */
  private async performAutomaticReset(): Promise<void> {
    let metrics = await this.getStoredMetrics();
    const currentDate = this.getCurrentDate();

    if (metrics.lastResetDate !== currentDate) {
      // Calculate aggregated metrics BEFORE reset to log daily totals
      const aggregatedBefore = this.calculateAggregatedMetrics(metrics);

      // Notify device BEFORE reset with daily totals
      if (this.onBeforeAutomaticReset) {
        try {
          await this.onBeforeAutomaticReset(
            aggregatedBefore.dailyChargedKwh,
            aggregatedBefore.dailyDischargedKwh,
          );
        } catch (error) {
          this.logger('Error calling onBeforeAutomaticReset callback:', error);
        }
      }

      // Set startOfDay = current (captures last known values from previous day)
      metrics.startOfDay.discharged = { ...metrics.current.discharged };
      metrics.startOfDay.charged = { ...metrics.current.charged };

      // Reset daily-only counters
      metrics.dailyOnly.dailyCharged = {};
      metrics.dailyOnly.dailyDischarged = {};

      metrics.lastResetDate = currentDate;
      await this.saveMetrics(metrics);

      this.logger(
        'BatteryMetricsStore: Automatic 00:00 reset executed.',
        `startOfDay set to current values for new day's delta calculation.`,
      );

      // Notify device about automatic reset AFTER reset
      if (this.onAutomaticReset) {
        try {
          await this.onAutomaticReset();
        } catch (error) {
          this.logger('Error calling onAutomaticReset callback:', error);
        }
      }
    }
  }

  /**
   * Emergency reset requested by user (via flow card)
   * Sets startOfDay = current immediately for recovery
   * Use when initialization detected incorrect values
   *
   * @param batteryId Optional - reset specific battery, or all if undefined
   */
  async emergencyResetBaseline(batteryId?: string): Promise<void> {
    let metrics = await this.getStoredMetrics();

    if (batteryId) {
      // Reset specific battery
      metrics.startOfDay.discharged[batteryId] = metrics.current.discharged[batteryId] ?? 0;
      metrics.startOfDay.charged[batteryId] = metrics.current.charged[batteryId] ?? 0;
      this.logger(
        `EMERGENCY RESET: Baseline for battery ${batteryId} set to current values.`,
        `Delta will be correct from next measurement.`,
      );
    } else {
      // Reset all batteries
      metrics.startOfDay.discharged = { ...metrics.current.discharged };
      metrics.startOfDay.charged = { ...metrics.current.charged };
      this.logger(
        `EMERGENCY RESET: Baseline for all batteries set to current values.`,
        `Delta will be correct from next measurement.`,
      );
    }

    await this.saveMetrics(metrics);
  }

  /**
   * Cleanup on device destroy
   * Must be called in device.onUninit()
   */
  destroy(): void {
    if (this.resetTimeout) {
      this.device.homey.clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
    if (this.resetInterval) {
      this.device.homey.clearInterval(this.resetInterval);
      this.resetInterval = null;
    }
    this.logger('BatteryMetricsStore: Cleanup completed');
  }
}
