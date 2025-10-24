/**
 * Frank Energie Battery Trading Library
 *
 * Barrel export file for easy imports
 */

// Frank Energie API Client
export {
  FrankEnergieClient,
  type FrankEnergieAuth,
  type FrankEnergieClientConfig,
  type SmartBattery,
  type BatterySettings,
  type BatterySession,
  type SmartBatterySessionData,
} from './frank-energie-client';

// Onbalansmarkt API Client
export {
  OnbalansmarktClient,
  type OnbalansmarktClientConfig,
  type OnbalansmarktMeasurement,
  type TradingMode,
  type ResultType,
  type DailyResult,
  type ProfileResponse,
} from './onbalansmarkt-client';

// Battery Aggregator
export {
  BatteryAggregator,
  type BatteryAggregatorConfig,
  type AggregatedResults,
  type BatteryError,
} from './battery-aggregator';

// Trading Mode Detector
export {
  TradingModeDetector,
  type TradingModeResult,
} from './trading-mode-detector';

// Device Base Class
export {
  FrankEnergieDeviceBase,
} from './frank-energie-device-base';

// Additional Frank Energie Client Types (PV, EV, Meter)
export {
  type SmartPvSystem,
  type SmartPvSystemSummary,
  type SmartFeedInSessionData,
  type EnodeSessionData,
  type EnodeSession,
  type MarketPricesData,
  type WeightedAveragePricesData,
  type MonthSummaryData,
  type MonthInsightsData,
  type PeriodUsageAndCostsData,
  type CostsDeltaData,
} from './frank-energie-client';
