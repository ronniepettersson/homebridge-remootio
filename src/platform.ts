//import http, { IncomingMessage, Server, ServerResponse } from 'http';
import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig,
} from 'homebridge';

import { PLUGIN_NAME, PLATFORM_NAME } from './settings';

import { RemootioHomebridgeAccessory } from './remootio-accessory';

import { RemootioDeviceType } from './remootio-types';

let hap: HAP;
let Accessory: typeof PlatformAccessory;

export class RemootioPlatform implements DynamicPlatformPlugin {
  readonly log: Logging;
  readonly api: API;

  //private requestServer?: Server;

  private readonly accessories: PlatformAccessory[] = [];
  private readonly config: PlatformConfig;
  private readonly configuredAccessories: { [index: string]: RemootioHomebridgeAccessory } = {};

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;
    this.config = config;

    Accessory = api.platformAccessory;
    hap = api.hap;

    // Parse config here

    log.info('Remootio platform finished initializing!');

    /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */
    api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.info('Remotio platform didFinishLaunching()');

      this.discoverAndSyncAccessories();
      // The idea of this plugin is that we open a http service which exposes api calls to add or remove accessories
      //this.createHttpService();
    });
  }

  /*
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log('Configuring accessory %s', accessory.displayName);

    accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log('%s identified!', accessory.displayName);
    });
    accessory.context.device = null;
    this.accessories.push(accessory);
  }

  // Discover new devices and sync existing ones.
  private discoverAndSyncAccessories(): boolean {
    // Remove any device objects from now-stale accessories.
    for (const accessory of this.accessories) {
      // We only need to do this if the device object is set.
      if (!accessory.context.device) {
        continue;
      }

      // Check to see if this accessory's device object is still in or not.
      if (!this.config.devices.some((x: RemootioDeviceType) => x.apiAuthKey === accessory.context.device.apiAuthKey)) {
        accessory.context.device = null;
      }
    }

    // Iterate through the list of devices in configuration and sync them with what we show HomeKit.
    for (const device of this.config.devices) {
      // If we have no IP address or authentication key, something is wrong.
      if (!device.ipAddress || !device.apiAuthKey) {
        continue;
      }

      // Generate this device's unique identifier.

      const uuid = hap.uuid.generate(device.apiAuthKey);

      let accessory: PlatformAccessory;

      // See if we already know about this accessory or if it's truly new. If it is new, add it to HomeKit.
      if ((accessory = this.accessories.find((x: PlatformAccessory) => x.UUID === uuid)!) === undefined) {
        accessory = new Accessory(device.name, uuid);

        this.log('%s: Adding Remootio device to HomeKit with IP address %s.', device.name, device.ipAddress);

        // Register this accessory with homebridge and add it to the accessory array so we can track it.
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.push(accessory);
      }

      // Link the accessory to it's device object.
      accessory.context.device = device;

      // Setup the device if it hasn't been configured yet.
      if (!this.configuredAccessories[accessory.UUID]) {
        // Adding the device.
        this.configuredAccessories[accessory.UUID] = new RemootioHomebridgeAccessory(this, accessory);

        // Refresh the accessory cache with these values.
        this.api.updatePlatformAccessories([accessory]);
      }
    }

    // Remove devices that are no longer found in the configuration, but we still have in HomeKit.
    for (const oldAccessory of this.accessories) {
      if (!oldAccessory.context.device) {
        this.log('%s: Removing Remootio device from HomeKit.', oldAccessory.displayName);

        delete this.configuredAccessories[oldAccessory.UUID];
        this.accessories.splice(this.accessories.indexOf(oldAccessory), 1);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [oldAccessory]);
      }
    }

    return true;
  }

  // ----------------------------------------------------------------------
}
