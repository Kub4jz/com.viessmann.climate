import {Command} from "./ViessmannApi";
import {ViessmannDeviceId} from "./ViessmannDeviceId";
import {DeviceFeatures, ViessmannOAuth2Client} from "./ViessmannOAuth2Client";

const Homey = require('homey');
const {OAuth2Device} = require("homey-oauth2app");

export class ViessmannDevice extends OAuth2Device<ViessmannOAuth2Client> {
    static DEFAULT_SYNC_INTERVAL = 5

    deviceId: ViessmannDeviceId|undefined = undefined;
    interval: NodeJS.Timeout|undefined;
    syncTimeout: NodeJS.Timeout|undefined;
    features: DeviceFeatures = {};

    /**
     * @return {string[]}
     */
    getFeaturesFilters() {
        // Overload to filter features
        return [];
    }

    async migrate() {
        // Overload
    }

    async registerCapabilities() {
        // Overload to register capabilities
    }

    async onOAuth2Init() {
        await super.onOAuth2Init();

        const data = this.getData();
        this.deviceId = new ViessmannDeviceId(
            data.installationId,
            data.gatewaySerial,
            data.id,
            data.type,
        );

        await this.migrate();
        await this.registerCapabilities();

        this.log('Device initialized', this.deviceId);

        await this.schedule();

        await this.sync().catch(null);

        this.homey.settings.on('set', async (key: string) => {
            if (key === 'polling') {
                await this.schedule();
            }
        });
    }

    async onOAuth2Deleted() {
        if (this.interval) {
            this.log("Removing device, removing existing sync interval");
            this.homey.clearTimeout(this.interval);
        }
    }

    async registerCapability(name: string) {
        if (!this.hasCapability(name)) {
            this.log('Registering capability ' + name);
            await this.addCapability(name)
        }
    }

    async setValue(name: string, value: any) {
        if (!this.hasCapability(name)) {
            this.error('Attempting to set a value of not registered capability ' + name + ', ignoring');

            return false;
        }

        let current = this.getCapabilityValue(name);
        if (value == current) {
            return false;
        }

        try {
            await this.setCapabilityValue(name, value);

            this.log('Capability ' + name + ' changed from ' + current + ' to value ' + value);

            return true;
        } catch (e) {
            this.error('Unable to set the capability ' + name + ' due ' + e);

            return false;
        }
    }

    async sync() {
        this.log('Syncing device features');
        try {
            this.features = await this.oAuth2Client.getDeviceFeatures(this.deviceId, this.getFeaturesFilters());
            this.log('Device features synced');
        } catch (e) {
            this.error('Unable to sync device features due to ' + e);

            throw e;
        }
    }

    async forceSync() {
        await this.schedule();

        this.sync().catch(() => null);
    }

    async schedule() {
        if (this.interval) {
            this.log("Removing the existing interval");
            this.homey.clearTimeout(this.interval);
        }

        const polling = parseInt(this.homey.settings.get('polling'), 10);
        const updateInterval = Number.isFinite(polling) && polling > 0 ? polling : ViessmannDevice.DEFAULT_SYNC_INTERVAL;
        this.log("Using an update interval of " + updateInterval + " minutes");

        this.interval = this.homey.setInterval(this.sync.bind(this), updateInterval * 60000);
    }

    getFeatureValue(featureName: string) {
        return this.getFeatureSectionValue(featureName, 'value');
    }

    getFeatureSectionValue(featureName: string, sectionName: string) {
        try {
            return this.features[featureName]['properties'][sectionName]['value'];
        } catch (e) {
            this.error('Unable to get feature ' + featureName + ' section ' + sectionName + ' due to ' + e);
        }
    }

    async triggerFeatureCommand(featureName: string, commandName: string, params: any) {
        const command = this.getFeatureCommand(featureName, commandName);

        if (command === undefined) {
            throw new Error('Feature ' + featureName + ' command ' + commandName + ' not found');
        }

        if (!command.isExecutable) {
            throw new Error('Feature ' + featureName + ' command ' + commandName + ' is not executable');
        }

        try {
            await this.oAuth2Client.triggerFeatureCommand(command, params);
        } catch (e) {
            this.error('Unable to trigger feature ' + featureName + ' command ' + commandName + ' due to ' + e);

            throw e;
        }

        // Delay the sync so the API has time to reflect the new state
        if (this.syncTimeout) {
            this.homey.clearTimeout(this.syncTimeout);
        }
        this.syncTimeout = this.homey.setTimeout(() => this.forceSync().catch(this.error.bind(this)), 4000);
    }

    getFeatureCommand(featureName: string, commandName: string): Command|undefined {
        return this.features[featureName]?.commands?.[commandName];
    }

    hasFeature(featureName: string) {
        return this.features[featureName] !== undefined;
    }
}

module.exports = ViessmannDevice;
