<p align="center">
<a href="https://www.remootio.com/"><img src="https://raw.githubusercontent.com/ronniepettersson/homebridge-remootio/master/assets/REMOOTIO__LOGO_x40.png" ></a>
</p>

# Homebridge Remootio

[Homebridge](https://homebridge.io) Plugin Providing [Remootio](https://www.remootio.com/) Support.

## Usage
First of all make sure that the Remootio Websocket API is enabled for your Remootio device in the Remootio app. Please take note of the API Secret Key and API Auth Key along with the IP address of the device, as you will need these.

## Limitations

This plugin is still under development. It is currently limited to [Remootio 1](https://www.remootio.com/products/remootio) with `Gate status sensor` installed. When restarting the plugin, the device may not retain the configured room in Apple Home.

## Installation

If you are new to Homebridge, please first read the [Homebridge](https://homebridge.io) [documentation](https://github.com/homebridge/homebridge/wiki) and installation instructions before proceeding.

### Installation via Homebridge Config UI X

1. Search for `Homebridge Remootio` on the Plugins tab of [Config UI X](https://github.com/oznu/homebridge-config-ui-x)
2. Install the `Homebridge Remootio` plugin and use the configuation form to configure your Remootio device.    

### Manual install

1. Install the package using: `npm install homebridge-remootio`.
2. Edit or add `accessories` section in the `config.json` file in your home directory inside `homebridge`. See below for information.

### Plugin configuration 

```json
"accessories": [
    {
        "name": "<name of the device you want to appear in HomeKit>",
        "ipAddress": "<the ip address of your Remootio device>",
        "apiSecretKey": "<API Secret Key>",
        "apiAuthKey": "<API Auth Key>",
        "accessory": "Remootio"
    }
]
```



