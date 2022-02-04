
<p align="center">
<a href="https://www.remootio.com/"><img src="https://raw.githubusercontent.com/ronniepettersson/homebridge-remootio/master/assets/REMOOTIO__LOGO_x40.png" ></a>
</p>


# Homebridge Remootio
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
<a href="https://www.npmjs.com/package/homebridge-remootio"><img title="npm version" src="https://badgen.net/npm/v/homebridge-remootio" ></a>
[![npm](https://badgen.net/npm/dt/homebridge-remootio?label=downloads)](https://www.npmjs.com/package/homebridge-remootio)



[Homebridge](https://homebridge.io) Plugin Providing [Remootio](https://www.remootio.com/) Support. This plugin supports both [Remootio 1](https://www.remootio.com/products/remootio) and [Remootio 2](https://www.remootio.com/products/remootio) with software version >=2.23 that provides the new [V2 API](https://github.com/remootio/remootio-api-documentation/blob/master/websocket_api_v2_specification.md).

## Usage
First of all make sure that the Remootio Websocket API is enabled `with logging` for your Remootio device in the Remootio app. Please take note of the API Secret Key and API Auth Key along with the IP address of the device, as you will need these. Install the `Gate status sensor` and enable it in the app.

## Installation

If you are new to Homebridge, please first read the [Homebridge](https://homebridge.io) [documentation](https://github.com/homebridge/homebridge/wiki) and installation instructions before proceeding.

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
                "name": "<name of the device you want to appear in HomeKit>",
                "ipAddress": "<the ip address of your Remootio device>",
                "apiSecretKey": "<API Secret Key>",
                "apiAuthKey": "<API Auth Key>"
            },
                {
                "name": "<name of the device you want to appear in HomeKit>",
                "ipAddress": "<the ip address of your Remootio device>",
                "apiSecretKey": "<API Secret Key>",
                "apiAuthKey": "<API Auth Key>"
            },
        ]
    }
]
```
## Troubleshooting
Most "No Response" issues are related to the device WebSocket API not being fully enabled, and therefore does not respond to API calls. To address this problem, use the Remootio mobile app to disable and then enable the WebSocket API. Thereafter, reboot the device.   


