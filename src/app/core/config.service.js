(() => {
    'use strict';

    /**
     * @ngdoc service
     * @name configService
     * @module app.core
     * @requires $q
     * @requires $rootElement
     * @requires $timeout
     * @requires $http
     * @requires configDefaults
     * @description
     *
     * The `configService` is responsible for loading and parsing the supplied configuration.
     *
     * Config file is either specified inline, by a url or is referencing a global variable:
     * ```html
     * <div rv-map rv-cfg='{"layout": { "title": "Granpa"}}'></div>
     * ```
     * ```html
     * <div rv-map rv-cfg="config.en.json"></div>
     * ```
     * ```html
     * <div rv-map rv-cfg="configOpts"></div>
     * <script>configOpts = {}</script>
     * ```
     * The main core run block (core.run.js) kicks in the initialization process by calling initialize on the `configService`. `configService` is responsible for parsing (inline) or loading (url) of the config. This service preserves the configuration in its pristine state (after applying all the defaults) - it will not be modified.
     * After the main config service retrieved the configuration, all other services are initialized. Until then, the application is covered by a loading overlay to hide unstyled content.
     *
     * Config service body returns the service object with the following:
     * - data: config data
     * - initialize: initialize function; call from core.run
     * - ready: checks if the service is ready to use
     *
     */
    angular
        .module('app.core')
        .factory('configService', configService);

    function configService($q, $rootElement, $timeout, $http, configDefaults, $translate) {
        let initializePromise;
        let isInitialized = false;

        const service = {
            data: { },
            getCurrent,
            initialize: initialize,
            ready: ready
        };

        return service;

        /***************/

        /**
         * Initializes `configService` by fetching and parsing `config` object.
         */
        function initialize() {
            if (initializePromise) {
                return initializePromise;
            }

            // store the promise and return it on all future calls; this way initialize can be called one time only
            initializePromise = $q((fulfill, reject) => {
                const configAttr = $rootElement.attr('th-config');
                const langAttr = $rootElement.attr('rv-langs');
                let configJson;
                let langs;

                // This function can only be called once.
                if (isInitialized) {
                    return fulfill();
                }

                // check if config attribute exist
                if (configAttr) {
                    // check if it's a valid JSON
                    try {
                        configJson = angular.fromJson(configAttr);
                        configInitialized(configJson, 'en');
                    } catch (e) {
                        console.log('Not valid JSON, attempting to load a file with this name');
                    }

                    if (langAttr) {
                        try {
                            langs = angular.fromJson(langAttr);
                        } catch (e) {
                            console.log('Could not parse langs, defaulting to en and fr');
                        }
                    }

                    // TODO: better way to handle when no languages are specified?
                    if (!langs) {
                        langs = ['en', 'fr'];
                    }

                    // TODO: switch to loading only the first (default) config?
                    // load all but attach promises and load app once first config has loaded?
                    let promises;
                    if (!configJson) {
                        // promise array to start up app after all of the config files have loaded
                        promises = langs.map(lang => {
                            // try to load config file
                            return $http
                                .get(configAttr.replace('$LANG', lang))
                                .then(function (data) {
                                    if (data.data) {
                                        configInitialized(data.data, lang);
                                    }
                                })
                                .catch(function (error) {
                                    console.error('Config initialization failed');
                                    console.log(error);
                                    reject();
                                });
                        });
                    } else {
                        // resolved promise to allow app to initialize
                        promises = [$q.resolve(null)];
                    }

                    $q.all(promises).then(() => {
                        // set language to the first specified
                        isInitialized = true;
                        fulfill();
                    });
                } else {
                    configInitialized({}, 'en');
                }

                /**
                 * Initialization complete handler
                 * @param  {object} config config object
                 * @param  {string} lang the language to tie the config object to
                 */
                function configInitialized(config, lang) {
                    // apply any defaults from layoutConfigDefaults, then merge config on top
                    // TODO: this is an exampe; actual merging of the defaults is more complicated
                    service.data[lang] = {};
                    angular.merge(service.data[lang], configDefaults, config);
                }
            });

            return initializePromise;
        }

        /**
         * Returns the currently used config. Language is determined by asking $translate.
         * @return {object}     The config object tied to the current language
         */
        function getCurrent() {
            const currentLang = ($translate.proposedLanguage() || $translate.use()).split('-')[0];
            return service.data[currentLang];
        }

        /**
         * Checks if the service is ready to use.
         * @param  {object} nextPromises optional promises to be resolved before returning
         * @return {object}              promise to be resolved on config service initialization
         */
        function ready(nextPromises) {
            return initializePromise
                .then(() => {
                    console.log('Ready promise resolved.');
                    return $q.all(nextPromises);
                })
                .catch(() => {
                    console.log('"ready" function failed');
                });
        }
    }
})();
