/**
 * Battery Aggregator
 *
 * Aggregates trading results across multiple batteries registered
 * to a single Frank Energie account.
 */

import type { FrankEnergieClient, SmartBattery, SmartBatterySessionData } from './frank-energie-client';

export interface BatteryError {
  batteryId: string;
  batteryName: string;
  error: string;
}

export interface AggregatedResults {
  /** Total result for the period (kortingsfactuur) */
  periodTotalResult: number;
  /** Cumulative total trading result since start */
  totalTradingResult: number;
  /** EPEX correction result for period */
  periodEpexResult: number;
  /** Trading result for period */
  periodTradingResult: number;
  /** Frank Slim discount for period */
  periodFrankSlim: number;
  /** Imbalance result for period */
  periodImbalanceResult: number;
  /** Number of batteries included in aggregation */
  batteryCount: number;
  /** Individual battery session data */
  sessions: SmartBatterySessionData[];
  /** Batteries that failed to fetch data */
  failedBatteries: BatteryError[];
}

export interface BatteryAggregatorConfig {
  frankEnergieClient: FrankEnergieClient;
  logger?: (message: string, ...args: unknown[]) => void;
}

export class BatteryAggregator {
  private frankClient: FrankEnergieClient;
  private logger: (message: string, ...args: unknown[]) => void;

  constructor(config: BatteryAggregatorConfig) {
    this.frankClient = config.frankEnergieClient;
    this.logger = config.logger || (() => {});
  }

  /**
   * Get aggregated trading results for all batteries on the account
   * for a specific date range
   * @param startDate Start date
   * @param endDate End date
   * @returns Aggregated results across all batteries
   */
  async getAggregatedResults(startDate: Date, endDate: Date): Promise<AggregatedResults> {
    if (!this.frankClient.isAuthenticated()) {
      throw new Error('Frank Energie client is not authenticated');
    }

    // Get all batteries
    const batteries: SmartBattery[] = await this.frankClient.getSmartBatteries();

    if (batteries.length === 0) {
      throw new Error('No batteries found on account');
    }

    this.logger(`BatteryAggregator: Processing ${batteries.length} batteries`);

    // Initialize accumulators
    const results: AggregatedResults = {
      periodTotalResult: 0,
      totalTradingResult: 0,
      periodEpexResult: 0,
      periodTradingResult: 0,
      periodFrankSlim: 0,
      periodImbalanceResult: 0,
      batteryCount: batteries.length,
      sessions: [],
      failedBatteries: [],
    };

    // Fetch and accumulate session data for each battery
    for (const battery of batteries) {
      try {
        const sessionData = await this.frankClient.getSmartBatterySessions(
          battery.id,
          startDate,
          endDate,
        );

        // Accumulate results
        results.periodTotalResult += sessionData.periodTotalResult;
        results.periodEpexResult += sessionData.periodEpexResult;
        results.periodTradingResult += sessionData.periodTradingResult;
        results.periodFrankSlim += sessionData.periodFrankSlim;
        results.periodImbalanceResult += sessionData.periodImbalanceResult;

        // Accumulate cumulative result from first session
        if (sessionData.sessions.length > 0) {
          results.totalTradingResult += sessionData.sessions[0].cumulativeResult;
        }

        // Store individual session data for reference
        results.sessions.push(sessionData);

        this.logger(
          `BatteryAggregator: Battery ${battery.id} - Period: €${sessionData.periodTradingResult.toFixed(2)}, Total: €${sessionData.sessions[0]?.cumulativeResult.toFixed(2) || '0.00'}`,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger(`BatteryAggregator: Error fetching sessions for battery ${battery.id}: ${errorMessage}`);

        // Track failed battery
        results.failedBatteries.push({
          batteryId: battery.id,
          batteryName: battery.externalReference || `Battery ${battery.id.slice(0, 8)}`,
          error: errorMessage,
        });
      }
    }

    // Check if all batteries failed
    if (results.failedBatteries.length === batteries.length) {
      throw new Error(`Failed to fetch data from all ${batteries.length} batteries`);
    }

    // Log warning if some batteries failed
    if (results.failedBatteries.length > 0) {
      this.logger(
        `BatteryAggregator: Warning - ${results.failedBatteries.length} of ${batteries.length} batteries failed to fetch data`,
        results.failedBatteries,
      );
    }

    this.logger('BatteryAggregator: Aggregation complete', {
      successfulBatteries: results.sessions.length,
      failedBatteries: results.failedBatteries.length,
      periodTotalResult: results.periodTotalResult.toFixed(2),
      totalTradingResult: results.totalTradingResult.toFixed(2),
      periodEpexResult: results.periodEpexResult.toFixed(2),
      periodTradingResult: results.periodTradingResult.toFixed(2),
      periodFrankSlim: results.periodFrankSlim.toFixed(2),
      periodImbalanceResult: results.periodImbalanceResult.toFixed(2),
    });

    return results;
  }

  /**
   * Calculate scaled energy values based on battery count
   * Used when you have average import/export values that need to be
   * multiplied by the number of participating batteries
   * @param averageValue Average value per battery
   * @param batteryCount Number of batteries
   * @returns Scaled value
   */
  static scaleEnergyValue(averageValue: number | null, batteryCount: number): number | null {
    if (averageValue === null) {
      return null;
    }
    return averageValue * batteryCount;
  }
}
