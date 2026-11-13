import Homey from 'homey';
const {OAuth2Driver} = require('homey-oauth2app');

import type {VitoairFsDevice} from "./device";
import {ViessmannOAuth2Client} from "../../libs/ViessmannOAuth2Client";

class VitoAirFsDriver extends OAuth2Driver {
    static DEVICE_TYPE = 'ventilation';

    async onOAuth2Init() {
        await super.onOAuth2Init();

        this.log('VitoAir OAuth2 has been initialized');

        this.homey.flow.getConditionCard('program_is')
            .registerArgumentAutocompleteListener(
                'active_program',
                async (query: string, args: any) => {
                    const device: VitoairFsDevice = args.device;

                    return device.activeProgramAutocomplete(query);
                })
            .registerRunListener(async (args: any, state: any) => {
                const device: VitoairFsDevice = args.device;

                this.log('Condition: is program active', args.active_program);

                return device.isProgramActive(args.active_program.id);
            });

        this.homey.flow.getConditionCard('cooling')
            .registerRunListener(async (args: any, state: any) => {
                const device: VitoairFsDevice = args.device;

                return device.isCooling();
            });

        this.homey.flow.getConditionCard('frost_protection_active')
            .registerRunListener(async (args: any, state: any) => {
                const device: VitoairFsDevice = args.device;

                return device.isFrostProtectionActive();
            });

        this.homey.flow.getConditionCard('bypass_open')
            .registerRunListener(async (args: any, state: any) => {
                const device: VitoairFsDevice = args.device;

                return device.isByPassOpen();
            });

        this.homey.flow.getActionCard('start_quick_mode')
            .registerArgumentAutocompleteListener(
                'mode',
                async (query: string, args: any) => {
                    const device: VitoairFsDevice = args.device;

                    return device.quickModeAutocomplete(query, args);
                })
            .registerRunListener(async (args: any, state: any) => {
                const device: VitoairFsDevice = args.device;

                let params: any = {};
                if (args.duration != null) {
                    // Flow duration is in ms, API expects whole minutes (1-1440)
                    params['timeout'] = Math.min(1440, Math.max(1, Math.round(args.duration / 60000)));
                }

                this.log(`Starting quick mode "${args.mode.id}" with duration ${params.timeout || 0} minutes`);

                return await device.activateQuickMode(args.mode.id, params);
            });

        this.homey.flow.getActionCard('stop_quick_mode')
            .registerArgumentAutocompleteListener(
                'mode',
                async (query: string, args: any) => {
                    const device: VitoairFsDevice = args.device;

                    return device.quickModeAutocomplete(query, args);
                })
            .registerRunListener(async (args: any, state: any) => {
                const device: VitoairFsDevice = args.device;

                await device.deactivateQuickMode(args.mode.id, {});

                return Promise.resolve(true);
            });

        this.homey.flow.getActionCard('force_sync')
            .registerRunListener(async (args: any, state: any) => {
                const device: VitoairFsDevice = args.device;

                await device.forceSync();

                return Promise.resolve(true);
            });
    }

    async onPairListDevices({oAuth2Client}: {oAuth2Client: ViessmannOAuth2Client}) {
        this.log('Vitoair listing devices...');

        try {
            let devices = await oAuth2Client.getDevices();

            const devices2 = devices
                .filter((device: any) => device.deviceType === VitoAirFsDriver.DEVICE_TYPE)
                .map((device: any) => {
                    return {
                        name: this.homey.__(VitoAirFsDriver.DEVICE_TYPE),
                        data: {
                            id: device.id,
                            installationId: device.installationId,
                            gatewaySerial: device.gatewaySerial,
                            type: device.deviceType,
                        }
                    }
                });

            this.log(`Found ${VitoAirFsDriver.DEVICE_TYPE} devices`, devices2);

            return devices2;
        } catch (e) {
            this.error(e);

            throw e;
        }
    }
}

module.exports = VitoAirFsDriver;
