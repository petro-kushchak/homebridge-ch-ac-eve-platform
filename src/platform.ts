import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic
} from 'homebridge';

import { DeviceFullInfo, DevicePackInfo } from 'gree-ac-api/lib/@types';
import { Device, DeviceFinder } from 'gree-ac-api';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import ACContext from './@types/ACContext';
import { PlatformAC } from './PlatformAC';
import { AutomationReturn, HttpService } from './services/httpService';

export class Platform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory<ACContext>[] = [];
  private readonly registeredDevices: PlatformAC[] = [];
  private readonly httpService: HttpService;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    DeviceFinder.on('device-updated', this.onDeviceUpdated.bind(this));
    DeviceFinder.on('device-found', this.onDeviceFound.bind(this));

    this.log.debug('Finished initializing platform:', this.config.name);
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      DeviceFinder.scan(this.config.broadcastAddress, 0);
    });

    this.httpService = new HttpService(this.config.httpPort as number, this.log);
    this.httpService.start((uri: string) => this.httpHandler(uri));
  }

  httpHandler(uri: string): AutomationReturn {
    this.log.info(`Received request: ${uri}`);

    const parts = uri.split('/');

    if (parts.length < 3) {
      return {
        error: true,
        message: 'Malformed uri',
      };
    }

    // update accessory temp value
    // uri example: /temp/<ac-id>/22.5%C2%B0C
    // usually due to HomeKit automation when original uri is /temp/123/22.5C

    if (parts[1] === 'temp') {
      const deviceId = parts[2];
      const device = this.registeredDevices.find((plat) => {
        this.log.info(`registeredDevices: ${plat.Mac} `);

        return plat.Mac === deviceId;
      });

      this.log.info(`URL parts: device: ${deviceId} temp: ${parts[3]}`);

      if (!device) {
        this.log.info(`Device mac: ${deviceId} not found`);
        return {
          error: false,
          message: `Device mac: ${deviceId} not found`,
        };
      }

      const tempParts = parts[3].split('%');
      if (tempParts.length > 0) {
        //replace with "." in case if HomeKit automation sends "," in temperature value
        const temp = '' + tempParts[0].replace(',', '.');
        device?.updateProp('currentTemp', temp);

        const message = `Updated accessory ${deviceId} current temperature to: ${temp}`;
        this.log.info(message);
        return {
          error: false,
          message: message,
        };
      }
    }

    return {
      error: false,
      message: 'OK',
    };
  }

  configureAccessory(accessory: PlatformAccessory<ACContext>) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  private onDeviceFound(device: Device) {
    if (!device.Name) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pack = (device as any)['pack'] as DevicePackInfo;
      pack.cid = device.FullInfo.mac;
      pack.name = device.FullInfo.mac;
      this.log.info('Updating accessory pack:', JSON.stringify(pack));
      device.updatePack(device.FullInfo.ip, device.FullInfo.port, pack);
    }

    const uuid = this.api.hap.uuid.generate(device.FullInfo.id);
    const existingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === uuid
    );

    if (!existingAccessory) {
      const deviceName = device.Name? device.Name : device.FullInfo.mac;
      this.log.info('Adding new accessory:', deviceName);
      const accessory = new this.api.platformAccessory<ACContext>(
        deviceName,
        uuid
      );
      accessory.context = {
        data: device.FullInfo,
        device: device
      };

      this.registeredDevices.push(new PlatformAC(this, accessory, this.log));
      return this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory
      ]);
    }

    this.log.info(
      'Restoring existing accessory from cache:',
      existingAccessory.displayName
    );
    existingAccessory.context = {
      data: device.FullInfo,
      device: device
    };
    this.registeredDevices.push(
      new PlatformAC(this, existingAccessory, this.log)
    );
  }

  private onDeviceUpdated(oldDeviceInfo: DeviceFullInfo, newDevice: Device) {
    const uuid = this.api.hap.uuid.generate(oldDeviceInfo.id);
    const device = this.registeredDevices.find((plat) => plat.UUID === uuid);

    if (device) {
      this.api.updatePlatformAccessories([device.updateDevice(newDevice)]);
    }
  }
}
