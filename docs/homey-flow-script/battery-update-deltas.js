async function getVariableValue(name, defaultValue) {
  const variable = await global.get(name);
  return variable !== undefined ? variable : defaultValue;
}

async function setVariableValue(name, value) {
  await tag(name, value);
  await global.set(name, value);
}


const averageImportPower = await getVariableValue('averageImportPower', 0);
const averageExportPower = await getVariableValue('averageExportPower', 0);
const prevAverageImportPower = await getVariableValue('prevAverageImportPower', 0);
const prevAverageExportPower = await getVariableValue('prevAverageExportPower', 0);
const averageBatteryLevel = await getVariableValue('averageBatteryLevel', 0);
const battery_delta = await getVariableValue('battery_delta', 'No');

// Log the current values (optional)
console.log('averageImportPower:', averageImportPower);
console.log('averageExportPower:', averageExportPower);
console.log('prevAverageImportPower:', prevAverageImportPower);
console.log('prevAverageExportPower:', prevAverageExportPower);
console.log('averageBatteryLevel:', averageBatteryLevel);
console.log('battery_delta:', battery_delta);

var deltaImportPower = averageImportPower;
var deltaExportPower = averageExportPower;

// batterysystemen zonder dagtotalen passen delta berekening toe
if (battery_delta == 'Yes') {
  deltaImportPower -= prevAverageImportPower;
  deltaExportPower -= prevAverageExportPower
}


// Update delta values
await setVariableValue('deltaImportPower', Math.round(deltaImportPower));
await setVariableValue('deltaExportPower', Math.round(deltaExportPower));


// Haal de opgeslagen waarden op en log ze
const storedDeltaImportPower = await getVariableValue('deltaImportPower', 0);
const storedDeltaExportPower = await getVariableValue('deltaExportPower', 0);
const storedAvarageBatteryLevel = await getVariableValue('averageBatteryLevel', 0);


console.log('Berekende deltaImportPower:', deltaImportPower);
console.log('Berekende deltaExportPower:', deltaExportPower);
console.log(`Opgeslagen gemiddelde deltaImportPower: ${storedDeltaImportPower}`);
console.log(`Opgeslagen gemiddelde deltaExportPower: ${storedDeltaExportPower}`);
console.log(`Opgeslagen gemiddelde averageBatteryLevel: ${storedAvarageBatteryLevel}`);


