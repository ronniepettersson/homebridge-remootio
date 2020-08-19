
import {
    AccessoryConfig,
    AccessoryPlugin,
//    API,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    HAP,
    Logging,
    Service
  } from "homebridge";

import RemootioDevice  = require("remootio-api-client");


let hap: HAP;
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
    private device: RemootioDevice;
  
    private readonly garageDoorOpenerService: Service;
    private readonly informationService: Service;
  
    constructor(log: Logging, config: AccessoryConfig){ //}, api: API) {
      
      
      this.log = log;
      this.name = config.name;
      this.ip_address = config.ip_address;
      this.ip_address = config.api_secret_key;
      this.ip_address = config.apt_auth_key;

      device = new RemootioDevice(this.ip_address,
                                        this.api_secret_key,
                                        this.apt_auth_key);
      this.device = device;

  
      this.garageDoorOpenerService = new hap.Service.GarageDoorOpener(this.name);


      
      this.garageDoorOpenerService.getCharacteristic(hap.Characteristic.CurrentDoorState)
        .on(CharacteristicEventTypes.GET, this.getCurrentStateHandler.bind(this));

      this.garageDoorOpenerService.getCharacteristic(hap.Characteristic.TargetDoorState)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            // TODO -> call .sendQuery() 
            log.info("Target state of the Garage Door Opener was returned: " + (this.targetDoorState ? "Closed": "Open"));
            callback(undefined, this.targetDoorState);
        })          
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            // call sendOpen or sendClose
            this.targetDoorState = value as number;
            log.info("Target state was set to: " + (this.targetDoorState? "Close": "Open"));
            callback();
        });
      
        this.garageDoorOpenerService.getCharacteristic(hap.Characteristic.ObstructionDetected)
        .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            // Dummy return
            log.info("ObstructionDetected was requested" );
            callback(undefined, false);
        })   


      this.informationService = new hap.Service.AccessoryInformation()
        .setCharacteristic(hap.Characteristic.Manufacturer, "Remootio")
        .setCharacteristic(hap.Characteristic.Model, "Remootio");

      
      this.device.addListener('connecting',()=>{
        log.info(this.name + ' connecting ...');
      });

      this.device.addListener('connected',()=>{
        log.info(this.name + ' connected');
        this.device.authenticate(); //Authenticate the session (required)
      });
      
      this.device.addListener('authenticated',()=>{
        log.info(this.name + ' conneauthenticated');
        this.device.sendQuery(); 
      });

      this.device.addListener('incomingmessage',(frame: unknown ,payload: unknown) => this.handleIncomingMessage(payload))

      this.device.connect(true);

      log.info("Remootio Garage Door Opener finished initializing!");
    }
    
    handleIncomingMessage(decryptedPayload: unknown) : void {
      if (decryptedPayload !== undefined){
        //We are interested in events 
        if (decryptedPayload.event && decryptedPayload.event !== undefined){ //It's an event frame containing a log entry from Remootio
            const rowToLog = new Date().toISOString() + ' ' + JSON.stringify(decryptedPayload) + '\r\n';
            this.log.info(rowToLog);
        }
      }

    }


    getCurrentStateHandler(callback: CharacteristicGetCallback): void {
 
        this.device.sendQuery();
        this.log.info("Current state of the Garage Door Opener was returned: " + (this.currentDoorState ? "Closed": "Open"));
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
      this.log("Identify!");
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


