import {
  FrankEnergieDeviceBase,
  type MarketPricesData,
  type MonthSummaryData,
  type PeriodUsageAndCostsData,
} from '../../lib';

/**
 * Meter/Site Device
 *
 * Manages overall site energy usage, costs, and market prices.
 * Provides pricing and usage analytics.
 */
export = class MeterSiteDevice extends FrankEnergieDeviceBase {
  private siteReference: string | null = null;

  // Meter-specific state tracking
  private previousUsage: number = 0;
  private previousCosts: number = 0;
  private previousMarketPrice: number = 0;
  private costMilestones: Set<number> = new Set();

  /**
   * Initialize meter-specific clients
   */
  async initializeDeviceSpecificClients(): Promise<void> {
    if (!this.frankEnergieClient) {
      throw new Error('FrankEnergieClient not initialized');
    }

    // Get configured site reference
    this.siteReference = this.getSetting('site_reference') as string;
    if (!this.siteReference) {
      throw new Error('Site reference not configured');
    }

    this.log(`Meter configured for site: ${this.siteReference}`);
  }

  /**
   * Setup meter-specific flow cards
   */
  setupDeviceSpecificFlowCards(): void {
    // Meter-specific flow cards would be defined similarly
    // For now, leverage inherited ranking and measurement cards
    this.log('Meter-specific flow cards registered');
  }

  /**
   * Override resetMilestones to clear meter-specific milestone sets
   */
  protected resetMilestones(): void {
    super.resetMilestones();
    this.costMilestones.clear();
    this.log('Meter device milestones reset');
  }

  /**
   * Poll meter and pricing data
   */
  async pollData(): Promise<void> {
    if (!this.frankEnergieClient || !this.siteReference) {
      throw new Error('Clients not initialized');
    }

    // Check if milestones should be reset (monthly)
    await this.checkAndResetMilestones();

    try {
      // Get today's market prices
      const now = new Date();
      const marketPrices = await this.frankEnergieClient.getMarketPrices(this.siteReference, now);

      // Get month summary
      const monthSummary = await this.frankEnergieClient.getMonthSummary(this.siteReference);

      // Get period usage and costs
      const yearMonth = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }).slice(0, 7);
      const periodUsageAndCosts = await this.frankEnergieClient.getPeriodUsageAndCosts(this.siteReference, yearMonth);

      // Update capabilities
      await this.updateCapabilities(marketPrices, monthSummary, periodUsageAndCosts);

      // Emit flow triggers
      await this.processMeterFlowCardTriggers(monthSummary, periodUsageAndCosts);

      // Store last poll data
      await this.setStoreValue('lastPollTime', Date.now());
      await this.setStoreValue('lastMarketPrice', marketPrices.averageElectricityPrices.averageMarketPrice);
      await this.setStoreValue('lastMonthCosts', monthSummary.actualCostsUntilLastMeterReadingDate);
      await this.setStoreValue('lastUsage', periodUsageAndCosts.electricity.usageTotal);

      await this.setAvailable();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Poll meter data failed:', errorMsg);
      await this.setUnavailable(`Data fetch failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Update device capabilities with meter data
   */
  private async updateCapabilities(
    prices: MarketPricesData,
    monthSummary: MonthSummaryData,
    usage: PeriodUsageAndCostsData,
  ): Promise<void> {
    const updatePromises: Promise<void>[] = [];

    // Update usage capability
    updatePromises.push(
      this.setCapabilityValue('frank_energie_site_usage', usage.electricity.usageTotal)
        .catch((error) => this.error('Failed to update site usage:', error)),
    );

    // Update costs capability
    updatePromises.push(
      this.setCapabilityValue('frank_energie_site_costs', monthSummary.actualCostsUntilLastMeterReadingDate)
        .catch((error) => this.error('Failed to update site costs:', error)),
    );

    // Update power meter with current average price as indicator
    updatePromises.push(
      this.setCapabilityValue('meter_power', Math.round(prices.averageElectricityPrices.averageMarketPrice * 100))
        .catch((error) => this.error('Failed to update meter_power:', error)),
    );

    // Update measure_power with actual usage
    updatePromises.push(
      this.setCapabilityValue('measure_power', Math.round(usage.electricity.usageTotal * 1000))
        .catch((error) => this.error('Failed to update measure_power:', error)),
    );

    // eslint-disable-next-line node/no-unsupported-features/es-builtins
    await Promise.allSettled(updatePromises);

    this.log(
      `Meter Capabilities updated - Usage: ${usage.electricity.usageTotal.toFixed(2)} kWh, `
      + `Costs: €${monthSummary.actualCostsUntilLastMeterReadingDate.toFixed(2)}, `
      + `Avg Price: €${prices.averageElectricityPrices.averageMarketPrice.toFixed(4)}/kWh`,
    );
  }

  /**
   * Process and emit meter-specific flow triggers
   */
  private async processMeterFlowCardTriggers(
    monthSummary: MonthSummaryData,
    usage: PeriodUsageAndCostsData,
  ): Promise<void> {
    try {
      // Check usage change
      if (this.previousUsage !== usage.electricity.usageTotal) {
        this.log(
          `Site usage updated: ${usage.electricity.usageTotal.toFixed(2)} kWh `
          + `(change: ${(usage.electricity.usageTotal - this.previousUsage).toFixed(2)} kWh)`,
        );
      }

      // Check cost milestones
      const costMilestones = [10, 25, 50, 100, 250, 500];
      for (const milestone of costMilestones) {
        if (this.previousCosts < milestone && monthSummary.actualCostsUntilLastMeterReadingDate >= milestone) {
          if (!this.costMilestones.has(milestone)) {
            this.log(`Monthly cost milestone reached: €${milestone}`);
            this.costMilestones.add(milestone);
          }
        }
      }

      this.previousUsage = usage.electricity.usageTotal;
      this.previousCosts = monthSummary.actualCostsUntilLastMeterReadingDate;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.error('Error processing meter flow triggers:', errorMsg);
    }
  }
};
