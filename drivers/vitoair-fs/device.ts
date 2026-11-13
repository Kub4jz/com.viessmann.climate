const ViessmannDevice = require("../../libs/ViessmannDevice");

export class VitoairFsDevice extends ViessmannDevice {
    static FEATURES_FILTERS = [
        'ventilation.operating.state',
        'ventilation.filter.pollution.blocked',
        'ventilation.control.filterChange',
        'ventilation.heating.recovery',
        'ventilation.heatExchanger.frostprotection',
        'ventilation.bypass',
        'ventilation.bypass.*',
        'ventilation.operating.modes.*',
        'ventilation.sensors.*',
        'ventilation.fan.*',
        'ventilation.volumeFlow.current.*',
        'ventilation.quickmodes.*'
    ];

    async onOAuth2Init() {
        await super.onOAuth2Init();

        this.homey.flow.getDeviceTriggerCard('ventilation_active_program_changed');
        this.homey.flow.getDeviceTriggerCard('ventilation_operating_level_changed');
        this.homey.flow.getDeviceTriggerCard('bypass_position_changed');
        this.homey.flow.getDeviceTriggerCard('filter_pollution_changed');
        this.homey.flow.getDeviceTriggerCard('measure_fan_speed_rpm.exhaust_changed');
        this.homey.flow.getDeviceTriggerCard('measure_fan_speed_rpm.supply_changed');
        this.homey.flow.getDeviceTriggerCard('measure_volume_flow_changed');
        this.homey.flow.getDeviceTriggerCard('alarm_generic.filter_change_true');
        this.homey.flow.getDeviceTriggerCard('alarm_generic.filter_polluted_true');
    }

    async migrate() {
    }

    getFeaturesFilters() {
        return VitoairFsDevice.FEATURES_FILTERS;
    }

    async activateQuickMode(featureName: string, params: any = {}) {
        this.log('Starting quick mode', featureName);

        await this.triggerFeatureCommand(featureName, 'activate', params);

        return true;
    }

    async deactivateQuickMode(featureName: string, params: any = {}) {
        this.log('Stopping quick mode', featureName);

        await this.triggerFeatureCommand(featureName, 'deactivate', params);

        return true;
    }

    async quickModeAutocomplete(query: string, args: any) {
        return this.programAutocomplete(query, args)
            .then((programs) => {
                return programs.filter((program) => {
                    return program.id.startsWith('ventilation.quickmodes.');
                });
            });
    }

    async programAutocomplete(query: string, args: any) {
        let programs: { id: string, name: string }[] = [];

        const quickModes = [
            'quickmodes.forcedLevelFour',
            'quickmodes.silent',
            'quickmodes.temporaryShutdown',
        ];

        quickModes.forEach((quickMode) => {
            if (this.hasFeature('ventilation.' + quickMode)) {
                programs.push({
                    id: 'ventilation.' + quickMode,
                    name: this.homey.__(quickMode),
                });
            }
        });

        const operatingModes = [
            'modes.permanent',
            'modes.sensorDriven',
            'modes.ventilation',
            'modes.sensorOverride',
            'modes.filterChange'
        ];

        operatingModes.forEach((operatingMode) => {
            if (this.hasFeature('ventilation.operating.' + operatingMode)) {
                programs.push({
                    id: 'ventilation.operating.' + operatingMode,
                    name: this.homey.__(operatingMode),
                });
            }
        });

        return programs.filter((result) => {
            return result.name.toLowerCase().includes(query.toLowerCase());
        });
    }

    async activeProgramAutocomplete(query: string) {
        const lang = this.homey.i18n.getLanguage();
        const values: { id: string, title: Record<string, string> }[] =
            this.homey.manifest.capabilities.ventilation_active_program.values;

        return values
            .map(({ id, title }) => ({ id, name: title[lang] ?? title.en ?? id }))
            .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    }

    async isProgramActive(programId: string) {
        return this.getCapabilityValue('ventilation_active_program') === programId;
    }

    async isCooling() {
        const supplyAir = this.getCapabilityValue('measure_temperature.supply');
        const extractAir = this.getCapabilityValue('measure_temperature.extract');

        if (typeof supplyAir !== 'number' || typeof extractAir !== 'number') {
            return false;
        }

        return supplyAir < extractAir;
    }

    async isFrostProtectionActive() {
        return this.getCapabilityValue('ventilation_frost_protection') === 'on';
    }

    async isByPassOpen() {
        return this.getCapabilityValue('bypass_position') > 0;
    }

    async sync() {
        try {
            await super.sync();

            if (!this.getAvailable()) {
                this.setAvailable();
            }
        } catch (e) {
            this.setUnavailable('Unable to retrieve device features');
            return;
        }

        try {
            const inputAirFlow = this.getFeatureValue('ventilation.volumeFlow.current.input');
            // calculate power
            // Vitoair FS 0,19 W/(m3/h)
            const powerInWatts = 0.19 * inputAirFlow;

            const capabilityValues: { [key: string]: any } = {
                'ventilation_operating_mode': this.getFeatureValue('ventilation.operating.modes.active'),
                'ventilation_operating_level': this.getFeatureSectionValue('ventilation.operating.state', 'level'),
                'ventilation_active_program': this.getFeatureSectionValue('ventilation.operating.state', 'reason'),

                // Filter
                'filter_pollution': this.getFeatureValue('ventilation.filter.pollution.blocked'),
                'alarm_generic.filter_change': this.getFeatureSectionValue('ventilation.control.filterChange', 'active'),

                // Air flow
                'measure_volume_flow': inputAirFlow,

                // Fan
                'measure_fan_speed_rpm.exhaust': this.getFeatureSectionValue('ventilation.fan.exhaust', 'current'),
                'measure_fan_speed_rpm.supply': this.getFeatureSectionValue('ventilation.fan.supply', 'current'),

                // Extract Air
                'measure_temperature.extract': this.getFeatureValue('ventilation.sensors.temperature.extract'),
                'measure_humidity.extract': this.getFeatureValue('ventilation.sensors.humidity.extract'),

                // Supply Air
                'measure_temperature.supply': this.getFeatureValue('ventilation.sensors.temperature.supply'),
                'measure_humidity.supply': this.getFeatureValue('ventilation.sensors.humidity.supply'),

                // Outdoor Air
                'measure_temperature.outdoor': this.getFeatureValue('ventilation.sensors.temperature.outside'),
                'measure_humidity.outdoor': this.getFeatureValue('ventilation.sensors.humidity.outdoor'),

                // Exhaust Air
                'measure_temperature.exhaust': this.getFeatureValue('ventilation.sensors.temperature.exhaust'),
                'measure_humidity.exhaust': this.getFeatureValue('ventilation.sensors.humidity.exhaust'),

                // Power
                'measure_power': powerInWatts,
            };

            // Bypass
            if (this.hasFeature('ventilation.bypass')) {
                capabilityValues['bypass_position'] = this.getFeatureValue('ventilation.bypass.position');
                capabilityValues['ventilation_heating_recovery'] = this.getFeatureValue('ventilation.heating.recovery');
                capabilityValues['room_setpoint'] = this.getFeatureValue('ventilation.bypass.configuration.temperature.perceived');

                const bypassMode = this.getFeatureSectionValue('ventilation.bypass.operating.modes.active', 'level');
                let supplyAirTemperature = null;
                if (bypassMode === 'smoothRegulationMode') {
                    supplyAirTemperature = this.getFeatureValue('ventilation.bypass.configuration.temperature.supply.smoothRegulation');
                } else if (bypassMode === 'dynamicRegulationMode') {
                    supplyAirTemperature = this.getFeatureValue('ventilation.bypass.configuration.temperature.supply.dynamicRegulation');
                }

                capabilityValues['supply_air_temperature'] = supplyAirTemperature;
            }

            if (this.hasFeature('ventilation.heatExchanger.frostprotection')) {
                capabilityValues['ventilation_frost_protection'] = this.getFeatureSectionValue('ventilation.heatExchanger.frostprotection', 'status');
            }

            const alarmLevel = this.getSetting('pollution.alert.level');
            capabilityValues['alarm_generic.filter_polluted'] = capabilityValues['filter_pollution'] >= alarmLevel;

            for (const [key, value] of Object.entries(capabilityValues)) {
                try {
                    this.setValue(key, value);
                } catch (e) {
                    this.error('Unable to set capability ' + key + ' due to ' + e);
                }
            }
        } catch (e) {
            this.error(e);
        }
    }
}

module.exports = VitoairFsDevice;
