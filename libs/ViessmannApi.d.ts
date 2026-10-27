export interface Installation {
    id: number;
    description: string;
    address: Address;
    gateways: Gateway[];
    aggregatedStatus: string;
}

export interface Gateway {
    serial: string;
    version: string;
    firmwareUpdateFailureCounter: 0;
    autoUpdate: false;
    createdAt: string;
    producedAt: string;
    lastStatusChangedAt: string;
    aggregatedStatus: string;
    targetRealm: string;
    devices: Device[];
    gatewayType: string;
    installationId: number;
    registeredAt: string;
    description: string | null;
    otaOngoing: boolean;
}

export interface Device {
    gatewaySerial: string;
    id: string;
    boilerSerial: string;
    boilerSerialEditor: string;
    bmuSerial: null;
    bmuSerialEditor: null;
    createdAt: string;
    editedAt: string;
    modelId: string;
    status: string;
    deviceType: string;
    roles: string[];
}

export interface Address {
    street: string | null;
    houseNumber: string | null;
    zip: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    phoneNumber: string | null;
    faxNumber: string | null;
    geolocation: string | Geolocation;
}

export interface Feature {
    properties: Record<string, any>;
    commands: Record<string, Command>;
    apiVersion: number;
    uri: string;
    gatewayId: string;
    feature: string;
    timestamp: string;
    isEnabled: boolean;
    isReady: boolean;
    deviceId: string;
}

export type CommandParameter = {
    type: string;
    required: boolean;
    constraints: any;
};

export interface Command {
    uri: string;
    name: string;
    isExecutable: boolean;
    params: Record<string, CommandParameter>;
}
