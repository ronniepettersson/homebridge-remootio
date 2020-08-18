import { API, HAP } from 'homebridge';

import { RemootioHomebridgeAccessory } from './remootio-accessory'; 


let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("RemootioGarageDoorOpenerPlugin", RemootioHomebridgeAccessory);
};
