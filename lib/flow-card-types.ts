/**
 * Flow Card Argument Type Definitions
 *
 * These interfaces define the argument structures for all flow card handlers,
 * derived from the flow card definitions in .homeycompose/flow/
 */

import type Homey from 'homey';

// Base interface - all flow cards include the device
interface BaseFlowCardArgs {
  device: Homey.Device;
}

// ===== Trigger Card Arguments =====

export interface ResultPositiveNegativeArgs extends BaseFlowCardArgs {
  isPositive: 'positive' | 'negative';
}

export interface MilestoneReachedArgs extends BaseFlowCardArgs {
  threshold: number;
}

// Daily results, new battery, top performer, trading mode changed, frank slim, measurement sent
// use only the device argument
export type TriggerOnlyDeviceArgs = BaseFlowCardArgs;

// ===== Condition Card Arguments =====

export interface ResultPositiveArgs extends BaseFlowCardArgs {
  threshold: number;
}

export interface ResultExceedsThresholdArgs extends BaseFlowCardArgs {
  threshold: number;
}

export interface TradingModeMatchesArgs extends BaseFlowCardArgs {
  mode: string;
}

export interface FrankSlimActiveArgs extends BaseFlowCardArgs {
  threshold: number;
}

export interface RankInTopXArgs extends BaseFlowCardArgs {
  rankType: 'overall' | 'provider';
  threshold: number;
}

// Provider rank better uses only device
export type ConditionOnlyDeviceArgs = BaseFlowCardArgs;

// ===== Action Card Arguments =====

export interface SendNotificationArgs extends BaseFlowCardArgs {
  title: string;
  message: string;
  includeMetrics: boolean;
}

export interface SendRichNotificationArgs extends BaseFlowCardArgs {
  type: 'daily_summary' | 'ranking_update' | 'result_only' | 'monthly_milestone';
}

export interface ToggleMeasurementSendingArgs extends BaseFlowCardArgs {
  state: 'on' | 'off' | 'toggle';
}

export interface LogToTimelineArgs extends BaseFlowCardArgs {
  event: string;
  includeResult: boolean;
}

// Force data poll and update dashboard use only device
export type ActionOnlyDeviceArgs = BaseFlowCardArgs;

// ===== External Battery Metrics =====

export interface ReceiveBatteryMetricsArgs extends BaseFlowCardArgs {
  // eslint-disable-next-line camelcase
  battery_id: string;
  // eslint-disable-next-line camelcase
  total_charged_kwh: number;
  // eslint-disable-next-line camelcase
  total_discharged_kwh: number;
  // eslint-disable-next-line camelcase
  battery_percentage: number;
}

export interface ReceiveBatteryDailyMetricsArgs extends BaseFlowCardArgs {
  // eslint-disable-next-line camelcase
  battery_id: string;
  // eslint-disable-next-line camelcase
  daily_charged_kwh: number;
  // eslint-disable-next-line camelcase
  daily_discharged_kwh: number;
  // eslint-disable-next-line camelcase
  battery_percentage: number;
}
