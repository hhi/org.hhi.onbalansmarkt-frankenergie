// input statische vars als scriptvars
//  belangrijk is dat ze meegegeven worden in de vaste volgorde met een comma als scheiding tussen de variabelen

async function setVariableValue(name, value) {
  await tag(name, value);
  await global.set(name, value);
}

const staticvars = args[0].split(",");

const frankenergie_id = staticvars[0];
const frankenergie_pw = staticvars[1];
const onbalansmarkt_apikey = staticvars[2];

await setVariableValue('varFrankenergie_id', frankenergie_id);
await setVariableValue('varFrankenergie_pw', frankenergie_pw);  
await setVariableValue('varConbalansmarkt_apikey', onbalansmarkt_apikey);

console.log("frankenergie_id", frankenergie_id);
console.log("frankenergie_pw", frankenergie_pw);
console.log("onbalansmarkt_apikey",onbalansmarkt_apikey);