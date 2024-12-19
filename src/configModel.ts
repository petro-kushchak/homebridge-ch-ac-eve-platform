import { PlatformConfig } from 'homebridge';
import { BasicLogger } from './logger';

export interface PluginConfiguration extends PlatformConfig {
    mqtt?: MqttConfiguration;

    httpPort?: number;
    broadcastAddress: string;
    manufacturer?: string;
    threeSpeedUnit?: boolean;
    coolingMinTemp: number;
    coolingMaxTemp: number;
    heatingMinTemp: number;
    heatingMaxTemp: number;
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

    return true;
};



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
