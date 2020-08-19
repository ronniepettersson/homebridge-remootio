
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

interface RemootioEvent {
  event: {
    cnt: number,
    type: string,
    state: string,
    t100ms: number
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

type RemootioMessage = RemootioResponse & RemootioEvent;

let device: RemootioDevice;

export class RemootioHomebridgeAccessory implements AccessoryPlugin {

    private readonly log: Logging;
    private readonly name: string;
    
    // TODO
    private ip_address = '';
    private api_secret_key = '';
    private apt_auth_key = '';
    private currentDoorState = 0;
    private targetDoorState = 0;
    
    private readonly device: RemootioDevice;
  
    private readonly garageDoorOpenerService: Service;
    private readonly informationService: Service;
  
    constructor(log: Logging, config: AccessoryConfig, api: API) {
      
      
      this.log = log;
      this.name = config.name;
      this.ip_address = config.ip_address;
      this.ip_address = config.api_secret_key;
      this.ip_address = config.apt_auth_key;

      device = new RemootioDevice(this.ip_address,
        this.api_secret_key,
        this.apt_auth_key);
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

      
      this.device.addListener('connecting', ()=>{
        log.info(this.name + ' connecting ...');
      });

      this.device.addListener('connected', ()=>{
        log.info(this.name + ' connected');
        this.device.authenticate(); //Authenticate the session (required)
      });
      
      this.device.addListener('authenticated', ()=>{
        log.info(this.name + ' conneauthenticated');
        this.device.sendQuery(); 
      });

      this.device.addListener('incomingmessage', (frame: unknown, payload) => this.handleIncomingMessage(payload));

      this.device.connect(true);

      log.info('Remootio Garage Door Opener finished initializing!');
    }
    
    handleIncomingMessage(decryptedPayload: RemootioMessage ) : void {
      if (decryptedPayload !== null ){
        //We are interested in events 
        if (decryptedPayload.event ){ //It's an event frame containing a log entry from Remootio
          const rowToLog = new Date().toISOString() + ' ' + JSON.stringify(decryptedPayload) + '\r\n';
          this.log.info(rowToLog);
        }
        if (decryptedPayload.response ){ //It's an event frame containing a log entry from Remootio
          const rowToLog = new Date().toISOString() + ' ' + JSON.stringify(decryptedPayload) + '\r\n';
          this.log.info(rowToLog);
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


