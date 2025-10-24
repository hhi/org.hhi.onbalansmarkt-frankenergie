/**
 * JavaScript code om de opbrengst van een zonneplan batterij naar Onbalansmarkt.com te sturen.
 *
 * Auteur: vvandertas
 */
const API_KEY = 'API-KEY-ONBALANSMARKT.COM';
const timeZone = 'Europe/Amsterdam';

class OnbalansMarkt {
  constructor(apiKey) {
    this.apiUrl = 'https://onbalansmarkt.com/api/live';
    this.apiKey = apiKey;
  }

  async sendMeasurement({
    timestamp,
    batteryResult,
    batteryResultTotal,
    batteryCharge,
    batteryCycles,
    batteryPower = null,
    chargedToday = null,
    dischargedToday = null,
    loadBalancingActive = null,
    solarResult = null,
    chargerResult = null,
  }) {
    // Validate required fields
    if (timestamp == null || batteryResult == null || batteryResultTotal == null) {
      throw new Error('timestamp, batteryResult and batteryResultTotal are required fields');
    }

    // Prepare the payload
    const payload = {
      timestamp: timestamp.toISOString(),
      batteryResult: batteryResult.toString(),
      batteryResultTotal: batteryResultTotal.toString(),
      ...(batteryCharge !== null && { batteryCharge: batteryCharge.toString() }),
      ...(batteryCycles !== null && { totalBatteryCycles: batteryCycles.toString() }),
      ...(batteryPower !== null && { batteryPower: batteryPower.toString() }),
      ...(chargedToday !== null && { chargedToday: chargedToday.toString() }),
      ...(dischargedToday !== null && { dischargedToday: dischargedToday.toString() }),
      ...(loadBalancingActive !== null && { loadBalancingActive: loadBalancingActive.toString() }),
      ...(solarResult !== null && { solarResult: solarResult.toString() }),
      ...(chargerResult !== null && { chargerResult: chargerResult.toString() }),
    };

    log(`Payload ${JSON.stringify(payload)}`);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Homey/ScriptV1',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Measurments synced succesfully, store latest measurement time
      log(`'last measured' updaten naar ${timestamp}`);
      global.set('zp-last-measured', timestamp);

      return await response.text();
    } catch (error) {
      console.error('Error sending measurement:', error);
      throw error;
    }
  }
}

/**
 * Returns the UTC offset in hours for a given timezone.
 * @param {string} timeZone - The IANA timezone identifier (e.g., 'Europa/Amsterdam').
 * @returns {number|null} - The offset in hours or null if the timezone is invalid.
 */
function getTimezoneOffset(timeZone) {
  try {
    const date = new Date();
    const tzDate = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(date);
    const timeZoneNamePart = tzDate.find((part) => part.type === 'timeZoneName');

    if (!timeZoneNamePart) {
      throw new Error('Invalid timezone');
    }

    const match = timeZoneNamePart.value.match(/GMT([+-]\d{1,2}):?(\d{2})?/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      return hours + (minutes / 60);
    }
    return 0;
  } catch (error) {
    console.error(`Invalid timezone: ${timeZone}`);
    return null;
  }
}

/**
 * Parse the last measured value received to represint local amsterdam time in an iso format
 */
function parseLastMeasured(dateTime) {
  // formateer de datum voor de laatste meeting als iso string zodat we de tijd in UTC kunnen bepalen
  const [datePart, timePart] = dateTime.split(' ');
  const [day, month, year] = datePart.split('-');
  const [hour, minute] = timePart.split(':');
  // iso string gebaseerde datum
  const localTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
  // aangepast voor de juiste tijdzone
  const offset = getTimezoneOffset(timeZone);
  return new Date(localTime.getTime() - (offset * 3600000));
}

/**
 * Find the battery device.
 */
async function getBattery() {
  const storedDeviceId = global.get('zp-battery-id');
  log(`Opgeslagen Id: ${storedDeviceId}`);

  let battery;
  if (storedDeviceId !== null) {
    // haal de batterij op aan de hand van het opgeslagen id
    try {
      battery = await Homey.devices.getDevice({ id: storedDeviceId });
    } catch (error) {
      console.error(`${error}. Looping through devices to find battery`);
    }
  }

  // vind de batterij op basis van de driverId als het id van de batterij nog niet is een global variable opgeslagen is
  if (battery === undefined || battery === null) {
    const devices = await Homey.devices.getDevices();
    for (const device of Object.values(devices)) {
      if (device.driverId.toLowerCase().includes('zonneplan') && device.class === 'battery') {
        battery = device;
        break;
      }
    }
    if (battery !== undefined && battery !== null) {
      // bewaar het id van de batterij om deze de volgende keer makkelijker te kunnen vinden
      log(`Batterij id ${battery.id} opslaan`);
      global.set('zp-battery-id', battery.id);
    } else {
      throw new Error('Geen Zonneplan batterij gevonden');
    }
  }

  return battery;
}

// vind de zonneplan batterij bij Homey
log('Batterij zoeken...');
const battery = await getBattery();
log(`Batterij gevonden: ${battery.name} met id: ${battery.id}`);

// haal alle data op
const dailyEarned = battery.capabilitiesObj['meter_power.daily_earned'].value;
const dailyImport = battery.capabilitiesObj['meter_power.daily_import'].value;
const dailyExport = battery.capabilitiesObj['meter_power.daily_export'].value;

const totalEarned = battery.capabilitiesObj['meter_power.total_earned'].value;
const dynamicLoadBalancingActive = battery.capabilitiesObj['boolean.dynamicloadbalancingactive'].value;

const batteryCharge = battery.capabilitiesObj['measure_battery'].value;
const cycleCount = battery.capabilitiesObj['cycle_count'].value;

// stel vast of de batterij op dit moment beperkt is in zijn vermogen door load balancing
let loadBalancingActive = 'off';
if (dynamicLoadBalancingActive !== 'undefined' && dynamicLoadBalancingActive) {
  loadBalancingActive = 'on';
}

// benodigde informatie voor de tijd van de meetingen
const lastMeasuredAt = battery.capabilitiesObj['lastmeasured'].value;
if (!lastMeasuredAt || lastMeasuredAt === 'undefined') {
  log('Geen \'last measured\' datum gevonden.');
  return;
}

// we sturen met dit script de opbrengst van de batterij naar Onbalansmarkt.com met de tijd van de laatste meeting
const measurementTime = parseLastMeasured(lastMeasuredAt);
const storedLastMeasured = global.get('zp-last-measured');
log(`Huidige 'last measurement time': ${measurementTime}, vorige 'last measurement time': ${storedLastMeasured}`);

if (!storedLastMeasured || new Date(storedLastMeasured) < measurementTime) {
  log('Data versturen naar Onbalansmarkt.com...');
  const onbalansmarkt = new OnbalansMarkt(API_KEY);
  await onbalansmarkt.sendMeasurement({
    timestamp: measurementTime,
    batteryResult: dailyEarned,
    batteryResultTotal: totalEarned,
    loadBalancingActive,
    chargedToday: dailyImport !== 'undefined' ? Math.round(dailyImport) : null,
    dischargedToday: dailyExport !== 'undefined' ? Math.round(dailyExport) : null,
    batteryCharge,
    batteryCycles: cycleCount !== 'undefined' ? cycleCount : null,
  });
  log('Data verstuurd naar Onbalansmarkt.com');
} else {
  log('Geen nieuwe data om te versturen naar Onbalansmarkt.com');
}
