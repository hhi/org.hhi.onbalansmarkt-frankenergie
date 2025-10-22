// Gemiddelde waarden van specifieke apparaten lezen en opslaan

async function getVariableValue(name, defaultValue) {
  const variable = await global.get(name);
  return variable !== undefined ? variable : defaultValue;
}

async function setVariableValue(name, value) {
  await tag(name, value);
  await global.set(name, value);
}

// batterij systeem en device capabilities (default is s) 
const battery_system = await getVariableValue('battery_system', 'sessy');
const battery_import = await getVariableValue('battery_import', 'meter_power.import');  
const battery_export = await getVariableValue('battery_export', 'meter_power.export');
const battery_level = await getVariableValue('battery_level', 'measure_battery');
const battery_class = await getVariableValue('battery_class', 'battery');

// Zoek naar apparaten met de driverId die "sessy" bevat en de klasse "battery"
const devices = await Homey.devices.getDevices()
  .then(devices => Object.values(devices)
    .filter(device => device.driverId.toLowerCase().includes(battery_system) && device.class === battery_class));

if (devices.length === 0) {
  throw new Error(`Geen apparaten gevonden met driverId gelijk ${battery_system} bevat en class "battery"`);
}

// Initialiseer variabelen voor het opslaan van de totale waarden en het aantal geldige apparaten
let totalImportPower = 0;
let totalExportPower = 0;
let totalBatteryLevel = 0;
let validDevices = 0;

for (const device of devices) {
  // Lees de waarden van de capabilities uit
  const importPower = device.capabilitiesObj[battery_import]?.value;
  const exportPower = device.capabilitiesObj[battery_export]?.value;
  const batteryLevel = device.capabilitiesObj[battery_level]?.value;

  if (importPower !== undefined && exportPower !== undefined && batteryLevel !== undefined) {
    totalImportPower += importPower;
    totalExportPower += exportPower;
    totalBatteryLevel += batteryLevel;
    validDevices++;
  } else {
    console.error(`Waarden voor apparaat ${device.name} zijn niet geldig`);
  }
}

if (validDevices > 0) { 
  // Bereken de gemiddelde waarden
  const averageImportPower = totalImportPower / validDevices;
  const averageExportPower = totalExportPower / validDevices;
  const averageBatteryLevel = totalBatteryLevel / validDevices;


  // Log de gemiddelde waarden
  console.log(`Gemiddelde meter_power.import: ${averageImportPower}`);
  console.log(`Gemiddelde meter_power.export: ${averageExportPower}`);
  console.log(`Gemiddelde measure_battery: ${averageBatteryLevel}`);

  // Sla de gemiddelde waarden op in globale variabelen
  await setVariableValue('averageImportPower', averageImportPower);
  await setVariableValue('averageExportPower', averageExportPower);
  await setVariableValue('averageBatteryLevel', Math.round(averageBatteryLevel) );

  // Haal de opgeslagen waarden op en log ze
  const storedAverageImportPower = await getVariableValue('averageImportPower', 0);
  const storedAverageExportPower = await getVariableValue('averageExportPower', 0);
  const storedAverageBatteryLevel = await getVariableValue('averageBatteryLevel', 0);

  console.log(`Opgeslagen gemiddelde meter_power.import: ${storedAverageImportPower}`);
  console.log(`Opgeslagen gemiddelde meter_power.export: ${storedAverageExportPower}`);
  console.log(`Opgeslagen gemiddelde measure_battery: ${storedAverageBatteryLevel}`);
} else {
  console.error('Geen geldige apparaten gevonden om de waarden uit te lezen');
}