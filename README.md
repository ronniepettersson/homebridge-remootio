# Homebridge Remootio

[Homebridge](https://homebridge.io) Plugin Providing [Remootio](https://www.remootio.com/) Support.

## Limitations

This plugin is still under development. It is currently limited to `Remootio 1` with `Gate status sensor` installed.

## Installation

If you are new to Homebridge, please first read the [Homebridge](https://homebridge.io) [documentation](https://github.com/homebridge/homebridge/wiki) and installation instructions before proceeding.

If you have installed the [Homebridge Configuration web UI](https://github.com/oznu/homebridge-config-ui-x) you can install this plugin by going to the Plugins tab and searching for the homebridge-remootio 


Install the package using npm:
```
npm install homebridge-remootio
```

## Usage
First of all make sure that the Remootio Websocket API is enabled for your Remootio device in the Remootio app. Please take note of the API Secret key and API Auth Key along with the IP address of the device, as you will need these.

## Plugin configuration
If you have installed the [Homebridge Configuration web UI](https://github.com/oznu/homebridge-config-ui-x) go ahead create a new accessory. 
If you chose to configure the plugin manually, you will need to add a section in the `config.json` file in your homedirectory inside `homebridge`.

```js
"accessories": [
    {
        "name": "<name of the device you want to appear in HomeKit>",
        "ipAddress": "<the ip address of your Remootio device>",
        "apiSecretKey": "<API Secret Key>",
        "apiAuthKey": "<API Authorization Key>",
        "accessory": "Remootio"
    }
]
```



