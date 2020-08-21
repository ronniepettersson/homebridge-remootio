/* Copyright (C) 2020 Ronnie Pettersson. All rights reserved
*
*  remootio-accessory.ts: Base class for Remootio accessories
*
*/

import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  HAP,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logging,
  Service,
} from 'homebridge';

import RemootioDevice = require('remootio-api-client');


// Here are a subset of the Remootio API payloads sent by the device over web sockets
type RemootioEncryptedPayload = {
  type: 'ENCRYPTED',
  data: {
    payload: string,
    iv: string
  },
  mac: string
}
type RemootioError = {
  type: 'ERROR',
  errorMessage: string
}
type RemootioPing = {
  type: 'PING'
}
type RemootioHello = {
  type: 'HELLO',
  apiVersion: number,
  message: string
}

interface RemootioChallenge {
  challenge: {
    sessionKey: string,
    initialActionId: number
  }
}

interface RemootioStateChangeEvent {
  event: {
    cnt: number,
    type: string,
    state: string,
    t100ms: number,
  }
}
interface RemootioTriggeredEvent {
  event: {
    cnt: number,
    type: string,
    state: string,
    t100ms: number,
    data: {
      keyNr: number,
      keyType: string,
      via: string
    }
  }
}
interface RemootioLeftOpen {
  event: {
    cnt: number,
    type: 'LeftOpen',
    state: string,
    t100ms: number,
    data: {
      timeOpen100ms: number
    }
  }
}
interface RemootioResponse {
  response: { 
    type: string,
    id: number,
    success: boolean,
    state: string,
    t100ms: number,
    relayTriggered: boolean,
    errorCode: string
  }
}



type RemootioTypedFrame = 
  RemootioEncryptedPayload |  
  RemootioError |
  RemootioPing |
  RemootioHello;

type RemootioFrame = 
  RemootioTypedFrame &
  RemootioChallenge;


type RemootioDecryptedPayload = 
  RemootioStateChangeEvent &
  RemootioTriggeredEvent & 
  RemootioLeftOpen & 
  RemootioResponse;



export class RemootioHomebridgeAccessory implements AccessoryPlugin {

    private readonly log: Logging;
    private readonly api: API;
    private readonly hap: HAP;
    private readonly name: string;
    
    // TODO
    private readonly ip_address: string;
    private readonly api_secret_key: string;
    private readonly api_auth_key: string;
    private readonly pingInterval = 60000;
    
    private readonly currentDoorState;
    private readonly targetDoorState;

    private currentState = -1; // To detect whether we have recevied an update
    private targetState = -1;
    
    private readonly device: RemootioDevice;
  
    private readonly garageDoorOpenerService;
    private readonly informationService;
  
    // The constructor initializes variables 
    constructor(log: Logging, config: AccessoryConfig, api: API) {
      
      this.api = api;
      this.hap = this.api.hap;
      this.log = log;
      
      this.currentDoorState = this.hap.Characteristic.CurrentDoorState;
      this.targetDoorState = this.hap.Characteristic.TargetDoorState;
      
      // From configuration of this accessory
      this.name = config.name;
      this.ip_address = config.ip_address;
      this.api_secret_key = config.api_secret_key;
      this.api_auth_key = config.api_auth_key;

      // If we don't have all the required configuration parameters, don't continue
      if( this.ip_address === undefined || this.api_secret_key === undefined || this.api_auth_key === undefined){
        log.warn('Missing required config parameters, exiting');
        return;
      }

      // Add a new Remootio device using remootio-api-client library
      this.device = new RemootioDevice(this.ip_address,
        this.api_secret_key,
        this.api_auth_key,
        this.pingInterval);
      
      // Creating new Garage door opener service
      this.garageDoorOpenerService = new this.hap.Service.GarageDoorOpener(this.name);

      // Registering the listeners for the required characteristics
      // https://developers.homebridge.io/#/service/GarageDoorOpener 
      this.garageDoorOpenerService.getCharacteristic(this.hap.Characteristic.CurrentDoorState)
        .on(CharacteristicEventTypes.GET, this.getCurrentStateHandler.bind(this));

      this.garageDoorOpenerService.getCharacteristic(this.hap.Characteristic.TargetDoorState)
        .on(CharacteristicEventTypes.GET, this.getTargetStateHandler.bind(this));
  
      this.garageDoorOpenerService.getCharacteristic(this.hap.Characteristic.TargetDoorState)
        .on(CharacteristicEventTypes.SET, this.setTargetStateHandler.bind(this));
        
      this.garageDoorOpenerService.getCharacteristic(this.hap.Characteristic.ObstructionDetected)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
          // Dummy return
          log.info('ObstructionDetected was requested' );
          callback(null, false);
        });   


      this.informationService = new this.hap.Service.AccessoryInformation()
        .setCharacteristic(this.hap.Characteristic.Manufacturer, 'Remootio')
        .setCharacteristic(this.hap.Characteristic.Model, 'Remootio');

      // Registering the listeners for the Remootio API client
      // https://documents.remootio.com/docs/WebsocketApiDocs.pdf 
      this.device.on('error', (err) => {
        log.error('whoops! there was an error: ' + err );
      });

      this.device.addListener('connected', ()=>{
        log.info(this.name + ' connected');
        this.device.authenticate(); //Authenticate the session (required)
      });
      
      this.device.addListener('authenticated', ()=>{
        log.info(this.name + ' authenticated');
        //this.device.sendQuery(); 
      });

      this.device.addListener('incomingmessage', (frame: RemootioFrame, decryptedPayload: RemootioDecryptedPayload) => {
        this.handleIncomingMessage(frame, decryptedPayload);
      });

      // Request to connect with Remootio device with auto-reconnect = true
      this.device.connect(true);

      log.info('Remootio Garage Door Opener finished initializing!');
    }
    


    handleIncomingMessage(frame: RemootioFrame, decryptedPayload: RemootioDecryptedPayload ) : void {
      if (decryptedPayload !== undefined ){
        const rowToLog = new Date().toISOString() + ' ' + JSON.stringify(decryptedPayload);
        this.log.debug(rowToLog);

        if(decryptedPayload.event !== undefined && decryptedPayload.event.state !== undefined ) {
          this.setCurrentDoorState(decryptedPayload.event.state);
        }
        if(decryptedPayload.response !== undefined && decryptedPayload.response.state !== undefined ) {
          this.setCurrentDoorState(decryptedPayload.response.state);
        }
      } else { 
        if (frame !== undefined) {
          if(frame.challenge === undefined && frame.type !== undefined ) {
            const rowToLog = new Date().toISOString() + ' ' + frame.type;
            this.log.debug(rowToLog);
          } else if ( frame.challenge !== undefined ){
            const rowToLog = new Date().toISOString() + ' Challenge';
            this.log.info(rowToLog);
          }
        }
      }
    }

    setCurrentDoorState(state: string) {
      
      switch(state) { 
        case 'open':
          this.currentState = this.currentDoorState.OPEN;
          this.log.info('Setting current state to OPEN');
          break;
        case 'closed':
          this.currentState = this.currentDoorState.CLOSED;
          this.log.info('Setting current state to CLOSED');
          break;
          
      } 
    }

    getCurrentStateHandler(callback: CharacteristicGetCallback): void {
      this.log.debug('getCurrentStateHandler: Current door state: [' + this.currentState + '] ' + 
        (this.currentState === this.currentDoorState.OPEN ? 'Open': 'Closed'));
      if(this.currentState < 0 ) {
        this.device.sendQuery();
        callback(new Error('No value available'));
      } else {
        callback(null, this.currentState);
      }
    }

    getTargetStateHandler(callback: CharacteristicGetCallback): void {
      this.log.debug('getTargetStateHandler: Target door state: [' + this.targetState + '] ' + 
        (this.targetState === this.targetDoorState.OPEN ? 'Open': 'Closed'));
      if(this.targetState < 0 ) {
        if(this.currentState < 0) {
          callback(new Error('No value available'));
          return;
        } else { 
          this.targetState = this.currentState;
          this.log.info('Target state is uninitialized, setting target state same as current state');
        } 
      } 
      callback(null, this.targetState);
    }

    /* 
    * This method implements the logic for sending open or close to the devices.
    * In current implementation, it will not resend a command if the target door state is the same as previous call.
    */
    setTargetStateHandler(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
      // call sendOpen or sendClose based on value
      const targetValue = value as number;
      if( targetValue === this.targetState) {
        this.log.info('setTargetStateHandler: New value same as previous value ' +
          (targetValue === this.targetDoorState.OPEN ? 'Open': 'Close' ));        
      } else {
        
        this.log.info('setTargetStateHandler: New value: [' + targetValue + '] Old value [' + this.targetState + ']');
        this.targetState = targetValue;
        if(targetValue === this.targetDoorState.OPEN) {
          this.log.info('sendOpen()');
          this.device.sendOpen();
        } else if(targetValue === this.targetDoorState.CLOSED) {
          this.log.info('sendClose()');
          this.device.sendClose();
        }
      }

      callback(null);
    }


    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify(): void {
      this.log('Identify!');
    }
  
    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices(): Service[] {
      return [
        this.informationService,
        this.garageDoorOpenerService,
      ];
    }
  
}


