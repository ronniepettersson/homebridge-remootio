
import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logging,
  Service,
} from 'homebridge';


import RemootioDevice = require('remootio-api-client');

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

let device: RemootioDevice;

export class RemootioHomebridgeAccessory implements AccessoryPlugin {

    private readonly log: Logging;
    private readonly name: string;
    
    // TODO
    private readonly ip_address: string;
    private readonly api_secret_key: string;
    private readonly api_auth_key: string;
    private currentDoorState = 0;
    private targetDoorState = 0;
    
    private readonly device: RemootioDevice;
  
    private readonly garageDoorOpenerService: Service;
    private readonly informationService: Service;
  
    constructor(log: Logging, config: AccessoryConfig, api: API) {
      
      
      this.log = log;
      this.name = config.name;
      this.ip_address = config.ip_address;
      this.api_secret_key = config.api_secret_key;
      this.api_auth_key = config.api_auth_key;

      log.info( 'IP: ' + this.ip_address );
      log.info( 'SK: '+ this.api_secret_key );
      log.info( 'AK: ' + this.api_auth_key );

      device = new RemootioDevice(this.ip_address,
        this.api_secret_key,
        this.api_auth_key);
      this.device = device;

  
      this.garageDoorOpenerService = new api.hap.Service.GarageDoorOpener(this.name);


      
      this.garageDoorOpenerService.getCharacteristic(api.hap.Characteristic.CurrentDoorState)
        .on(CharacteristicEventTypes.GET, this.getCurrentStateHandler.bind(this));

      this.garageDoorOpenerService.getCharacteristic(api.hap.Characteristic.TargetDoorState)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
          // TODO -> call .sendQuery() 
          log.info('Target state of the Garage Door Opener was returned: ' + (this.targetDoorState ? 'Closed': 'Open'));
          callback(undefined, this.targetDoorState);
        })          
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          // call sendOpen or sendClose
          this.targetDoorState = value as number;
          log.info('Target state was set to: ' + (this.targetDoorState? 'Close': 'Open'));
          callback();
        });
      
      this.garageDoorOpenerService.getCharacteristic(api.hap.Characteristic.ObstructionDetected)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
          // Dummy return
          log.info('ObstructionDetected was requested' );
          callback(undefined, false);
        });   


      this.informationService = new api.hap.Service.AccessoryInformation()
        .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Remootio')
        .setCharacteristic(api.hap.Characteristic.Model, 'Remootio');

      
      //this.device.addListener('connecting', ()=>{
      //  log.info(this.name + ' connecting ...');
      //});

      this.device.addListener('connected', ()=>{
        log.info(this.name + ' connected');
        this.device.authenticate(); //Authenticate the session (required)
      });
      
      this.device.addListener('authenticated', ()=>{
        log.info(this.name + ' authenticated');
        this.device.sendQuery(); 
      });

      this.device.addListener('incomingmessage', (frame: RemootioFrame, decryptedPayload: RemootioDecryptedPayload) => 
        this.handleIncomingMessage(frame, decryptedPayload));

      this.device.connect(true);

      log.info('Remootio Garage Door Opener finished initializing!');
    }
    
    handleIncomingMessage(frame: RemootioFrame, decryptedPayload: RemootioDecryptedPayload ) : void {
      if (decryptedPayload !== undefined ){
        const rowToLog = new Date().toISOString() + ' ' + JSON.stringify(decryptedPayload) + '\r\n';
        this.log.info(rowToLog);

      } else { 
        if (frame !== undefined) {
          if(frame.challenge === undefined && frame.type !== undefined ) {
            const rowToLog = new Date().toISOString() + ' ' + frame.type + '\r\n';
            this.log.info(rowToLog);
          } else if ( frame.challenge !== undefined ){
            const rowToLog = new Date().toISOString() + ' Challenge \r\n';
            this.log.info(rowToLog);
          }
        }
      }

    }


    getCurrentStateHandler(callback: CharacteristicGetCallback): void {
 
      this.device.sendQuery();
      this.log.info('Current state of the Garage Door Opener was returned: ' + (this.currentDoorState ? 'Closed': 'Open'));
      callback(null, this.currentDoorState);
    }

    setTargetStateHandler(callback: CharacteristicSetCallback): void {

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


