
import { API } from 'homebridge';

import { RemootioHomebridgeAccessory } from './remootio-accessory'; 




/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) : void => {
  api.registerAccessory('Remootio', RemootioHomebridgeAccessory);

};
