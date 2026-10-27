
export class ViessmannDeviceId {
    installationId: number;
    gatewayId: string;
    deviceId: string;
    type: string;

    constructor(installationId: number, gatewayId: string, deviceId: string, type: string) {
        this.installationId = installationId;
        this.gatewayId = gatewayId;
        this.deviceId = deviceId;
        this.type = type;
    }
}
