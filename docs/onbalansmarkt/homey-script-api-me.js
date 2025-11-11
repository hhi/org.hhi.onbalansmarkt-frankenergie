/**
 * Homey Script: Fetch profile data from Onbalansmarkt `/api/me`.
 *
 * Usage (Advanced Flow Script card):
 * - Optional argument 1: Onbalansmarkt API key override.
 * - Otherwise expects a Homey variable named `onbalansmarkt_apikey`.
 *
 * The script logs the profile response and stores it in the Homey global/tag
 * `onbalansmarkt_profile_json` so other flows can reuse the latest payload.
 */

const PROFILE_ENDPOINT = 'https://onbalansmarkt.com/api/me';

class OnbalansmarktGraphQL {
  constructor(apiKey) {
    if (!apiKey?.trim()) {
      throw new Error('Onbalansmarkt API key is required');
    }
    this.apiKey = apiKey.trim();
  }

  async getProfile() {
    const response = await fetch(PROFILE_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Profile request failed with status ${response.status}`);
    }

    const profile = await response.json();
    return profile;
  }
}

class HomeyVars {
  async getVariableValue(name, defaultValue) {
    const variable = await global.get(name);
    return variable !== undefined ? variable : defaultValue;
  }

  async setVariableValue(name, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await tag(name, serialized);
    await global.set(name, serialized);
  }
}

const homeyVars = new HomeyVars();
const scriptArgs = typeof args !== 'undefined' && Array.isArray(args) ? args : [];

let apiKey = scriptArgs[0];
if (!apiKey) {
  apiKey = await homeyVars.getVariableValue('onbalansmarkt_apikey', '');
}

const cleanedApiKey = apiKey?.toString().trim() || '';

const client = new OnbalansmarktGraphQL(cleanedApiKey);
const profile = await client.getProfile();

console.log('Onbalansmarkt profile response:', JSON.stringify(profile, null, 2));

await homeyVars.setVariableValue('onbalansmarkt_profile_json', profile);

return profile;
