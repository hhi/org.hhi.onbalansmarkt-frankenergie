/**
 * Trading Mode Detector
 *
 * Determines the appropriate Onbalansmarkt trading mode based on
 * Frank Energie battery settings (batteryMode and imbalanceTradingStrategy).
 */

import type { BatterySettings } from './frank-energie-client';
import type { TradingMode } from './onbalansmarkt-client';

export interface TradingModeResult {
  mode: TradingMode;
  batteryMode: string;
  tradingStrategy: string | null;
}

export class TradingModeDetector {
  /**
   * Determine Onbalansmarkt trading mode from Frank Energie battery settings
   * @param settings Battery settings from Frank Energie API
   * @returns Trading mode information
   */
  static detectTradingMode(settings: BatterySettings): TradingModeResult {
    const batteryMode = settings.batteryMode;
    const tradingStrategy = settings.imbalanceTradingStrategy;

    let mode: TradingMode = 'imbalance'; // Default mode

    // Determine mode based on battery settings
    if (batteryMode === 'IMBALANCE_TRADING' && tradingStrategy === 'STANDARD') {
      mode = 'imbalance';
    } else if (batteryMode === 'IMBALANCE_TRADING' && tradingStrategy === 'AGGRESSIVE') {
      mode = 'imbalance_aggressive';
    } else if (batteryMode === 'SELF_CONSUMPTION_MIX') {
      mode = 'self_consumption_plus';
    } else {
      mode = 'manual';
    }

    return {
      mode,
      batteryMode,
      tradingStrategy,
    };
  }

  /**
   * Get human-readable description of trading mode
   * @param mode Trading mode
   * @returns Description in English
   */
  static getTradingModeDescription(mode: TradingMode): string {
    const descriptions: Record<TradingMode, string> = {
      imbalance: 'Imbalance Trading (Standard)',
      imbalance_aggressive: 'Imbalance Trading (Aggressive)',
      manual: 'Manual Mode',
      day_ahead: 'Day-Ahead Trading',
      self_consumption: 'Self Consumption',
      self_consumption_plus: 'Self Consumption Plus',
    };

    return descriptions[mode] || mode;
  }

  /**
   * Get localized trading mode description
   * @param mode Trading mode
   * @param language Language code ('en' or 'nl')
   * @returns Localized description
   */
  static getLocalizedDescription(mode: TradingMode, language: 'en' | 'nl' = 'en'): string {
    const translations: Record<'en' | 'nl', Record<TradingMode, string>> = {
      en: {
        imbalance: 'Imbalance Trading (Standard)',
        imbalance_aggressive: 'Imbalance Trading (Aggressive)',
        manual: 'Manual Mode',
        day_ahead: 'Day-Ahead Trading',
        self_consumption: 'Self Consumption',
        self_consumption_plus: 'Self Consumption Plus',
      },
      nl: {
        imbalance: 'Onbalanshandel (Standaard)',
        imbalance_aggressive: 'Onbalanshandel (Agressief)',
        manual: 'Handmatige Modus',
        day_ahead: 'Day-Ahead Handel',
        self_consumption: 'Eigen Verbruik',
        self_consumption_plus: 'Eigen Verbruik Plus',
      },
    };

    return translations[language][mode] || mode;
  }
}
