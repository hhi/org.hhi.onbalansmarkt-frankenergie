/**
 * Frank Energie GraphQL API Client
 *
 * Handles authentication and data retrieval from Frank Energie's GraphQL API
 * for smart battery trading results and settings.
 */

export interface FrankEnergieAuth {
  authToken: string;
  refreshToken: string;
}

export interface SmartBattery {
  brand: string;
  capacity: number;
  createdAt: string;
  externalReference: string;
  id: string;
  maxChargePower: number;
  maxDischargePower: number;
  provider: string;
  updatedAt: string;
  settings?: BatterySettings;
}

export interface BatterySettings {
  aggressivenessPercentage: number;
  algorithm: string;
  batteryMode: string;
  createdAt: string;
  effectiveTill: string;
  imbalanceTradingAggressiveness: string;
  imbalanceTradingStrategy: string;
  selfConsumptionTradingAllowed: boolean;
  selfConsumptionTradingThresholdPrice: number;
  tradingAlgorithm: string;
  updatedAt: string;
  requestedUpdate?: {
    aggressivenessPercentage: number;
    batteryMode: string;
    effectiveFrom: string;
    imbalanceTradingStrategy: string;
  };
}

export interface BatterySession {
  cumulativeResult: number;
  date: string;
  result: number;
  status: string;
  tradeIndex: number | null;
}

export interface SmartBatterySummary {
  lastKnownStateOfCharge: number;
  lastKnownStatus: string;
  lastUpdate: string;
  totalResult: number;
}

export interface SettingOption {
  code?: string;
  selectable?: boolean;
  expectedCyclesPerDay?: number;
  expectedResultPercentDelta?: number;
  amount?: number;
}

export interface SettingField<T> {
  current: T;
  updatable: boolean;
  options?: SettingOption[];
  pending?: T | null;
  pendingValueEffectiveFrom?: string | null;
  requestUpdateBefore?: string;
  updateDelayedTill?: string;
  discountAmount?: number | null;
}

export interface DetailedBatterySettings {
  batteryMode: SettingField<string>;
  imbalanceTradingStrategy: SettingField<string>;
  selfConsumptionTradingAllowed: {
    current: boolean;
    updatable: boolean;
    discountAmount?: number | null;
  };
  selfConsumptionTradingThresholdPrice: SettingField<number>;
  lockedForUpdatesTill?: string | null;
}

export interface ConnectRequest {
  brand: string;
  error?: string | null;
  id: string;
  status: string;
}

// SmartPV System Interfaces
export interface SmartPvSystem {
  brand: string;
  connectionEAN: string;
  createdAt: string;
  deletedAt?: string | null;
  displayName?: string | null;
  externalReference: string;
  id: string;
  inverterSerialNumbers: string[];
  model?: string | null;
  onboardingStatus: string;
  provider: string;
  steeringStatus: string;
  updatedAt: string;
}

export interface SmartPvSystemSummary {
  operationalStatus: string;
  operationalStatusTimestamp: string;
  steeringStatus: string;
  totalBonus: number;
}

// User Service Interfaces
export interface UserServiceSubscription {
  endDate?: string;
  id: string;
  proposition: {
    product: string;
    countryCode: string;
  };
  startDate: string;
}

export interface UserSmartChargingStatus {
  hasAcceptedTerms: boolean;
  isActivated: boolean;
  isAvailableInCountry: boolean;
  needsSubscription: boolean;
  provider?: string;
  subscription?: UserServiceSubscription;
  userCreatedAt: string;
  userId: string;
}

export interface UserSmartFeedInStatus {
  hasAcceptedTerms: boolean;
  isActivated: boolean;
  isAppOnboardingAvailable: boolean;
  isAvailableInCountry: boolean;
  userCreatedAt: string;
  userId: string;
}

// Session & Pricing Interfaces
export interface FeedInSession {
  bonus: number;
  cumulativeBonus: number;
  date: string;
  status: string;
  volume: number;
}

export interface SmartFeedInSessionData {
  periodBonus: number;
  periodEndDate: string;
  periodStartDate: string;
  periodVolume: number;
  sessions: FeedInSession[];
}

export interface VehicleConfig {
  deadline: string;
  isSolarChargingEnabled: boolean;
  maximumChargeLimit: number;
  minimumChargeLimit: number;
}

export interface EnodeSession {
  batteryCapacity?: number | null;
  bonus?: number | null;
  chargedEnergy?: number | null;
  costs?: number | null;
  dumbSessionTheoreticalCost?: number | null;
  endCharge: number;
  epexCost?: number | null;
  initialCharge: number;
  isManaged?: boolean | null;
  locationId?: string | null;
  savings?: number | null;
  sessionEnd?: string | null;
  sessionId: string;
  sessionStart: string;
  userCompensation?: number | null;
  vehicleConfig: VehicleConfig;
}

export interface EnodeSessionData {
  totalBonus: number;
  totalChargedEnergy: number;
  totalCosts: number;
  totalSavings: number;
  rows: EnodeSession[];
}

export interface PriceComponent {
  name: string;
  value: number;
}

export interface HourlyPrice {
  id: string;
  from: string;
  till: string;
  date: string;
  marketPrice: number;
  marketPricePlus: number;
  allInPrice: number;
  perUnit: string;
  marketPricePlusComponents?: PriceComponent[] | null;
  allInPriceComponents?: PriceComponent[] | null;
}

export interface AveragePrice {
  averageMarketPrice: number;
  averageMarketPricePlus: number;
  averageAllInPrice?: number;
  perUnit: string;
  isWeighted?: boolean;
}

export interface MarketPricesData {
  id: string;
  averageElectricityPrices: AveragePrice;
  electricityPrices: HourlyPrice[];
  gasPrices: HourlyPrice[];
}

export interface WeightedAverageItem {
  _id: string;
  date: string;
  from: string;
  till: string;
  averageMarketPrice: number;
  averageMarketPricePlus: number;
  perUnit: string;
}

export interface WeightedAveragePricesCategory {
  averageMarketPrice: number;
  averageMarketPricePlus: number;
  perUnit: string;
  items: WeightedAverageItem[];
}

export interface WeightedAveragePricesData {
  _id: string;
  gas: WeightedAveragePricesCategory;
  electricity: WeightedAveragePricesCategory;
  feedIn: WeightedAveragePricesCategory;
}

export interface MonthSummaryData {
  _id: string;
  lastMeterReadingDate: string;
  expectedCostsUntilLastMeterReadingDate: number;
  actualCostsUntilLastMeterReadingDate: number;
  meterReadingDayCompleteness: number;
  gasExcluded: boolean;
}

export interface EnergyDifference {
  actualUsage: number;
  actualAverageUnitPrice: number;
  actualCosts: number;
  expectedUsage: number;
  expectedAverageUnitPrice: number;
  expectedCosts: number;
  unit: string;
}

export interface MonthInsightsData {
  _id: string;
  expectedCosts: number;
  expectedCostsGas: number;
  expectedCostsFixed: number;
  expectedCostsElectricity: number;
  expectedCostsFeedIn: number;
  expectedCostsUntilLastMeterReading: number;
  actualCostsUntilLastMeterReading: number;
  lastMeterReadingDate: string;
  invoiceId?: string;
  gasDifference: EnergyDifference;
  electricityDifference: EnergyDifference;
  feedInDifference: EnergyDifference;
  meterReadingDayCompleteness: number;
  gasExcluded: boolean;
}

export interface UsageItem {
  date: string;
  from: string;
  till: string;
  usage: number;
  costs: number;
  unit: string;
}

export interface UsageCategory {
  usageTotal: number;
  costsTotal: number;
  unit: string;
  items: UsageItem[];
}

export interface PeriodUsageAndCostsData {
  _id: string;
  gas: UsageCategory;
  electricity: UsageCategory;
  feedIn: UsageCategory;
}

export interface CostsDeltaItem {
  _id: string;
  date: string;
  expectedCosts: number;
  actualCosts: number;
}

export interface CostsDeltaData {
  _id: string;
  expectedCostsTotal: number;
  actualCostsTotal: number;
  items: CostsDeltaItem[];
  meterReadingDayCompleteness: number;
  gasExcluded: boolean;
}

export interface SmartBatterySessionData {
  deviceId: string;
  fairUsePolicyVerified: boolean;
  periodStartDate: string;
  periodEndDate: string;
  periodEpexResult: number;
  periodFrankSlim: number;
  periodImbalanceResult: number;
  periodTotalResult: number;
  periodTradeIndex: number | null;
  periodTradingResult: number;
  sessions: BatterySession[];
}

export interface FrankEnergieClientConfig {
  authToken?: string;
  refreshToken?: string;
  logger?: (message: string, ...args: unknown[]) => void;
}

const TIME_ZONE = 'Europe/Amsterdam';

export class FrankEnergieClient {
  private readonly dataUrl = 'https://graphql.frankenergie.nl/';
  private auth: FrankEnergieAuth | null = null;
  private logger: (message: string, ...args: unknown[]) => void;

  constructor(config: FrankEnergieClientConfig = {}) {
    this.logger = config.logger || (() => {});
    if (config.authToken && config.refreshToken) {
      this.auth = {
        authToken: config.authToken,
        refreshToken: config.refreshToken,
      };
    }
  }

  /**
   * Execute a GraphQL query against Frank Energie API
   */
  private async query<T>(queryData: {
    query: string;
    operationName: string;
    variables?: Record<string, unknown>;
  }): Promise<{ data: T; errors?: Array<{ message: string }> }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Homey/FrankV1',
    };

    if (this.auth) {
      headers.Authorization = `Bearer ${this.auth.authToken}`;
    }

    try {
      const response = await fetch(this.dataUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(queryData),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await response.json();

      if (data.errors) {
        for (const error of data.errors) {
          if (error.message === 'user-error:auth-not-authorised') {
            throw new Error('Authentication required or token expired');
          }
        }
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      return data as { data: T; errors?: Array<{ message: string }> };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger(`FrankEnergieClient query failed: ${errorMessage}`);
      throw new Error(`Request failed: ${errorMessage}`);
    }
  }

  /**
   * Authenticate with Frank Energie using email and password
   * @param email User email
   * @param password User password
   * @returns Authentication tokens
   */
  async login(email: string, password: string): Promise<FrankEnergieAuth> {
    const queryData = {
      query: `
        mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            authToken
            refreshToken
          }
        }
      `,
      operationName: 'Login',
      variables: { email, password },
    };

    const response = await this.query<{ login: FrankEnergieAuth }>(queryData);
    this.auth = response.data.login;
    this.logger('FrankEnergieClient: Successfully authenticated');
    return this.auth;
  }

  /**
   * Get all smart batteries registered to the authenticated account
   * @returns List of smart batteries
   */
  async getSmartBatteries(): Promise<SmartBattery[]> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartBatteries {
          smartBatteries {
            brand
            capacity
            createdAt
            externalReference
            id
            maxChargePower
            maxDischargePower
            provider
            updatedAt
          }
        }
      `,
      operationName: 'SmartBatteries',
    };

    const response = await this.query<{ smartBatteries: SmartBattery[] }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved ${response.data.smartBatteries.length} batteries`);
    return response.data.smartBatteries;
  }

  /**
   * Get trading session data for a specific battery and date range
   * @param deviceId Battery device ID
   * @param startDate Start date
   * @param endDate End date
   * @returns Battery session data including trading results
   */
  async getSmartBatterySessions(
    deviceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SmartBatterySessionData> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartBatterySessions($startDate: String!, $endDate: String!, $deviceId: String!) {
          smartBatterySessions(
            startDate: $startDate
            endDate: $endDate
            deviceId: $deviceId
          ) {
            deviceId
            fairUsePolicyVerified
            periodStartDate
            periodEndDate
            periodEpexResult
            periodFrankSlim
            periodImbalanceResult
            periodTotalResult
            periodTradeIndex
            periodTradingResult
            sessions {
              cumulativeResult
              date
              result
              status
              tradeIndex
            }
          }
        }
      `,
      operationName: 'SmartBatterySessions',
      variables: {
        deviceId,
        startDate: startDate.toLocaleDateString('en-CA', { timeZone: TIME_ZONE }),
        endDate: endDate.toLocaleDateString('en-CA', { timeZone: TIME_ZONE }),
      },
    };

    const response = await this.query<{ smartBatterySessions: SmartBatterySessionData }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved session data for device ${deviceId}`);
    return response.data.smartBatterySessions;
  }

  /**
   * Get detailed battery information including settings and trading strategy
   * @param deviceId Battery device ID
   * @returns Detailed battery information
   */
  async getSmartBattery(deviceId: string): Promise<SmartBattery> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartBattery($deviceId: String!) {
          smartBattery(deviceId: $deviceId) {
            brand
            capacity
            createdAt
            externalReference
            id
            maxChargePower
            maxDischargePower
            provider
            updatedAt
            settings {
              aggressivenessPercentage
              algorithm
              batteryMode
              createdAt
              effectiveTill
              imbalanceTradingAggressiveness
              imbalanceTradingStrategy
              selfConsumptionTradingAllowed
              selfConsumptionTradingThresholdPrice
              tradingAlgorithm
              updatedAt
              requestedUpdate {
                aggressivenessPercentage
                batteryMode
                effectiveFrom
                imbalanceTradingStrategy
              }
            }
          }
        }
      `,
      operationName: 'SmartBattery',
      variables: { deviceId },
    };

    const response = await this.query<{ smartBattery: SmartBattery }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved battery details for ${deviceId}`);
    return response.data.smartBattery;
  }

  /**
   * Get real-time summary data for a specific battery
   * @param deviceId Battery device ID
   * @returns Battery summary including charge level, status, and trading results
   */
  async getSmartBatterySummary(deviceId: string): Promise<SmartBatterySummary> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartBatterySummary($deviceId: String!) {
          smartBatterySummary(deviceId: $deviceId) {
            lastKnownStateOfCharge
            lastKnownStatus
            lastUpdate
            totalResult
          }
        }
      `,
      operationName: 'SmartBatterySummary',
      variables: { deviceId },
    };

    const response = await this.query<{ smartBatterySummary: SmartBatterySummary }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved battery summary for ${deviceId}`);
    return response.data.smartBatterySummary;
  }

  /**
   * Get detailed settings for a specific battery including options and update status
   * @param deviceId Battery device ID
   * @returns Detailed battery settings with available options and update information
   */
  async getSmartBatterySettings(deviceId: string): Promise<DetailedBatterySettings> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartBatterySettings($deviceId: String!) {
          smartBatterySettings(deviceId: $deviceId) {
            batteryMode {
              current
              updatable
              options {
                code
                selectable
              }
              pending
              pendingValueEffectiveFrom
              requestUpdateBefore
              updateDelayedTill
            }
            imbalanceTradingStrategy {
              current
              updatable
              options {
                code
                expectedCyclesPerDay
                expectedResultPercentDelta
              }
              pending
              pendingValueEffectiveFrom
              requestUpdateBefore
              updateDelayedTill
            }
            selfConsumptionTradingAllowed {
              current
              discountAmount
              updatable
            }
            selfConsumptionTradingThresholdPrice {
              current
              updatable
              options {
                amount
                expectedResultPercentDelta
              }
            }
            lockedForUpdatesTill
          }
        }
      `,
      operationName: 'SmartBatterySettings',
      variables: { deviceId },
    };

    const response = await this.query<{ smartBatterySettings: DetailedBatterySettings }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved detailed settings for battery ${deviceId}`);
    return response.data.smartBatterySettings;
  }

  /**
   * Get pending battery connection requests for device pairing
   * @returns List of batteries waiting to be connected
   */
  async getSmartBatteryConnectRequests(): Promise<ConnectRequest[]> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartBatteryGetConnectRequests {
          smartBatteryConnectRequests {
            brand
            error
            id
            status
          }
        }
      `,
      operationName: 'SmartBatteryGetConnectRequests',
    };

    const response = await this.query<{ smartBatteryConnectRequests: ConnectRequest[] }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved ${response.data.smartBatteryConnectRequests.length} battery connect requests`);
    return response.data.smartBatteryConnectRequests;
  }

  // ===== SmartPV System Methods =====

  /**
   * Get all smart PV systems registered to the authenticated account
   * @returns List of smart PV systems
   */
  async getSmartPvSystems(): Promise<SmartPvSystem[]> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartPvSystems {
          smartPvSystems {
            brand
            connectionEAN
            createdAt
            deletedAt
            displayName
            externalReference
            id
            inverterSerialNumbers
            model
            onboardingStatus
            provider
            steeringStatus
            updatedAt
          }
        }
      `,
      operationName: 'SmartPvSystems',
    };

    const response = await this.query<{ smartPvSystems: SmartPvSystem[] }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved ${response.data.smartPvSystems.length} PV systems`);
    return response.data.smartPvSystems;
  }

  /**
   * Get real-time summary data for a specific PV system
   * @param deviceId PV system device ID
   * @returns PV system summary including operational status and bonus
   */
  async getSmartPvSystemSummary(deviceId: string): Promise<SmartPvSystemSummary> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartPvSystemSummary($deviceId: String!) {
          smartPvSystemSummary(deviceId: $deviceId) {
            operationalStatus
            operationalStatusTimestamp
            steeringStatus
            totalBonus
          }
        }
      `,
      operationName: 'SmartPvSystemSummary',
      variables: { deviceId },
    };

    const response = await this.query<{ smartPvSystemSummary: SmartPvSystemSummary }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved PV system summary for ${deviceId}`);
    return response.data.smartPvSystemSummary;
  }

  /**
   * Get pending PV system connection requests for device pairing
   * @returns List of PV systems waiting to be connected
   */
  async getSmartPvSystemConnectRequests(): Promise<ConnectRequest[]> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartPvSystemGetConnectRequests {
          smartPvSystemConnectRequests {
            brand
            error
            id
            status
          }
        }
      `,
      operationName: 'SmartPvSystemGetConnectRequests',
    };

    const response = await this.query<{ smartPvSystemConnectRequests: ConnectRequest[] }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved ${response.data.smartPvSystemConnectRequests.length} PV system connect requests`);
    return response.data.smartPvSystemConnectRequests;
  }

  // ===== User Service Methods =====

  /**
   * Get smart charging service status
   * @returns Smart charging activation and subscription status
   */
  async getUserSmartCharging(): Promise<UserSmartChargingStatus> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query UserSmartCharging {
          userSmartCharging {
            hasAcceptedTerms
            isActivated
            isAvailableInCountry
            needsSubscription
            provider
            subscription {
              endDate
              id
              proposition {
                product
                countryCode
              }
              startDate
            }
            userCreatedAt
            userId
          }
        }
      `,
      operationName: 'UserSmartCharging',
    };

    const response = await this.query<{ userSmartCharging: UserSmartChargingStatus }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved smart charging status`);
    return response.data.userSmartCharging;
  }

  /**
   * Get smart feed-in service status
   * @returns Smart feed-in activation and subscription status
   */
  async getUserSmartFeedIn(): Promise<UserSmartFeedInStatus> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query UserSmartFeedIn {
          userSmartFeedIn {
            hasAcceptedTerms
            isActivated
            isAppOnboardingAvailable
            isAvailableInCountry
            userCreatedAt
            userId
          }
        }
      `,
      operationName: 'UserSmartFeedIn',
    };

    const response = await this.query<{ userSmartFeedIn: UserSmartFeedInStatus }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved smart feed-in status`);
    return response.data.userSmartFeedIn;
  }

  // ===== Session Methods =====

  /**
   * Get solar feed-in session data for a specific PV system and date range
   * @param deviceId PV system device ID
   * @param startDate Start date
   * @param endDate End date
   * @returns Feed-in session data including bonuses and volumes
   */
  async getSmartFeedInSessions(
    deviceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SmartFeedInSessionData> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query SmartFeedInSessions(
          $startDate: String!
          $endDate: String!
          $deviceId: String!
        ) {
          smartFeedInSessions(
            deviceId: $deviceId
            endDate: $endDate
            startDate: $startDate
          ) {
            periodBonus
            periodEndDate
            periodStartDate
            periodVolume
            sessions {
              bonus
              cumulativeBonus
              date
              status
              volume
            }
          }
        }
      `,
      operationName: 'SmartFeedInSessions',
      variables: {
        deviceId,
        startDate: startDate.toLocaleDateString('en-CA', { timeZone: TIME_ZONE }),
        endDate: endDate.toLocaleDateString('en-CA', { timeZone: TIME_ZONE }),
      },
    };

    const response = await this.query<{ smartFeedInSessions: SmartFeedInSessionData }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved feed-in sessions for PV system ${deviceId}`);
    return response.data.smartFeedInSessions;
  }

  /**
   * Get EV charging session data (Enode)
   * @param dateFilter Optional date filter for sessions
   * @returns EV charging session data with costs and savings
   */
  async getEnodeSessions(dateFilter?: Record<string, unknown>): Promise<EnodeSessionData> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query EnodeSessions($date: SessionsDateFilter) {
          enodeSessions(date: $date) {
            totalBonus
            totalChargedEnergy
            totalCosts
            totalSavings
            rows {
              batteryCapacity
              bonus
              chargedEnergy
              costs
              dumbSessionTheoreticalCost
              endCharge
              epexCost
              initialCharge
              isManaged
              locationId
              savings
              sessionEnd
              sessionId
              sessionStart
              userCompensation
              vehicleConfig {
                deadline
                isSolarChargingEnabled
                maximumChargeLimit
                minimumChargeLimit
              }
            }
          }
        }
      `,
      operationName: 'EnodeSessions',
      variables: { date: dateFilter },
    };

    const response = await this.query<{ enodeSessions: EnodeSessionData }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved ${response.data.enodeSessions.rows.length} Enode charging sessions`);
    return response.data.enodeSessions;
  }

  // ===== Market Pricing & Analytics Methods =====

  /**
   * Get hourly market prices for a specific date and site
   * @param siteReference Site reference identifier
   * @param date Date in YYYY-MM-DD format
   * @returns Hourly electricity and gas prices with averages
   */
  async getMarketPrices(siteReference: string, date: Date): Promise<MarketPricesData> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query MarketPrices($date: String!, $siteReference: String!) {
          customerMarketPrices(date: $date, siteReference: $siteReference) {
            id
            averageElectricityPrices {
              averageMarketPrice
              averageMarketPricePlus
              averageAllInPrice
              perUnit
              isWeighted
            }
            electricityPrices {
              id
              from
              till
              date
              marketPrice
              marketPricePlus
              allInPrice
              perUnit
              marketPricePlusComponents {
                name
                value
              }
              allInPriceComponents {
                name
                value
              }
            }
            gasPrices {
              id
              from
              till
              date
              marketPrice
              marketPricePlus
              allInPrice
              perUnit
              marketPricePlusComponents {
                name
                value
              }
              allInPriceComponents {
                name
                value
              }
            }
          }
        }
      `,
      operationName: 'MarketPrices',
      variables: {
        siteReference,
        date: date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE }),
      },
    };

    const response = await this.query<{ customerMarketPrices: MarketPricesData }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved market prices for ${siteReference}`);
    return response.data.customerMarketPrices;
  }

  /**
   * Get weighted average market prices over a period
   * @param siteReference Site reference identifier
   * @param date Date period in YYYY-MM format
   * @returns Weighted average prices for electricity, gas, and feed-in
   */
  async getWeightedAveragePrices(siteReference: string, date: string): Promise<WeightedAveragePricesData> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query WeightedAveragePrices($date: String!, $siteReference: String!) {
          weightedAveragePrices(date: $date, siteReference: $siteReference) {
            _id
            gas {
              averageMarketPrice
              averageMarketPricePlus
              perUnit
              items {
                _id
                date
                from
                till
                averageMarketPrice
                averageMarketPricePlus
                perUnit
              }
            }
            electricity {
              averageMarketPrice
              averageMarketPricePlus
              perUnit
              items {
                _id
                date
                from
                till
                averageMarketPrice
                averageMarketPricePlus
                perUnit
              }
            }
            feedIn {
              averageMarketPrice
              averageMarketPricePlus
              perUnit
              items {
                _id
                date
                from
                till
                averageMarketPrice
                averageMarketPricePlus
                perUnit
              }
            }
          }
        }
      `,
      operationName: 'WeightedAveragePrices',
      variables: { siteReference, date },
    };

    const response = await this.query<{ weightedAveragePrices: WeightedAveragePricesData }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved weighted average prices for ${siteReference}`);
    return response.data.weightedAveragePrices;
  }

  /**
   * Get monthly summary data (costs and meter readings)
   * @param siteReference Site reference identifier
   * @returns Monthly summary with costs and meter reading information
   */
  async getMonthSummary(siteReference: string): Promise<MonthSummaryData> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query MonthSummary($siteReference: String!) {
          monthSummary(siteReference: $siteReference) {
            _id
            lastMeterReadingDate
            expectedCostsUntilLastMeterReadingDate
            actualCostsUntilLastMeterReadingDate
            meterReadingDayCompleteness
            gasExcluded
          }
        }
      `,
      operationName: 'MonthSummary',
      variables: { siteReference },
    };

    const response = await this.query<{ monthSummary: MonthSummaryData }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved month summary for ${siteReference}`);
    return response.data.monthSummary;
  }

  /**
   * Get detailed monthly insights with energy breakdowns
   * @param siteReference Site reference identifier
   * @param date Date period in YYYY-MM format
   * @returns Detailed cost breakdown by category (gas, electricity, feed-in)
   */
  async getMonthInsights(siteReference: string, date: string): Promise<MonthInsightsData> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query MonthInsights($date: String!, $siteReference: String!) {
          monthInsights(date: $date, siteReference: $siteReference) {
            _id
            expectedCosts
            expectedCostsGas
            expectedCostsFixed
            expectedCostsElectricity
            expectedCostsFeedIn
            expectedCostsUntilLastMeterReading
            actualCostsUntilLastMeterReading
            lastMeterReadingDate
            invoiceId
            gasDifference {
              actualUsage
              actualAverageUnitPrice
              actualCosts
              expectedUsage
              expectedAverageUnitPrice
              expectedCosts
              unit
            }
            electricityDifference {
              actualUsage
              actualAverageUnitPrice
              actualCosts
              expectedUsage
              expectedAverageUnitPrice
              expectedCosts
              unit
            }
            feedInDifference {
              actualUsage
              actualAverageUnitPrice
              actualCosts
              expectedUsage
              expectedAverageUnitPrice
              expectedCosts
              unit
            }
            meterReadingDayCompleteness
            gasExcluded
          }
        }
      `,
      operationName: 'MonthInsights',
      variables: { siteReference, date },
    };

    const response = await this.query<{ monthInsights: MonthInsightsData }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved month insights for ${siteReference}`);
    return response.data.monthInsights;
  }

  /**
   * Get usage and costs broken down by day
   * @param siteReference Site reference identifier
   * @param date Date period in YYYY-MM format
   * @returns Daily usage and cost data for gas, electricity, and feed-in
   */
  async getPeriodUsageAndCosts(siteReference: string, date: string): Promise<PeriodUsageAndCostsData> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query PeriodUsageAndCosts($date: String!, $siteReference: String!) {
          periodUsageAndCosts(date: $date, siteReference: $siteReference) {
            _id
            gas {
              usageTotal
              costsTotal
              unit
              items {
                date
                from
                till
                usage
                costs
                unit
              }
            }
            electricity {
              usageTotal
              costsTotal
              unit
              items {
                date
                from
                till
                usage
                costs
                unit
              }
            }
            feedIn {
              usageTotal
              costsTotal
              unit
              items {
                date
                from
                till
                usage
                costs
                unit
              }
            }
          }
        }
      `,
      operationName: 'PeriodUsageAndCosts',
      variables: { siteReference, date },
    };

    const response = await this.query<{ periodUsageAndCosts: PeriodUsageAndCostsData }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved period usage and costs for ${siteReference}`);
    return response.data.periodUsageAndCosts;
  }

  /**
   * Get expected vs actual costs comparison
   * @param siteReference Site reference identifier
   * @param costsDeltaType Type of comparison (e.g., CURRENT_MONTH, LAST_MONTH)
   * @returns Comparison of expected vs actual costs by day
   */
  async getCostsDelta(
    siteReference: string,
    costsDeltaType: string,
  ): Promise<CostsDeltaData> {
    if (!this.auth) {
      throw new Error('Authentication required. Call login() first.');
    }

    const queryData = {
      query: `
        query CostsDelta(
          $costsDeltaType: EnumCostsDeltaType!
          $siteReference: String!
        ) {
          costsDelta(type: $costsDeltaType, siteReference: $siteReference) {
            _id
            expectedCostsTotal
            actualCostsTotal
            items {
              _id
              date
              expectedCosts
              actualCosts
            }
            meterReadingDayCompleteness
            gasExcluded
          }
        }
      `,
      operationName: 'CostsDelta',
      variables: { costsDeltaType, siteReference },
    };

    const response = await this.query<{ costsDelta: CostsDeltaData }>(queryData);
    this.logger(`FrankEnergieClient: Retrieved costs delta for ${siteReference}`);
    return response.data.costsDelta;
  }

  /**
   * Check if client is authenticated
   * @returns True if authenticated
   */
  isAuthenticated(): boolean {
    return this.auth !== null;
  }

  /**
   * Get current authentication tokens (if authenticated)
   * @returns Authentication tokens or null
   */
  getAuth(): FrankEnergieAuth | null {
    return this.auth;
  }
}
