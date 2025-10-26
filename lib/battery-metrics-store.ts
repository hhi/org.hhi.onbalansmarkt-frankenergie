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

export interface ExternalBatteryMetrics {
  dailyChargedKwh: number;
  dailyDischargedKwh: number;
  averageBatteryPercentage: number;
  batteryCount: number;
  batteries: Array<{
    id: string;
    dailyChargedKwh: number;
    dailyDischargedKwh: number;
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
  lastResetDate: string; // YYYY-MM-DD format
}

export interface BatteryMetricsStoreConfig {
  device: Device;
  logger?: (message: string, ...args: unknown[]) => void;
}

export class BatteryMetricsStore {
  private device: Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private readonly storeKey = 'batteryMetrics';

  constructor(config: BatteryMetricsStoreConfig) {
    this.device = config.device;
    this.logger = config.logger || (() => {});
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
        lastResetDate: this.getCurrentDate(),
      };
      await this.device.setStoreValue(this.storeKey, initial);
      return initial;
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
   */
  private async checkAndResetIfNeeded(metrics: StoredMetrics): Promise<StoredMetrics> {
    const currentDate = this.getCurrentDate();

    if (metrics.lastResetDate !== currentDate) {
      this.logger(`BatteryMetricsStore: New day detected (${metrics.lastResetDate} → ${currentDate}), resetting daily counters`);

      // Move current totals to startOfDay
      metrics.startOfDay.discharged = Object.assign({}, metrics.current.discharged);
      metrics.startOfDay.charged = Object.assign({}, metrics.current.charged);
      metrics.lastResetDate = currentDate;

      await this.saveMetrics(metrics);
    }

    return metrics;
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

    // Save updated metrics
    await this.saveMetrics(metrics);

    this.logger(
      `BatteryMetricsStore: Updated battery ${metric.batteryId} - Discharged: ${metric.totalDischargedKwh} kWh, Charged: ${metric.totalChargedKwh} kWh, Percentage: ${metric.batteryPercentage}%`,
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
    const batteryIds = Object.keys(metrics.current.discharged);
    const batteries: ExternalBatteryMetrics['batteries'] = [];

    let totalDailyCharged = 0;
    let totalDailyDischarged = 0;
    let totalPercentage = 0;
    let batteryCount = 0;

    for (const batteryId of batteryIds) {
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
        percentage,
      });

      totalDailyDischarged += dailyDischarged;
      totalDailyCharged += dailyCharged;
      totalPercentage += percentage;
      batteryCount++;
    }

    const aggregated: ExternalBatteryMetrics = {
      dailyChargedKwh: totalDailyCharged,
      dailyDischargedKwh: totalDailyDischarged,
      averageBatteryPercentage: batteryCount > 0 ? totalPercentage / batteryCount : 0,
      batteryCount,
      batteries,
      lastUpdated: Date.now(),
    };

    this.logger(
      `BatteryMetricsStore: Aggregated metrics - Daily charged: ${aggregated.dailyChargedKwh.toFixed(2)} kWh,`,
      `Daily discharged: ${aggregated.dailyDischargedKwh.toFixed(2)} kWh,`,
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
   * Clear all stored metrics (useful for testing or reset)
   */
  async clear(): Promise<void> {
    await this.device.unsetStoreValue(this.storeKey);
    this.logger('BatteryMetricsStore: Cleared all metrics');
  }
}
