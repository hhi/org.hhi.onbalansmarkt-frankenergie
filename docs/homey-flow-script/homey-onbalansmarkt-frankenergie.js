/**
 * JavaScript code om de opbrengst van een batterij naar Onbalansmarkt.com te sturen.
 *
 * Update 2025-01-24: update om impex, Frank Slim korting en totaal handelsresultaat in te sturen.
 * Update 2025-01-23: update naar netto 'totaal kortingsfactuur' ipv bruto resultaat
 *
 * Auteur: erdebee, met wijzigingen van verschillende gebruikers

 *   Update 2025-02-10: hhi, gecombineerd resultaat voor de bijdragende individuele (Sessy) battterijen, met import/export kWhs en batterij-capaciteit
*   Update 2025-07-01: hhi, toegevoegd de mogelijkheid om de batterij resultaten te vermenigvuldigen met het aantal deelnemende batterijen
*  Update 2025-07-03: hhi, automatische bepaling van de handelsmodus en handelsstrategie van de batterij, en deze doorgeven aan Onbalansmarkt.com
*  Update 2025-10-12: bugfixes: GraphQL aanpassing verwerkt, batteryResult parameter correctie (periodTradingResult ipv periodTotalResult), validatie toegestaan voor 0-waarden

-SESSIE- <ID-EXAMPLE-OUTPUT => {
  "data": {
    "smartBatterySessions": {
      "deviceId": "---ID---",
      "fairUsePolicyVerified": false,
      "periodStartDate": "2025-02-10",
      "periodEndDate": "2025-02-10",
      "periodEpexResult": -0.3212414999999999,       -->  EPEX-correctie                          € -0,32
      "periodFrankSlim": 0.15302999999999994,        -->  Handelsresultaat.Frank Slim Korting      € 0,15
      "periodImbalanceResult": 0.4614773533332047,   -->              ''''.Onbalansresultaat       € 0,46
      "periodTotalResult": 0.2932658533332047,       --> Totaal kortingsfactuur                 € 0,29
      "periodTradeIndex": null,
      "periodTradingResult": 0.6145073533332046,     -->  Handelsresultaat                       € 0,61
      "sessions": [
        {
          "cumulativeTradingResult": 0.6145073533332046,
          "date": "2025-02-10",
          "tradingResult": 0.6145073533332046,
          "result": 0.6145073533332046,
          "status": "ACTIVE",
          "tradeIndex": null
        }
      ],
      "totalTradingResult": 293.9425048467043
    }
  }
}

NIEUW:
      "periodEpexResult": 0,						accumulatedPeriodEpexResult
      "periodFrankSlim": 0,							accumulatedPeriodFrankSlim
      "periodImbalanceResult": 0,					accumulatedImbalanceResult
      "periodTotalResult": 0,						accumulatedPeriodTotalResult
      "periodTradeIndex": null,
      "periodTradingResult": 0,						accumulatedPeriodTradingResult
      "sessions": [
        {
          "cumulativeResult": 457.43570574110197,		accumulatedTotalTradingResult

 */
const timeZone = 'Europe/Amsterdam';

class FrankEnergie {
  constructor(authToken = null, refreshToken = null) {
    this.DATA_URL = 'https://graphql.frankenergie.nl/';
    this.auth = authToken || refreshToken ? { authToken, refreshToken } : null;
  }

  async query(queryData) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Homey/FrankV1',
      ...(this.auth && { Authorization: `Bearer ${this.auth.authToken}` }),
    };

    try {
      const response = await fetch(this.DATA_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(queryData),
      });

      const data = await response.json();

      if (data.errors) {
        for (const error of data.errors) {
          if (error.message === 'user-error:auth-not-authorised') {
            throw new Error('Authentication required');
          }
        }
      }

      return data;
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  async login(username, password) {
    const query = {
      query: `
                mutation Login($email: String!, $password: String!) {
                    login(email: $email, password: $password) {
                        authToken
                        refreshToken
                    }
                }
            `,
      operationName: 'Login',
      variables: { email: username, password },
    };

    const response = await this.query(query);
    this.auth = response.data.login;
    return this.auth;
  }

  async getSmartBatteries() {
    if (!this.auth) {
      throw new Error('Authentication required');
    }

    const query = {
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

    return await this.query(query);
  }

  async getSmartBatterySessions(deviceId, startDate, endDate) {
    if (!this.auth) {
      throw new Error('Authentication required');
    }

    const query = {
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
        startDate: startDate.toLocaleDateString('en-CA', { timeZone }), // specificeer de lokale datum in YYYY-mm-dd formaat
        endDate: endDate.toLocaleDateString('en-CA', { timeZone }),
      },
    };

    return await this.query(query);
  }

  async getSmartBattery(deviceId) {
    if (!this.auth) {
      throw new Error('Authentication required');
    }

    const query = {
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
      variables: {
        deviceId,
      },
    };

    return await this.query(query);
  }

  isAuthenticated() {
    return this.auth !== null;
  }
}

class OnbalansMarkt {
  constructor(apiKey) {
    this.apiUrl = 'https://onbalansmarkt.com/api/live';
    this.apiKey = apiKey;
  }

  async sendMeasurement({
    timestamp,
    batteryResult,
    batteryResultTotal,
    batteryCharge = null,
    batteryPower = null,
    chargedToday = null,
    dischargedToday = null,
    loadBalancingActive = null,
    solarResult = null,
    chargerResult = null,
    batteryResultEpex = null,
    batteryResultImbalance = null,
    batteryResultCustom = null,
    mode = null,
  }) {
    // Validate required fields - check for null/undefined, allow 0 values
    if (!timestamp || batteryResult === null || batteryResult === undefined || batteryResultTotal === null || batteryResultTotal === undefined) {
      throw new Error('timestamp, batteryResult and batteryResultTotal are required fields');
    }

    // Prepare the payload
    const payload = {
      timestamp: timestamp.toISOString(),
      batteryResult: batteryResult.toString(),
      batteryResultTotal: batteryResultTotal.toString(),
      ...(batteryCharge !== null && { batteryCharge: batteryCharge.toString() }),
      ...(batteryPower !== null && { batteryPower: batteryPower.toString() }),
      ...(chargedToday !== null && { chargedToday: chargedToday.toString() }),
      ...(dischargedToday !== null && { dischargedToday: dischargedToday.toString() }),
      ...(loadBalancingActive !== null && { loadBalancingActive: loadBalancingActive.toString() }),
      ...(solarResult !== null && { solarResult: solarResult.toString() }),
      ...(chargerResult !== null && { chargerResult: chargerResult.toString() }),
      ...(batteryResultEpex !== null && { batteryResultEpex: batteryResultEpex.toString() }),
      ...(batteryResultImbalance !== null && { batteryResultImbalance: batteryResultImbalance.toString() }),
      ...(batteryResultCustom !== null && { batteryResultCustom: batteryResultCustom.toString() }),
      ...(mode !== null && { mode: mode.toString() }),
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Error sending measurement:', error);
      throw error;
    }
  }
}

class HomeyVars {
  async getVariableValue(name, defaultValue) {
    const variable = await global.get(name);
    return variable !== undefined ? variable : defaultValue;
  }

  async setVariableValue(name, value) {
    await tag(name, value);
    await global.set(name, value);
  }
}

const homeyVars = new HomeyVars();

// Lees de variabelen
const frankenergie_pw = await homeyVars.getVariableValue('frankenergie_pw', 'defaultPassword');
const frankenergie_id = await homeyVars.getVariableValue('frankenergie_id', 'defaultEmail');
const onbalansmarkt_apikey = await homeyVars.getVariableValue('onbalansmarkt_apikey', 'defaultApiKey');

// Log de waarden van de variabelen
console.log(`Frank Energie Password: ${frankenergie_pw}`);
console.log(`Frank Energie Login: ${frankenergie_id}`);
console.log(`Onbalansmarkt API Key: ${onbalansmarkt_apikey}`);

const frank = new FrankEnergie();

await frank.login(frankenergie_id, frankenergie_pw);

const onbalansmarkt = new OnbalansMarkt(onbalansmarkt_apikey);

// Get all smart batteries
const batteries = await frank.getSmartBatteries();

// we sturen met dit script de opbrengst van de batterij, op de huidige tijd, naar Onbalansmarkt.com
const currentTime = new Date();

// wanneer je de opgenomen en geleverde kWhs beschikbaar hebt van je batterij, dan kun je die hier ophalen en aan onderstaande variabelen toewijzen.
// wat betreft de kwhCharged en kwhDischarged variabelen, deze is nu een gemiddelde over de gehele set van batterijen.
// we moeten deze waarde nog vermenigvuldigen met het aantal deelnemende (en daardoor bijdragende) batterijen

let kwhCharged = await homeyVars.getVariableValue('deltaImportPower', null);
let kwhDischarged = await homeyVars.getVariableValue('deltaExportPower', null);
const battCharged = await homeyVars.getVariableValue('averageBatteryLevel', null);

// Get sessions for a specific battery
// Accumulate results
let accumulatedPeriodTotalResult = 0;
let accumulatedTotalTradingResult = 0;
let accumulatedPeriodEpexResult = 0;
let accumulatedPeriodTradingResult = 0;
let accumulatedPeriodFrankSlim = 0;
let accumulatedImbalanceResult = 0;

// Initialize the loop counter
let loopCounter = 0;

// Get sessions for each battery
for (const battery of batteries.data.smartBatteries) {
  // Increment the loop counter for each battery
  loopCounter++;

  const batteryId = battery.id;
  const sessions = await frank.getSmartBatterySessions(
    batteryId,
    currentTime,
    currentTime,
  );
  console.log('-SESSIE-', batteryId, '=>', JSON.stringify(sessions, null, 2));
  accumulatedPeriodTotalResult += sessions.data.smartBatterySessions.periodTotalResult;
  accumulatedTotalTradingResult += sessions.data.smartBatterySessions.sessions[0].cumulativeResult;
  accumulatedPeriodEpexResult += sessions.data.smartBatterySessions.periodEpexResult;
  accumulatedPeriodTradingResult += sessions.data.smartBatterySessions.periodTradingResult;
  accumulatedPeriodFrankSlim += sessions.data.smartBatterySessions.periodFrankSlim;
  accumulatedImbalanceResult += sessions.data.smartBatterySessions.periodImbalanceResult;

}

console.log('=== Accumulated Session Results ===');
console.log(`Period Total Result:    ${accumulatedPeriodTotalResult.toFixed(2)}`);
console.log(`Total Trading Result:   ${accumulatedTotalTradingResult.toFixed(2)}`);
console.log(`Period EPEX Result:     ${accumulatedPeriodEpexResult.toFixed(2)}`);
console.log(`Period Trading Result:  ${accumulatedPeriodTradingResult.toFixed(2)}`);
console.log(`Period Frank Slim:      ${accumulatedPeriodFrankSlim.toFixed(2)}`);
console.log(`Imbalance Result:       ${accumulatedImbalanceResult.toFixed(2)}`);
console.log('===================================');

// Multiply kwhCharged and kwhDischarged by the loop counter, needed to get the accumulated charged and discharged kWhs
if (kwhCharged !== null) {
  kwhCharged *= loopCounter;
  console.log(`kwhCharged over alle deelnemende batterijen: ${kwhCharged}`);
}
if (kwhDischarged !== null) {
  kwhDischarged *= loopCounter;
  console.log(`kwhDischarged over alle deelnemende batterijen: ${kwhDischarged}`);
}

// aanroep van  getBattery, om de handelsmode ne handelstrategie van de batterij op te halen
const battery = await frank.getSmartBattery(batteries.data.smartBatteries[0].id);
console.log('-BATTERY- ', JSON.stringify(battery));

const handelsmode = battery.data.smartBattery.settings.batteryMode;
console.log(`Handelsmode: ${handelsmode}`);

const handelsstrategie = battery.data.smartBattery.settings.imbalanceTradingStrategy;
console.log(`Handelsstrategie: ${handelsstrategie}`);

// bepaal welke handelsmodus we gaan gebruiken, afhankelijk van de handelsmode en handelsstrategie van de batterij
let handelsmodus = 'imbalance'; // default modus is imbalance

if (handelsmode === 'IMBALANCE_TRADING' && handelsstrategie === 'STANDARD') {
  handelsmodus = 'imbalance';
} else if (handelsmode === 'IMBALANCE_TRADING' && handelsstrategie === 'AGGRESSIVE') {
  handelsmodus = 'imbalance_aggressive';
} else if (handelsmode === 'SELF_CONSUMPTION_MIX') {
  handelsmodus = 'self_consumption_plus';
} else {
  handelsmodus = 'manual';
}

console.log(`Determined mode: ${handelsmodus}`);

// Example output for the measurement to be sent to Onbalansmarkt.com
// {
//   "timestamp": "2025-01-20T16:00:00Z",
//   "batteryResult": "8.80",
//   "batteryResultTotal": "1004.75",
//   "batteryResultEpex": "-1.40",
//   "batteryResultImbalance": "9.60",
//   "batteryResultCustom": "0.60",
//   "batteryCharge": "76",
//   "batteryPower": "-9000",
//   "chargedToday": "11",
//   "dischargedToday": "8",
//   "loadBalancingActive": "on", (on/off)
//   "solarResult": "string",
//   "chargerResult": "string",
//   "totalBatteryCycles": "143",
//   "mode": "imbalance" (imbalance/imbalance_aggressive/manual/day_ahead/self_consumption/self_consumption_plus)
// }

// Send the measurement to Onbalansmarkt.com
console.log(`-REST call- ( ${currentTime}, ${accumulatedPeriodTradingResult}, ${accumulatedTotalTradingResult} )`);

await onbalansmarkt.sendMeasurement({
  timestamp: currentTime,
  batteryResult: accumulatedPeriodTradingResult,
  batteryResultTotal: accumulatedTotalTradingResult,
  batteryCharge: battCharged,
  loadBalancingActive: 'off', // Stuur hier enkel 'on' in wanneer de batterij op dit moment beperkt is in zijn vermogen door load balancing
  chargedToday: kwhCharged !== null ? Math.round(kwhCharged) : null,
  dischargedToday: kwhDischarged !== null ? Math.round(kwhDischarged) : null,
  batteryResultEpex: accumulatedPeriodEpexResult,
  batteryResultImbalance: accumulatedImbalanceResult,
  batteryResultCustom: accumulatedPeriodFrankSlim,
  mode: handelsmodus,
});
