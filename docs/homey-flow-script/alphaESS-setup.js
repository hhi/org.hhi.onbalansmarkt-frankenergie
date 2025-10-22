async function getVariableValue(name, defaultValue) {
    const variable = await global.get(name);
    return variable !== undefined ? variable : defaultValue;
}

async function setVariableValue(name, value) {
    await tag(name, value);
    await global.set(name, value);
}

// bepaal de device capabilities per battery systeem, en of de delta bepaald moet worden
await setVariableValue('battery_system', 'alpaess');
console.log('battery_system:', await getVariableValue('battery_system', 'default'));

await setVariableValue('battery_class', 'battery');
console.log('battery_class:', await getVariableValue('battery_class', 'default'));

await setVariableValue('battery_import', 'meter_power.charged');
console.log('battery_import:', await getVariableValue('battery_import', 'default'));

await setVariableValue('battery_export', 'meter_power.discharged');
console.log('battery_export:', await getVariableValue('battery_export', 'default'));

await setVariableValue('battery_level', 'measure_battery');
console.log('battery_level:', await getVariableValue('battery_level', 'default'));


await setVariableValue('battery_delta', 'Yes');
console.log('battery_delta:', await getVariableValue('battery_delta', 'Yes'));
