import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import Homey from 'homey';
const {OAuth2App} = require("homey-oauth2app");
import {ViessmannOAuth2Client} from "./libs/ViessmannOAuth2Client";

class ViessmannApp extends OAuth2App {
    static OAUTH2_CLIENT = ViessmannOAuth2Client;
    static OAUTH2_DEBUG = true;
    static OAUTH2_MULTI_SESSION = false;

    async onOAuth2Init() {
        this.log('OAuth App has been initialized');

        this.homey.settings.on('set', async (key: String) => {
            this.log('Settings change: ' + key);

            return 'ok';
        });
    }
}

module.exports = ViessmannApp;
