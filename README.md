
<p align="center">
<a href="https://www.remootio.com/"><img src="https://raw.githubusercontent.com/ronniepettersson/homebridge-remootio/master/assets/REMOOTIO__LOGO_x40.png" ></a>
</p>


# Homebridge Remootio
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
<a href="https://www.npmjs.com/package/homebridge-remootio"><img title="npm version" src="https://badgen.net/npm/v/homebridge-remootio" ></a>
[![npm](https://badgen.net/npm/dt/homebridge-remootio?label=downloads)](https://www.npmjs.com/package/homebridge-remootio)



[Homebridge](https://homebridge.io) Plugin Providing [Remootio](https://www.remootio.com/) Support. This plugin supports <B>Remootio 1</B>, <B>Remootio 2</B> and <B>Remootio 3</B> with software versions >=2.24 that provide the [V3 API](https://github.com/remootio/remootio-api-documentation/blob/master/websocket_api_v3_specification.md). 

## Usage
First of all make sure that the Remootio Websocket API is enabled `with logging` for your Remootio device in the Remootio app. Please take note of the API Secret Key and API Auth Key along with the IP address of the device, as you will need these. 

The `Gate status sensor` is required for the plugin to appear as a Garage Door Opener in HomeKit. If you don't use, or have the gate status sensor, the plugin will appear as a Switch. For remootio-2 and remootio-3 devices, you can also expose the secondary relay as Switch. 

The Doorbell add-on requires the `Doorbell interface` to be enabled and a push button or doorbell switch to be installed on input 2 (terminal 5).

## Change log
1.3.8 Added support for the doorbell add-on.

1.3.4 You can now configure the primary relay as a generic relay. This is useful if you don't have the sensor to indicate if a garage door or gate is open or closed. 

1.3.2 You can now specify the hostname of the Remootio device instead of the ip address.  

1.3.1 The secondary relay on Remootio-2 and Remootio-3 devices can now be seprately controlled via Homekit, after one of the outputs is configured as `free relay output` via the mobile app. Two new parameters have been added to the plugin configuration to enable and name the secondary relay.

## Installation

If you are new to Homebridge, please first read the [Homebridge](https://homebridge.io) [documentation](https://github.com/homebridge/homebridge/wiki) and installation instructions before proceeding.

1. Install the `Gate status sensor` and enable it in the app.

### Installation via Homebridge Config UI X

1. Search for `Homebridge Remootio` on the Plugins tab of [Config UI X](https://github.com/oznu/homebridge-config-ui-x)
2. Install the `Homebridge Remootio` plugin and use the configuration form to configure your Remootio device(s).    

### Manual install

1. Install the package using: `npm install homebridge-remootio`.
2. Edit or add `platforms` section in the `config.json` file in your home directory inside `homebridge`. See below for information.

### Plugin configuration 

```json
"platforms": [
    {
        "platform": "Remootio",
        "name": "Remootio",
        "devices": [
            {
                "name": "<display name of the Garage Door Opener accessory you want to appear in HomeKit>",
                "ipAddress": "<the ip address or hostname of your Remootio device>",
                "apiSecretKey": "<API Secret Key>",
                "apiAuthKey": "<API Auth Key>",
                "garageDoorName": "Garage Door",
                "enablePrimaryRelayOutput": false,
                "enableSecondaryRelayOutput": true,
                "enableDoorbell": true,
                "primaryRelayName": "Primary Relay",
                "secondaryRelayName": "Secondary Relay",
                "doorbellName": "Doorbell"
            
            },
                {
                "name": "<display name of the Garage Door Opener accessory you want to appear in HomeKit>",
                "ipAddress": "<the ip address or hostname of your Remootio device>",
                "apiSecretKey": "<API Secret Key>",
                "garageDoorName": "Garage Door",
                "enablePrimaryRelayOutput": false,
                "enableSecondaryRelayOutput": true,
                "enableDoorbell": true,
                "primaryRelayName": "Primary Relay",
                "secondaryRelayName": "Secondary Relay",
                "doorbellName": "Doorbell"
            },
        ]
    }
]
```
## Troubleshooting
Most "No Response" issues are related to the device WebSocket API not being fully enabled, and therefore does not respond to API calls. To address this problem, use the Remootio mobile app to disable and then enable the WebSocket API. Thereafter, reboot the device.   

## Discovering the hostname of my Remootio device
The hostname of the Remootio device can be constructed by combining the string "remootio_", the serial number, and the local domain name. You can find the serial number of your device in the Remootio mobile app under Settings->Bluetooth information. It appears to be a combination of the Wi-Fi mac address and an unknown set of characters. 
Another method is to use the "Discovery" app on an iOS device or a Mac and search for the _remootio._tcp service. In the corresponding information to your device serial numbers, you would find the hostname and IP address. 

An example hostname would be: remootio_246f28abf4d1ctsyxnhs.local 


## Screenshots

![Open Gate in Apple Home app](/assets/OPEN_GATE.PNG) ![Closed Garage with optional relay switch in Apple Home app](/assets/GARAGE_W_OPTIONAL_RELAY.PNG)
