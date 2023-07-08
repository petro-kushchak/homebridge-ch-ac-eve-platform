# Cooper&Hunter AC (based on Gree API) Platform (homebridge-ch-gree-ac-eve-platform)

This plugin automatically detects Gree AC's and add them as accessories with the following features:

- Heating (With configs for min and max temperature values)
- Cooling (With configs for min and max temperature values)
- Temperature Unit can't be changed, but if is changed from the normal remote,
  it will be updated in the app.
- If you disconnect an AC and reconnect it to wifi, it will automatically bind to it
  no manual action is required
- Fan speeds for 3 Speed units and 5 Speed units
- Turn off/on the light

### For speed:

- 0 = Auto
- 1 = Low
- 2 = Medium-Low (not available on 3-speed units)
- 3 = Medium
- 4 = Medium-High (not available on 3-speed units)
- 5 = High
- 6 = Turbo (For all units, turbo is the max speed)

### Config:

```json
{
  "platforms": [
    {
      "name": "Cooper&Hunter ACs",
      "manufacturer": "Cooper&Hunter",
      // Set this to the router's broadcast address
      // in order to can scan for ACs
      "broadcastAddress": "192.168.1.255",
      // If is a 3-Speed unit, set this to true
      "threeSpeedUnit": true,
      "platform": "ChGreeACPlatformWithWebHooks",
      "coolingMinTemp": 16,
      "coolingMaxTemp": 30,
      "heatingMinTemp": 16,
      "heatingMaxTemp": 30,
      "httpPort": 4567
    }
  ]
}
```

## AC room temperature
Some of Cooper&Hunter ACs are not exposing room temperature over APIs, so there is a need to provide AC temperature from other source.

## Endpoint for AC temperature
This plugin supports temperature updates from http web hook. You can enable HomeKit automation to send room temperature sensor information.
Once plugin is started, it starts http server with port httpPort. Currently plugin supports URL (example with Homebridge Raspberry Pi setup and default httpPort: 4567):
```
GET http://homebridge.localhost:4567/temp/<ac-id>/21.5%32%C
```

## Eve app temperature history

- AC temperature updates are stored using fakegato lib, so when open AC accessory with Eve app its possible to see AC temperature change history
- when AC accessory starts it tries to read last logged temperature from fakegato lib storage

Fakegato  open source project [fakegato-history](https://github.com/simont77/fakegato-history). 



## Credits

Based on `tomikaa87` research on https://github.com/tomikaa87/gree-remote
using a NodeJS API implementation made by me at https://github.com/RaresAil/homebridge-gree-ac
