/**
 * Frank Energie Battery Trading Library
 *
 * Barrel export file for easy imports
 */

// App Type Definitions
export {
  type FrankEnergieApp,
  type AppCredentials,
  isFrankEnergieApp,
} from './app-types';

// Frank Energie API Client
export {
  FrankEnergieClient,
  type FrankEnergieAuth,
  type FrankEnergieClientConfig,
  type SmartBattery,
  type SmartBatterySummary,
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

// Battery Metrics Store
export {
  BatteryMetricsStore,
  type BatteryMetricsStoreConfig,
  type BatteryMetric,
  type BatteryDailyMetric,
  type ExternalBatteryMetrics,
} from './battery-metrics-store';

// Device Base Class
export { default as FrankEnergieDeviceBase } from './frank-energie-device-base';

// Flow Card Types
export type {
  ResultPositiveNegativeArgs,
  MilestoneReachedArgs,
  TriggerOnlyDeviceArgs,
  ResultPositiveArgs,
  ResultExceedsThresholdArgs,
  TradingModeMatchesArgs,
  FrankSlimActiveArgs,
  RankInTopXArgs,
  ConditionOnlyDeviceArgs,
  SendNotificationArgs,
  SendRichNotificationArgs,
  ToggleMeasurementSendingArgs,
  LogToTimelineArgs,
  ActionOnlyDeviceArgs,
  ReceiveBatteryMetricsArgs,
  ReceiveBatteryDailyMetricsArgs,
} from './flow-card-types';

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
  type Connection,
  type MeData,
} from './frank-energie-client';
