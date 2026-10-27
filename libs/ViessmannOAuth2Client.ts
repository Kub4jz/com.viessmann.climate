import {ViessmannDeviceId} from "./ViessmannDeviceId";
import querystring from "node:querystring";
import {ViessmannOAuth2Token} from "./ViessmannOAuth2Token";
import {generateCodeVerifier} from "@badgateway/oauth2-client";
import {getCodeChallenge} from '@badgateway/oauth2-client/dist/client/authorization-code';
import {URLSearchParams} from "url";
import type {Command, Device, Feature, Installation} from "./ViessmannApi";

const {OAuth2Client, OAuth2Error, fetch} = require("homey-oauth2app");

export type ExtendedDevice = Device & { installationId: number };
export type DeviceFeatures = {[key: string]: Feature};

export class ViessmannOAuth2Client extends OAuth2Client<ViessmannOAuth2Client> {
    static CLIENT_ID = '';
    static CLIENT_SECRET = '';
    static API_URL = 'https://api.viessmann-climatesolutions.com';
    static TOKEN_URL = 'https://iam.viessmann-climatesolutions.com/idp/v3/token';
    static AUTHORIZATION_URL = 'https://iam.viessmann-climatesolutions.com/idp/v3/authorize';
    static TOKEN = ViessmannOAuth2Token;
    static SCOPES = [
        'IoT',
        'User',
        'offline_access'
    ];

    private _codeVerifier: string = '';
    private _codeChallenge: string = '';

    async onInit() {
        this.log('Initializing OAuth2 client');
        this._clientId = await this.homey.settings.get('clientId');

        this._codeVerifier = await generateCodeVerifier();

        const codeChallenge = await getCodeChallenge(this._codeVerifier)
        this._codeChallenge = codeChallenge[1]
    }

    async onHandleNotOK({body}: {body: any}) {
        throw new OAuth2Error(body.error);
    }

    onHandleAuthorizationURL({scopes, state}: any) {
        const query = {
            state,
            client_id: this._clientId,
            redirect_uri: this._redirectUrl,
            scope: super.onHandleAuthorizationURLScopes({scopes}),
            response_type: 'code',
            code_challenge_method: 'S256',
            code_challenge: this._codeChallenge,
        };

        return this._authorizationUrl + '?' + querystring.stringify(query)
    }

    async onGetTokenByCode({code}: {code: string}) {
        this.log('Getting token by code');

        const body = new URLSearchParams();
        body.append('grant_type', 'authorization_code');
        body.append('client_id', this._clientId);
        body.append('client_secret', this._clientSecret);
        body.append('code', code);
        body.append('redirect_uri', this._redirectUrl);
        body.append('code_verifier', this._codeVerifier);

        this.log('Token request body', body);

        const response = await fetch(this._tokenUrl, {
            method: 'POST',
            body: body,
        });

        if (!response.ok) {
            return this.onHandleGetTokenByCodeError({response});
        }

        this._token = await super.onHandleGetTokenByCodeResponse({response});

        this.log('Token retrieved', super.getToken());

        return super.getToken();
    }

    /**
     * @return {Promise<*>}
     */
    async getInstallations(): Promise<{data: Installation[]}> {
        this.log('Getting installations');

        return this.get({
            path: '/iot/v2/equipment/installations',
            query: {'includeGateways': 'true'},
        });
    }

    async getDevices(): Promise<ExtendedDevice[]> {
        this.log('Getting devices');

        const installations = await this.getInstallations();

        let devices: any = [];

        installations['data'].forEach((installation: Installation) => {
            installation['gateways'].forEach((gateway) => {
                gateway.devices.forEach((device) => {
                    devices.push(this.extendDeviceStructure(installation, device));
                });
            });
        });

        return devices;
    }

    async getDeviceFeatures(deviceId: ViessmannDeviceId, filters: string[] = []): Promise<DeviceFeatures> {
        this.log('Getting device features', deviceId);

        return this.get({
            path: `/iot/v2/features/installations/${deviceId.installationId}/gateways/${deviceId.gatewayId}/devices/${deviceId.deviceId}/features`,
            query: {
                skipDisabled: true,
            },
        })
            .then((response: {data: any}) => response['data'])
            .then((data: any) => {
                let features: {[key: string]: { feature: string }} = {};

                data
                    .filter((feature: {feature: string}) => {
                        let featureName = feature.feature;
                        let validFilters = [];

                        filters.forEach((filter) => {
                            if (filter.endsWith('*') && featureName.startsWith(filter.substring(0, filter.length - 1))) {
                                validFilters.push(filter);
                            }

                            if (filter === featureName) {
                                validFilters.push(filter);
                            }
                        });

                        return validFilters.length > 0;
                    })
                    .forEach((feature: {feature: string}) => {
                        let featureName = feature.feature;

                        features[featureName] = feature;
                    });

                return features;
            });
    }

    async triggerFeatureCommand(command: Command, params: any) {
        this.log('Triggering command', command);

        const body = JSON.stringify(params);
        return this.post({
            path: command.uri,
            body: body,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': body.length,
            }
        });
    }

    private extendDeviceStructure(installation: {id: number}, device: Device): ExtendedDevice {
        let extendedDevice: ExtendedDevice = device as ExtendedDevice;

        extendedDevice.installationId = installation.id;

        return extendedDevice;
    }
}
