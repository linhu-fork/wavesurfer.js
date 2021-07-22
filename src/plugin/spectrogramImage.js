export default class SpectrogramImagePlugin {
    /**
     * @param  {SpectrogramPluginParams} params parameters use to initialise the plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    static create(params) {
        return {
            name: 'spectrogramImage',
            params: params,
            instance: SpectrogramImagePlugin
        };
    }
    constructor(params, ws) {
        console.log('my params', params);
        this.params = params;
        this.wavesurfer = ws;
        this.util = ws.util;
        this.imageUrl = params.imageUrl;
    }
}
