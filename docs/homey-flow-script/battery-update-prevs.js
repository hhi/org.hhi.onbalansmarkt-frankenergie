async function getVariableValue(name, defaultValue) {
  const variable = await global.get(name);
  return variable !== undefined ? variable : defaultValue;
}

async function setVariableValue(name, value) {
  await tag(name, value);
  await global.set(name, value);
}

// Read or create global variables
const averageImportPower = await getVariableValue('averageImportPower', 0);
const averageExportPower = await getVariableValue('averageExportPower', 0);

// Log the current values (optional)
console.log('averageImportPower:', averageImportPower);
console.log('averageExportPower:', averageExportPower);

// Update previous values
await setVariableValue('prevAverageImportPower', averageImportPower);
await setVariableValue('prevAverageExportPower', averageExportPower);

console.log('prevAverageImportPower en prevAverageExportPower zijn bijgewerkt met de huidige waarden van averageImportPower en averageExportPower.');