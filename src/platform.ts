import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic
} from 'homebridge';

import mqtt from 'mqtt';
import * as fs from 'fs';

import { DeviceFullInfo, DevicePackInfo } from 'gree-ac-api/lib/@types';
import { Device, DeviceFinder } from 'gree-ac-api';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import ACContext from './@types/ACContext';
import { PlatformAC } from './PlatformAC';
import { AutomationReturn, HttpService } from './services/HttpService';
import { DeviceConfiguration, isMqttSensor, isPluginConfiguration, MqttSensor, PluginConfiguration } from './configModel';
import { BasicLogger, errorToString } from './logger';

export class Platform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory<ACContext>[] = [];
  private readonly registeredDevices: PlatformAC[] = [];
  private httpService?: HttpService;
  private readonly mqttClient?: mqtt.MqttClient;

  get devices(): DeviceConfiguration[] {
    return this.config.devices;
  }

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    // Validate configuration
    if (isPluginConfiguration(config, this.log)) {
      this.config = config;
    } else {
      this.log.error(`INVALID CONFIGURATION FOR PLUGIN: ${PLUGIN_NAME}\nThis plugin will NOT WORK until this problem is resolved.`);
      return;
    }

    DeviceFinder.on('device-updated', this.onDeviceUpdated.bind(this));
    DeviceFinder.on('device-found', this.onDeviceFound.bind(this));

    this.log.debug('Finished initializing platform:', this.config.name);
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      DeviceFinder.scan(this.config.broadcastAddress, 0);
    });

    if (this.config.httpPort > 0) {
      this.httpService = new HttpService(this.config.httpPort, this.log);
      this.httpService.start((uri: string) => this.httpHandler(uri));
    }

    if (this.config.mqtt) {
      this.mqttClient = this.initializeMqttClient(this.config as PluginConfiguration);
    }
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
      const deviceName = device.Name ? device.Name : device.FullInfo.mac;
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

  private initializeMqttClient(config: PluginConfiguration): mqtt.MqttClient {
    if (!config.mqtt!.server || !config.mqtt!.base_topic) {
      this.log.error('No MQTT server and/or base_topic defined!');
    }
    this.log.info(`Connecting to MQTT server at ${config.mqtt!.server}`);

    const options: mqtt.IClientOptions = Platform.createMqttOptions(this.log, config);

    const mqttClient = mqtt.connect(config.mqtt!.server, options);
    mqttClient.on('connect', this.onMqttConnected.bind(this));
    mqttClient.on('close', this.onMqttClose.bind(this));

    this.api.on('didFinishLaunching', () => {
      if (this.config !== undefined) {
        // Setup MQTT callbacks and subscription
        this.mqttClient?.on('message', this.onMessage.bind(this));
        this.mqttClient?.subscribe(this.config.mqtt.base_topic + '/#');
      }
    });

    return mqttClient;
  }

  private onMqttConnected(): void {
    this.log.info('Connected to MQTT server');
  }

  private onMqttClose(): void {
    this.log.error('Disconnected from MQTT server!');
  }

  private onMessage(topic: string, payload: Buffer) {
    const fullTopic = topic;
    try {
      const baseTopic = `${this.config?.mqtt.base_topic}/`;
      if (!topic.startsWith(baseTopic)) {
        this.log.debug('Ignore message, because topic is unexpected.', topic);
        return;
      }

      const deviceConfig = this.devices.find(device => device.sensorTopic === fullTopic);

      if (!deviceConfig) {
        this.log.debug('Ignore message, because topic is not in the list of devices.', fullTopic);
        return;
      }

      let device: PlatformAC | undefined;

      this.registeredDevices.forEach(plat => {
        this.log.info(`registeredDevices: ${plat.Mac} `);
        if (plat.Mac === deviceConfig.id) {
          device = plat;
        }
      });

      if (!device) {
        this.log.debug('Ignore message, because device is not registered.', deviceConfig.id);
        return;
      }

      const info = JSON.parse(payload.toString());

      this.log.info(`Received MQTT message '${payload.toString()}' on topic: ${fullTopic} for device: ${deviceConfig.id}`);

      if (!isMqttSensor(info)) {
        this.log.error('Ignore message, because payload is not recognised as sensor data.', payload.toString());
        return;
      }

      const sensor = info as MqttSensor;

      device.updateProp('currentTemp', '' + sensor.temperature);
      this.log.info(`Updated device: ${deviceConfig.id} with temperature: ${sensor.temperature}`);

    } catch (err) {
      this.log.error(`Failed to process MQTT message on '${fullTopic}'. (Maybe check the MQTT version?)`);
      this.log.error(errorToString(err));
    }
  }


  private static createMqttOptions(log: BasicLogger, config: PluginConfiguration): mqtt.IClientOptions {
    const options: mqtt.IClientOptions = {};
    if (config.mqtt!.version) {
      options.protocolVersion = config.mqtt!.version;
    }

    if (config.mqtt!.keepalive) {
      log.debug(`Using MQTT keepalive: ${config.mqtt!.keepalive}`);
      options.keepalive = config.mqtt!.keepalive;
    }

    if (config.mqtt!.ca) {
      log.debug(`MQTT SSL/TLS: Path to CA certificate = ${config.mqtt!.ca}`);
      options.ca = fs.readFileSync(config.mqtt!.ca);
    }

    if (config.mqtt!.key && config.mqtt!.cert) {
      log.debug(`MQTT SSL/TLS: Path to client key = ${config.mqtt!.key}`);
      log.debug(`MQTT SSL/TLS: Path to client certificate = ${config.mqtt!.cert}`);
      options.key = fs.readFileSync(config.mqtt!.key);
      options.cert = fs.readFileSync(config.mqtt!.cert);
    }

    if (config.mqtt!.user && config.mqtt!.password) {
      options.username = config.mqtt!.user;
      options.password = config.mqtt!.password;
    }

    if (config.mqtt!.client_id) {
      log.debug(`Using MQTT client ID: '${config.mqtt!.client_id}'`);
      options.clientId = config.mqtt!.client_id;
    }

    if (config.mqtt!.reject_unauthorized !== undefined && !config.mqtt!.reject_unauthorized) {
      log.debug('MQTT reject_unauthorized set false, ignoring certificate warnings.');
      options.rejectUnauthorized = false;
    }

    return options;
  }


}
