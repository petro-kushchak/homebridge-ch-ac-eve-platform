import { Logger, PlatformAccessory } from 'homebridge';
import { Device } from 'gree-ac-api';

import HeaterCooler from './services/HeaterCooler';
import ACContext from './@types/ACContext';
import ACLight from './services/ACLight';
import ACSpeed from './services/ACSpeed';
import { Platform } from './platform';
import { EveHistory, HistoryServiceEntry } from './services/EveHistory';

export class PlatformAC {
  private readonly HC: HeaterCooler;
  private readonly history: EveHistory;

  public get UUID() {
    return this.accessory.UUID.toString();
  }

  public get Mac() {
    return this.accessory.context.data.mac;
  }

  public updateDevice(newDevice: Device) {
    this.accessory.context.device = newDevice;
    this.accessory.context.data = newDevice.FullInfo;
    return this.accessory;
  }

  constructor(
    private readonly platform: Platform,
    private accessory: PlatformAccessory<ACContext>,
    private readonly log: Logger
  ) {
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.platform.config.manufacturer || 'Gree')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.config.manufacturer || 'Gree')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        accessory.context.data.mac
      );

    this.HC = new HeaterCooler(this.platform, this.accessory);
    new ACSpeed(
      this.platform,
      this.accessory,
      this.HC.activeChar,
      this.HC.eventEmitter,
      this.HC.EVENT
    );
    new ACLight(this.platform, this.accessory);
    this.history = new EveHistory(this.accessory, this.platform.api, this.log);

    this.history.readHistory((_: string, history: HistoryServiceEntry[]) => {
      const lastItem = history.pop();
      if (lastItem) {
        this.log.info(`History: last item: ${JSON.stringify(lastItem)}`);
        this.HC.updateCurrentTemp(lastItem.currentTemp);
      } else {
        this.log.info('History: no data');
      }
    });
  }

  public updateProp(propName: string, value: string) {
    if (propName === 'currentTemp') {
      const temp = parseFloat(value);
      this.HC.updateCurrentTemp(temp);
      this.history.addEntry({
        time: Math.round(new Date().valueOf() / 1000),
        currentTemp: temp,
      });
    }
  }
}
