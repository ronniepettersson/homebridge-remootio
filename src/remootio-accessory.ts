/* Copyright (C) 2020 Ronnie Pettersson. All rights reserved
 *
 *  remootio-accessory.ts: Base class for Remootio accessories
 *
 */

import {
  API,
  HAP,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logging,
  Characteristic,
  PlatformAccessory,
  Service,
} from 'homebridge';

import { RemootioPlatform } from './platform';

import RemootioDevice = require('@ronniepettersson/remootio-api-client');

// Here are a subset of the Remootio API payloads sent by the device over web sockets
type RemootioEncryptedPayload = {
  type: 'ENCRYPTED';
  data: {
    payload: string;
    iv: string;
  };
  mac: string;
};
type RemootioError = {
  type: 'ERROR';
  errorMessage: string;
};
type RemootioPing = {
  type: 'PING';
};
type RemootioPong = {
  type: 'PONG';
};
type RemootioHello = {
  type: 'HELLO';
};
type RemootioServerHello = {
  type: 'SERVER_HELLO';
  apiVersion: number;
  message: string;
  serialNumber?: string;
  remootioVersion?: 'remootio-1' | 'remootio-2';
};

type RemootioChallenge = {
  challenge: {
    sessionKey: string;
    initialActionId: number;
  };
};

type RemootioEvent = {
  event: {
    cnt: number;
    type: string;
    state: string;
    t100ms: number;
    data?: {
      keyNr?: number;
      keyType?: string;
      via?: string;
      imeOpen100ms?: number;
    };
  };
};

type RemootioResponse = {
  response: {
    type: string;
    id: number;
    success: boolean;
    state: string;
    t100ms: number;
    relayTriggered: boolean;
    errorCode: string;
  };
};

type RemootioTypedFrame =
  | RemootioEncryptedPayload
  | RemootioError
  | RemootioPing
  | RemootioPong
  | RemootioHello
  | RemootioServerHello;

type RemootioFrame = RemootioTypedFrame & RemootioChallenge;

type RemootioDecryptedPayload = RemootioEvent & RemootioResponse;

const garageDoorOpenerStateToString: string[] = ['OPEN', 'CLOSED', 'OPENING', 'CLOSING', 'STOPPED'];

export class RemootioHomebridgeAccessory {
  private readonly log: Logging;
  private readonly api: API;
  private readonly hap: HAP;
  private readonly accessory: PlatformAccessory;
  private readonly platform: RemootioPlatform;

  private device!: RemootioDevice;

  // Configuration parameters
  private name!: string;
  private ipAddress!: string;
  private apiSecretKey!: string;
  private apiAuthKey!: string;
  private remootioVersion!: string;
  private pingInterval = 60000;
  private connectionAttempts = 0;
  private connectionAttemptLimit = 10;
  private autoConnectFallbackTimeSeconds = 60;
  private autoConnectFallbackTimeoutHandle;

  private enablePrimaryRelayOutput = false;
  private enableSecondaryRelayOutput = false;

  private primaryRelayService!: Service;
  private secondaryRelayService!: Service;

  private readonly currentDoorState!: typeof Characteristic.CurrentDoorState;
  private readonly targetDoorState!: typeof Characteristic.TargetDoorState;

  private currentState = -1; // To detect whether we have recevied an update
  private targetState = -1;
  private lastIncoming100ms = 0;
  private readonly t100msDelay = 500;

  private garageDoorOpenerService!: Service;
  //private informationService!: Service;

  // The constructor initializes variables

  constructor(platform: RemootioPlatform, accessory: PlatformAccessory) {
    this.accessory = accessory;
    this.api = platform.api;
    this.hap = this.api.hap;
    this.log = platform.log;
    this.platform = platform;

    this.currentDoorState = this.hap.Characteristic.CurrentDoorState;
    this.targetDoorState = this.hap.Characteristic.TargetDoorState;

    this.configureDevice();
  }

  configureDevice(): void {
    const accessory = this.accessory;
    const config = this.accessory.context.device;

    if (
      config === undefined ||
      config.ipAddress === undefined ||
      config.apiSecretKey === undefined ||
      config.apiAuthKey === undefined
    ) {
      this.log.error('Missing required config parameters, exiting');
      return;
    }

    // From configuration of this accessory
    this.name = config.name || 'Remootio Device';
    this.ipAddress = config.ipAddress;
    this.apiSecretKey = config.apiSecretKey;
    this.apiAuthKey = config.apiAuthKey;

    if (config.enablePrimaryRelayOutput !== undefined && config.enablePrimaryRelayOutput === true) {
      this.enablePrimaryRelayOutput = true;
    }

    this.log.debug('IP: ' + this.ipAddress);
    this.log.debug('SK: ' + this.apiSecretKey);
    this.log.debug('AK: ' + this.apiAuthKey);

    // Add a new Remootio device using remootio-api-client library
    this.device = new RemootioDevice(this.ipAddress, this.apiSecretKey, this.apiAuthKey, this.pingInterval);

    // Clear out stale services.
    const garageDoorService = accessory.getService(this.hap.Service.GarageDoorOpener);
    if (garageDoorService) {
      accessory.removeService(garageDoorService);
      this.log.debug('[%s] Removing garageDoorService', this.name);
    }

    const primaryRelayService = accessory.getService('PRIMARY_RELAY');
    if (primaryRelayService) {
      this.log.debug('[%s][%s] Removing primaryRelayService', this.name, primaryRelayService.displayName);
      accessory.removeService(primaryRelayService);
    }
    const secondaryRelayService = accessory.getService('SECONDARY_RELAY');
    if (secondaryRelayService) {
      this.log.debug('[%s][%s] Removing secondaryRelayService', this.name, secondaryRelayService.displayName);
      accessory.removeService(secondaryRelayService);
    }

    // Add garage door opener as long as primary replay is not enabled
    if (!config.enablePrimaryRelayOutput) {
      // Add the garage door opener service to the accessory.
      if (config.garageDoorName !== undefined && config.garageDoorName !== '') {
        this.log.debug('[%s] Setting garageDoorService name to [%s]', this.name, config.garageDoorName);
        this.garageDoorOpenerService = new this.hap.Service.GarageDoorOpener(config.garageDoorName);
      } else {
        this.log.debug('[%s] Setting garageDoorService name same as accessory name', this.name);
        this.garageDoorOpenerService = new this.hap.Service.GarageDoorOpener(this.name);
      }

      // Registering the listeners for the required characteristics
      // https://developers.homebridge.io/#/service/GarageDoorOpener
      accessory.addService(this.garageDoorOpenerService);

      this.garageDoorOpenerService
        .getCharacteristic(this.hap.Characteristic.CurrentDoorState)!
        .on(CharacteristicEventTypes.GET, this.getCurrentStateHandler.bind(this));

      this.garageDoorOpenerService
        .getCharacteristic(this.hap.Characteristic.TargetDoorState)!
        .on(CharacteristicEventTypes.GET, this.getTargetStateHandler.bind(this))
        .on(CharacteristicEventTypes.SET, this.setTargetStateHandler.bind(this));

      this.garageDoorOpenerService
        .getCharacteristic(this.hap.Characteristic.ObstructionDetected)!
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
          // Dummy return as this is not supported by Remootio devices at this point
          this.log.debug('[%s] ObstructionDetected was requested', this.name);
          callback(null, false);
        });
    }

    // Add primary relay service
    if (config.enablePrimaryRelayOutput !== undefined && config.enablePrimaryRelayOutput === true) {
      this.enablePrimaryRelayOutput = true;
      this.primaryRelayService = new this.hap.Service.Switch(config.primaryRelayName, 'PRIMARY_RELAY');
      accessory.addService(this.primaryRelayService);

      this.primaryRelayService
        .getCharacteristic(this.api.hap.Characteristic.On)
        .onSet(this.handlePrimarySet.bind(this));
      this.log.debug('[%s][%s] Primary Relay was added', this.name, config.primaryRelayName);
    }

    // Add secondary relay service
    if (config.enableSecondaryRelayOutput !== undefined && config.enableSecondaryRelayOutput === true) {
      this.enableSecondaryRelayOutput = true;
      this.secondaryRelayService = new this.hap.Service.Switch(config.secondaryRelayName, 'SECONDARY_RELAY');
      accessory.addService(this.secondaryRelayService);
      this.secondaryRelayService
        .getCharacteristic(this.api.hap.Characteristic.On)
        .onSet(this.handleSecondarySet.bind(this));
      this.log.debug('[%s][%s] Secondary Relay was added', this.name, config.secondaryRelayName);
    }

    // Update the manufacturer information for this device.
    accessory
      .getService(this.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.hap.Characteristic.Manufacturer, 'Remootio');

    // Registering the listeners for the Remootio API client
    // https://documents.remootio.com/docs/WebsocketApiDocs.pdf
    this.device.on('error', (err) => {
      this.log.error('[%s] Error: %s', this.name, err);
    });

    this.device.addListener('debug', (msg) => {
      this.log.debug('[%s] debug: %s', this.name, msg);
    });

    this.device.addListener('connected', () => {
      this.log.info('[%s] Connected', this.name);
      this.device.authenticate(); //Authenticate the session (required)
      this.connectionAttempts = 0; //Reset the connectionAttempts counter
    });

    this.device.addListener('authenticated', () => {
      this.log.info('[%s] Authenticated', this.name);
      this.device.sendHello();
    });

    this.device.addListener('connecting', () => {
      this.connectionAttempts++;
      this.log.debug('[%s] Connecting: attempt %d', this.name, this.connectionAttempts);
    });

    this.device.addListener('disconnect', (msg: string) => {
      this.log.debug('[%s] Disconnected: %s', this.name, msg);
      if (this.connectionAttempts > this.connectionAttemptLimit) {
        if (this.connectionAttempts < 100) {
          if (!this.autoConnectFallbackTimeoutHandle) {
            this.log.debug(
              '[%s] Too many connection attempts, falling back %d seconds',
              this.name,
              this.autoConnectFallbackTimeSeconds,
            );
            this.autoConnectFallbackTimeoutHandle = setTimeout(() => {
              this.log.debug('[%s] Fallback timer completed, retrying', this.name);
              this.autoConnectFallbackTimeoutHandle = undefined;
              this.device.connect(false);
            }, this.autoConnectFallbackTimeSeconds * 1000);
          }
        } else {
          this.log.error('[%s] Too many connection attempts, giving up', this.name);
        }
      } else {
        this.log.debug('[%s] Reconnecting', this.name);
        this.device.connect(false);
      }
    });

    this.device.addListener('incomingmessage', (frame: RemootioFrame, decryptedPayload: RemootioDecryptedPayload) => {
      this.handleIncomingMessage(frame, decryptedPayload);
    });

    this.device.addListener('outgoingmessage', (frame: RemootioTypedFrame) => {
      this.log.debug('[%s] Outgoing: %s', this.name, frame.type);
    });

    this.log.info('[%s] Finished initializing!', this.name);

    // Request to connect with Remootio device with auto-reconnect = true
    this.device.connect(false);
  }

  handleIncomingMessage(frame: RemootioFrame, decryptedPayload: RemootioDecryptedPayload): void {
    if (decryptedPayload !== undefined) {
      this.log.debug('[%s] Incoming:\n%s', this.name, JSON.stringify(decryptedPayload));
      if (decryptedPayload.event !== undefined && decryptedPayload.event.state !== undefined) {
        // As there are multiple sources for triggering a state change, such as remote control press, Remootio app,
        // we're syncing current and target states when we receive a StateChange event.
        if (decryptedPayload.event.type === 'StateChange') {
          this.lastIncoming100ms = decryptedPayload.event.t100ms;
          if (this.garageDoorOpenerService) {
            this.setCurrentDoorState(decryptedPayload.event.state);
            this.setTargetDoorState(decryptedPayload.event.state);
          }
          if (this.enablePrimaryRelayOutput) {
            this.setPrimaryRelayState(false);
          }
        }
        // SecondaryRelayTrigger
        if (decryptedPayload.event.type === 'SecondaryRelayTrigger' && this.enableSecondaryRelayOutput === true) {
          this.lastIncoming100ms = decryptedPayload.event.t100ms;
          this.setSecondaryRelayState(false);
        }
        // If the command is triggered via api key, it comes from homebridge.
        // Here we are setting the current door state to opening or closing, if there is a relay trigger event.
        if (decryptedPayload.event.type === 'RelayTrigger' && decryptedPayload.event.data?.keyType === 'api key') {
          this.lastIncoming100ms = decryptedPayload.event.t100ms;
          if (this.enablePrimaryRelayOutput) {
            this.setPrimaryRelayState(false);
          } else {
            if (decryptedPayload.event.state === 'open') {
              this.setCurrentDoorState('closing');
            } else {
              this.setCurrentDoorState('opening');
            }
          }
        }
      }
      if (decryptedPayload.response !== undefined && decryptedPayload.response.state !== undefined) {
        this.log.debug('[%s] Decrypted payload: %s', this.name, decryptedPayload.response.type);
        if (
          decryptedPayload.response.type === 'QUERY' &&
          decryptedPayload.response.t100ms - this.lastIncoming100ms > this.t100msDelay // wait xx ms before accepting a new state
        ) {
          if (this.garageDoorOpenerService) {
            this.setCurrentDoorState(decryptedPayload.response.state);
          }
          if (this.primaryRelayService) {
            this.setPrimaryRelayState(false);
          }
          if (this.secondaryRelayService) {
            this.setSecondaryRelayState(false);
          }
        }
      }
    } else {
      if (frame !== undefined) {
        switch (frame.type) {
          case 'PONG':
            this.log.debug('[%s] Incoming: %s', this.name, frame.type);
            break;
          case 'SERVER_HELLO':
            this.handleServerHello(frame);
            break;
          default:
            this.log.debug('[%s] Incoming: %s\n%s', this.name, frame.type, JSON.stringify(frame));
        }
      } else {
        this.log.debug('[%s] Incoming: \n%s', this.name, JSON.stringify(frame));
      }
    }
  }

  handleServerHello(frame: RemootioFrame) {
    const serverHello = frame as RemootioServerHello;
    const accessory = this.accessory;
    const remootioVersion = serverHello.remootioVersion as string;
    const serialNumber = serverHello.serialNumber as string;
    this.log.debug(
      '[%s] SERVER_HELLO: APIv: %d, S/N: %s, Version: %s',
      this.name,
      serverHello.apiVersion,
      serialNumber,
      remootioVersion,
    );
    this.remootioVersion = remootioVersion;
    // Update the manufacturer information for this device.
    accessory
      .getService(this.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.hap.Characteristic.Model, remootioVersion)
      .setCharacteristic(this.hap.Characteristic.SerialNumber, serialNumber);
  }

  setCurrentDoorState(state: string) {
    const accessory = this.accessory;
    const characteristics = accessory
      .getService(this.hap.Service.GarageDoorOpener)!
      .getCharacteristic(this.hap.Characteristic.CurrentDoorState);

    switch (state) {
      case 'open':
        this.currentState = this.currentDoorState.OPEN;
        this.log.info('[%s] Setting current state to OPEN', this.name);
        characteristics.updateValue(this.currentDoorState.OPEN);
        break;
      case 'closed':
        this.currentState = this.currentDoorState.CLOSED;
        this.log.info('[%s] Setting current state to CLOSED', this.name);
        characteristics.updateValue(this.currentDoorState.CLOSED);
        break;
      case 'opening':
        this.currentState = this.currentDoorState.OPENING;
        this.log.info('[%s] Setting current state to OPENING', this.name);
        characteristics.updateValue(this.currentDoorState.OPENING);
        break;
      case 'closing':
        this.currentState = this.currentDoorState.CLOSING;
        this.log.info('[%s] Setting current state to CLOSING', this.name);
        characteristics.updateValue(this.currentDoorState.CLOSING);
        break;
    }
  }

  setTargetDoorState(state: string) {
    const accessory = this.accessory;
    const characteristics = accessory
      .getService(this.hap.Service.GarageDoorOpener)!
      .getCharacteristic(this.hap.Characteristic.TargetDoorState);

    switch (state) {
      case 'open':
        if (this.targetState !== this.targetDoorState.OPEN) {
          this.targetState = this.targetDoorState.OPEN;
          this.log.info('[%s] Setting target state to OPEN', this.name);
          characteristics.updateValue(this.targetDoorState.OPEN);
        }
        break;
      case 'closed':
        if (this.targetState !== this.targetDoorState.CLOSED) {
          this.targetState = this.targetDoorState.CLOSED;
          this.log.info('[%s] Setting target state to CLOSED', this.name);
          characteristics.updateValue(this.targetDoorState.CLOSED);
        }
        break;
    }
  }

  setPrimaryRelayState(state: boolean) {
    //const accessory = this.accessory;
    const characteristics = this.primaryRelayService!.getCharacteristic(this.hap.Characteristic.On);

    if (state) {
      this.log.info('[%s] Setting primary relay state to true', this.name);
      characteristics.updateValue(true);
    } else {
      this.log.info('[%s] Setting primary relay state to false', this.name);
      characteristics.updateValue(false);
    }
  }

  setSecondaryRelayState(state: boolean) {
    //const accessory = this.accessory;
    const characteristics = this.secondaryRelayService!.getCharacteristic(this.hap.Characteristic.On);

    if (state) {
      this.log.info('[%s] Setting secondary relay state to true', this.name);
      characteristics.updateValue(true);
    } else {
      this.log.info('[%s] Setting secondary relay state to false', this.name);
      characteristics.updateValue(false);
    }
  }

  getCurrentStateHandler(callback: CharacteristicGetCallback): void {
    this.log.debug(
      '[%s] getCurrentStateHandler: Current door state: [%s]',
      this.name,
      this.currentState === this.currentDoorState.OPEN ? 'Open' : 'Closed',
    );
    if (this.currentState < 0) {
      callback(new Error('No value available'));
    } else {
      // Always return current state, so that the server does not emit an event to HAP
      callback(null, this.currentState);
    }
    // Always send a query request to the garage door opener. When the request returned, send the event via setCurrentDoorState()
    this.device.sendQuery();
  }

  getTargetStateHandler(callback: CharacteristicGetCallback): void {
    this.log.debug(
      '[%s] getTargetStateHandler: Target door state: [%s]',
      this.name,
      this.targetState === this.targetDoorState.OPEN ? 'Open' : 'Closed',
    );
    if (this.targetState < 0) {
      if (this.currentState < 0) {
        callback(new Error('No value available'));
        return;
      } else {
        this.targetState = this.currentState;
        this.log.info('[%s] Target state is uninitialized, setting target state same as current state', this.name);
      }
    }
    callback(null, this.targetState);
  }

  /*
   * This method implements the logic for sending open or close to the devices.
   * In current implementation, it will not resend a command if the target door state is the same as previous call.
   */
  setTargetStateHandler(newValue: CharacteristicValue, callback: CharacteristicSetCallback): void {
    // call sendOpen or sendClose based on value

    if (newValue === undefined || newValue === null) {
      this.log.debug('[%s] setTargetStateHandler: invalid new value', this.name);
      callback(new Error('no value'));
      return;
    }
    const oldState = this.targetState;
    const newState = newValue as number;

    this.log.info(
      '[%s] setTargetStateHandler: New value: %s Old value: %s',
      this.name,
      garageDoorOpenerStateToString[newState],
      garageDoorOpenerStateToString[oldState],
    );
    if (newState !== oldState) {
      if (!this.device.isConnected || !this.device.isAuthenticated) {
        this.log.warn('[%s] Device is not connected', this.name);
        return callback(new Error('Not Connected'));
      }
      this.targetState = newState;
      if (newState === this.targetDoorState.OPEN) {
        this.log.info('[%s] Sending sendOpen()', this.name);
        this.device.sendOpen();
      } else if (newState === this.targetDoorState.CLOSED) {
        this.log.info('[%s] Sending sendClose()', this.name);
        this.device.sendClose();
      }
    }

    callback(null);
  }

  /*
   * This method implements the logic for sending a trigger to the primary relay.
   *
   */
  handlePrimarySet(value: CharacteristicValue): void {
    this.log.info('[%s] handlePrimarySet: value: %s', this.name, value);
    if (value === true) {
      this.device.sendTrigger();
    }
  }

  /*
   * This method implements the logic for sending a trigger to the secondary relay.
   *
   */
  handleSecondarySet(value: CharacteristicValue): void {
    // call On if not remootio-1 and if value is true
    if (this.remootioVersion !== 'remootio-1') {
      this.log.info('[%s] handleSecondarySet: value: %s', this.name, value);
      if (value === true) {
        this.device.sendTriggerSecondary();
      }
    } else {
      this.log.warn(
        '[%s] Remotio version [%s] does not support secondary relay trigger',
        this.name,
        this.remootioVersion,
      );
    }
  }

  handleOnGet(): void {
    this.log.info('[%s] handleOnGet', this.name);
  }
}
