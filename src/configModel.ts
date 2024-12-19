import { PlatformConfig } from 'homebridge';
import { BasicLogger } from './logger';

export interface PluginConfiguration extends PlatformConfig {
    mqtt?: MqttConfiguration;
    devices?: DeviceConfiguration[];

    httpPort?: number;
    broadcastAddress: string;
    manufacturer?: string;
    threeSpeedUnit?: boolean;
    coolingMinTemp: number;
    coolingMaxTemp: number;
    heatingMinTemp: number;
    heatingMaxTemp: number;
}

export interface DeviceConfiguration extends Record<string, unknown> {
    id: string;
    sensorTopic: string;
}


export interface MqttSensor {
    battery: number;
    humidity: number;
    last_seen?: string;
    linkquality?: number;
    temperature?: number;
}

export const isPluginConfiguration = (
    x: PlatformConfig,
    logger: BasicLogger | undefined = undefined
): x is PluginConfiguration => {
    if (x.mqtt === undefined || !isMqttConfiguration(x.mqtt)) {
        logger?.error('Incorrect configuration: mqtt does not contain required fields');
        return false;
    }

    if (x.broadcastAddress === undefined) {
        logger?.error('Incorrect configuration: broadcastAddress configuration is invalid: ' + JSON.stringify(x.broadcastAddress));
    }

    if (x.broadcastAddress === undefined) {
        logger?.error('Incorrect configuration: broadcastAddress  is invalid: ' + JSON.stringify(x.broadcastAddress));
        return false;
    }

    if (x.coolingMinTemp === undefined) {
        logger?.error('Incorrect configuration: coolingMinTemp is invalid: ' + JSON.stringify(x.coolingMinTemp));
        return false;
    }

    if (x.heatingMinTemp === undefined) {
        logger?.error('Incorrect configuration: heatingMinTemp is invalid: ' + JSON.stringify(x.heatingMinTemp));
        return false;
    }

    if (x.heatingMaxTemp === undefined) {
        logger?.error('Incorrect configuration: heatingMaxTemp is invalid: ' + JSON.stringify(x.heatingMaxTemp));
        return false;
    }

    if (x.httpPort !== undefined && typeof x.httpPort !== 'number') {
        logger?.error('Incorrect configuration: httpPort is invalid: ' + JSON.stringify(x.httpPort));
        return false;
    }

    if (x.devices !== undefined) {
        return hasValidDeviceConfigurations(x.devices, logger);
    }

    return true;
};


function hasValidDeviceConfigurations(
    devices: unknown,
    logger: BasicLogger | undefined
): boolean {
    if (devices !== undefined) {
        if (!Array.isArray(devices)) {
            logger?.error('Incorrect configuration: devices must be an array');
            return false;
        }
        for (const element of devices) {
            if (!isDeviceConfiguration(element)) {
                logger?.error('Incorrect configuration: Entry for device is not correct: ' + JSON.stringify(element));
                return false;
            }
        }
    }
    return true;
}


export const isDeviceConfiguration = (x: DeviceConfiguration): boolean => {
    // Required id property
    if (x.id === undefined || typeof x.id !== 'string' || x.id.length < 1) {
        return false;
    }

    // Required sensorTopic property
    if (x.sensorTopic === undefined || typeof x.sensorTopic !== 'string' || x.sensorTopic.length < 1) {
        return false;
    }
    return true;
}


export interface MqttConfiguration extends Record<string, unknown> {
    base_topic: string;
    server: string;
    ca?: string;
    key?: string;
    cert?: string;
    user?: string;
    password?: string;
    client_id?: string;
    reject_unauthorized?: boolean;
    keepalive?: number;
    version?: 3 | 4 | 5;
    disable_qos?: boolean;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isMqttConfiguration = (x: any): x is MqttConfiguration =>
    x.base_topic !== undefined &&
    typeof x.base_topic === 'string' &&
    x.base_topic.length > 0 &&
    x.server !== undefined &&
    typeof x.server === 'string' &&
    x.server.length > 0;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isMqttSensor = (x: any): x is MqttSensor =>
    x.temperature !== undefined &&
    typeof x.temperature === 'number' &&
    x.humidity !== undefined &&
    typeof x.humidity === 'number';
