// @ts-check
const { inspect } = require('util');
const { promises: fs } = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const {
  gunzip,
  constants: { Z_SYNC_FLUSH },
} = require('zlib');
const { Application } = require('spectron');
const { rebuild } = require('electron-rebuild');
const debug = require('debug')('compass-e2e-tests');

const {
  run: packageCompass,
  cleanCompileCache,
  createCompileCache,
  createPackagedStyles,
} = require('hadron-build/commands/release');
const Selectors = require('./selectors');
const { createUnlockedKeychain } = require('./keychain');
const { retryWithBackoff } = require('./retry-with-backoff');
const { addCommands } = require('./commands');

/**
 * @typedef {Object} ExtendedClient
 * @property {(selector: string, timeout?: number) => Promise<void>} clickVisible
 * @property {(selector: string, value: any, timeout?: number) => Promise<void>} setValueVisible
 * @property {() => Promise<void>} waitForConnectionScreen
 * @property {() => Promise<void>} closeTourModal
 * @property {() => Promise<void>} closePrivacySettingsModal
 * @property {(timeout?: number) => Promise<void>} doConnect
 * @property {(connectionString: string, timeout?: number) => Promise<void>} connectWithConnectionString
 * @property {(connectionOptions: any, timeout?: number) => Promise<void>} connectWithConnectionForm
 * @property {() => Promise<void>} disconnect
 * @property {(str: string, parse?: boolean, timeout?: number) => Promise<any>} shellEval
 *
 * @typedef {import('spectron').Application & { client: import('spectron').SpectronClient & ExtendedClient }} ExtendedApplication
 */

const packageCompassAsync = promisify(packageCompass);
const cleanCompileCacheAsync = promisify(cleanCompileCache);
const createCompileCacheAsync = promisify(createCompileCache);
const createPackagedStylesAsync = promisify(createPackagedStyles);

const COMPASS_PATH = path.dirname(
  require.resolve('mongodb-compass/package.json')
);

const LOG_PATH = path.resolve(__dirname, '..', '.log');

function getAtlasConnectionOptions() {
  const missingKeys = [
    'E2E_TESTS_ATLAS_HOST',
    'E2E_TESTS_ATLAS_USERNAME',
    'E2E_TESTS_ATLAS_PASSWORD',
  ].filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    const keysStr = missingKeys.join(', ');
    if (process.env.ci || process.env.CI) {
      throw new Error(`Missing required environmental variable(s): ${keysStr}`);
    }
    return null;
  }

  const {
    E2E_TESTS_ATLAS_HOST: host,
    E2E_TESTS_ATLAS_USERNAME: username,
    E2E_TESTS_ATLAS_PASSWORD: password,
  } = process.env;

  return { host, username, password, srvRecord: true };
}

// For the tmpdirs
let i = 0;
// For the screenshots
let j = 0;
// For the html
let k = 0;

/**
 * @param {boolean} testPackagedApp Should compass start from the packaged binary or just from the source (defaults to source)
 * @param {Partial<import('spectron').AppConstructorOptions>} opts
 * @returns {Promise<ExtendedApplication>}
 */
async function startCompass(
  testPackagedApp = ['1', 'true'].includes(process.env.TEST_PACKAGED_APP),
  opts = {}
) {
  /** @type {string} */
  // When imported not from electron env, require('electron') actually returns a
  // path to the binary, it's just not typed like that
  // @ts-expect-error
  const electronPath = require('electron');

  /** @type {import('spectron').AppConstructorOptions} */
  const applicationStartOptions = !testPackagedApp
    ? {
        path: electronPath,
        args: [COMPASS_PATH],
        cwd: COMPASS_PATH,
      }
    : { path: getCompassBinPath(await getCompassBuildMetadata()) };

  const userDataDir = path.join(
    os.tmpdir(),
    `user-data-dir-${Date.now().toString(32)}-${++i}`
  );
  await fs.mkdir(userDataDir, { recursive: true });

  const appOptions = {
    ...opts,
    ...applicationStartOptions,
    chromeDriverArgs: [
      `--user-data-dir=${userDataDir}`,
      // Chromecast feature that is enabled by default in some chrome versions
      // and breaks the app on Ubuntu
      '--media-router=0',
      // Evergren RHEL ci runs everything as root, and chrome will not start as
      // root without this flag
      '--no-sandbox',
    ],
    env: {
      APP_ENV: 'spectron',
      DEBUG: `${process.env.DEBUG || ''},mongodb-compass:main:logging`,
      HOME: userDataDir,
    },
  };

  const shouldStoreAppLogs = process.env.ci || process.env.CI;

  const nowFormatted = formattedDate();

  if (shouldStoreAppLogs) {
    const chromeDriverLogPath = path.join(
      LOG_PATH,
      `chromedriver.${nowFormatted}.log`
    );
    const webdriverLogPath = path.join(LOG_PATH, 'webdriver');

    // Chromedriver will fail if log path doesn't exist, webdriver doesn't care,
    // for consistency let's mkdir for both of them just in case
    await fs.mkdir(path.dirname(chromeDriverLogPath), { recursive: true });
    await fs.mkdir(path.dirname(webdriverLogPath), { recursive: true });

    appOptions.chromeDriverLogPath = chromeDriverLogPath;
    appOptions.webdriverLogPath = webdriverLogPath;
  }

  debug('Starting Spectron with the following configuration:');
  debug(JSON.stringify(appOptions, null, 2));

  /** @type {ExtendedApplication} */
  // It's missing methods that we will add in a moment
  // @ts-expect-error
  const app = new Application(appOptions);

  await app.start();

  addCommands(app);
  addDebugger(app);

  const _stop = app.stop.bind(app);

  app.stop = async () => {
    const mainLogs = await app.client.getMainProcessLogs();
    const renderLogs = await app.client.getRenderProcessLogs();

    if (shouldStoreAppLogs) {
      const mainLogPath = path.join(
        LOG_PATH,
        `electron-main.${nowFormatted}.log`
      );
      debug(`Writing application main process log to ${mainLogPath}`);
      await fs.writeFile(mainLogPath, mainLogs.join('\n'));

      const renderLogPath = path.join(
        LOG_PATH,
        `electron-render.${nowFormatted}.json`
      );
      debug(`Writing application render process log to ${renderLogPath}`);
      await fs.writeFile(renderLogPath, JSON.stringify(renderLogs, null, 2));
    }

    debug('Stopping Compass application');
    await _stop();

    const compassLog = await getCompassLog(mainLogs);
    if (shouldStoreAppLogs) {
      const compassLogPath = path.join(
        LOG_PATH,
        `compass-log.${nowFormatted}.log`
      );
      debug(`Writing Compass application log to ${compassLogPath}`);
      await fs.writeFile(compassLogPath, compassLog.raw);
    }
    app.compassLog = compassLog.structured;

    debug('Removing user data');
    try {
      await fs.rmdir(userDataDir, { recursive: true });
    } catch (e) {
      debug(
        `Failed to remove temporary user data directory at ${userDataDir}:`
      );
      debug(e);
    }

    // ERROR, CRITICAL and whatever unknown things might end up in the logs
    const errors = renderLogs.filter(
      (log) => !['DEBUG', 'INFO', 'WARNING'].includes(log.level)
    );
    if (errors.length) {
      console.error('Errors encountered during testing:');
      console.error(errors);

      // fail the tests
      const error = new Error(
        'Errors encountered in render process during testing'
      );
      error.errors = errors;
      throw error;
    }

    return app;
  };

  return app;
}

/**
 * @param {string[]} logs The main process console logs
 * @returns {Promise<any[]>}
 */
async function getCompassLog(logs) {
  const logOutputIndicatorMatch = logs
    .map((line) => line.match(/Writing log output to (?<filename>.+)$/))
    .find((match) => match);
  if (!logOutputIndicatorMatch) {
    debug('no log output indicator found!');
    return [];
  }

  const { filename } = logOutputIndicatorMatch.groups;
  debug('reading Compass application logs from', filename);
  const contents = await promisify(gunzip)(await fs.readFile(filename), {
    finishFlush: Z_SYNC_FLUSH,
  });
  return {
    raw: contents,
    structured: contents
      .toString()
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { unparsabableLine: line };
        }
      }),
  };
}

function formattedDate() {
  // Mimicking webdriver path with this for consistency
  return new Date().toISOString().replace(/:/g, '-').replace(/Z$/, '');
}

async function rebuildNativeModules(compassPath = COMPASS_PATH) {
  const {
    config: {
      hadron: { rebuild: rebuildConfig },
    },
  } = require(path.join(compassPath, 'package.json'));

  await rebuild({
    ...rebuildConfig,
    electronVersion: require('electron/package.json').version,
    buildPath: compassPath,
    // monorepo root, so that the root packages are also inspected
    projectRootPath: path.resolve(compassPath, '..', '..'),
  });
}

async function compileCompassAssets(compassPath = COMPASS_PATH) {
  const pkgJson = require(path.join(compassPath, 'package.json'));
  const {
    config: {
      hadron: { distributions: distConfig },
    },
  } = pkgJson;

  const buildTarget = {
    dir: compassPath,
    resourcesAppDir: compassPath,
    pkg: pkgJson,
    distribution:
      process.env.HADRON_DISTRIBUTION ||
      (distConfig && distConfig.default) ||
      'compass',
  };

  // @ts-ignore some weirdness from util-callbackify
  await cleanCompileCacheAsync(buildTarget);
  await createCompileCacheAsync(buildTarget);
  await createPackagedStylesAsync(buildTarget);
}

async function getCompassBuildMetadata() {
  try {
    const metadata = require('mongodb-compass/dist/target.json');
    // Double-checking that Compass app path exists, not only the metadata
    fs.stat(metadata.appPath);
    return metadata;
  } catch (e) {
    throw new Error(
      "Compass package metadata doesn't exist. Make sure you built Compass before running e2e tests"
    );
  }
}

async function buildCompass(force = false, compassPath = COMPASS_PATH) {
  if (!force) {
    try {
      await getCompassBuildMetadata();
      return;
    } catch (e) {
      // No compass build found, let's build it
    }
  }

  await packageCompassAsync({
    dir: compassPath,
    skip_installer: true,
  });
}

function getCompassBinPath({ appPath, packagerOptions: { name } }) {
  switch (process.platform) {
    case 'win32':
      return path.join(appPath, `${name}.exe`);
    case 'linux':
      return path.join(appPath, name);
    case 'darwin':
      return path.join(appPath, 'Contents', 'MacOS', name);
    default:
      throw new Error(
        `Unsupported platform: don't know where the app binary is for ${process.platform}`
      );
  }
}

/**
 * @param {ExtendedApplication} app
 */
function addDebugger(app) {
  const debugClient = debug.extend('webdriver:client');
  // @ts-expect-error getPrototype is not typed in spectron or webdriver but
  // exists
  const clientProto = app.client.getPrototype();
  for (const prop of Object.getOwnPropertyNames(clientProto)) {
    if (prop.includes('.')) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(clientProto, prop);
    if (typeof descriptor.value !== 'function') {
      continue;
    }
    const origFn = descriptor.value;
    /**
     * @param  {any[]} args
     */
    descriptor.value = function (...args) {
      debugClient(
        `${prop}(${args
          .map((arg) => inspect(arg, { breakLength: Infinity }))
          .join(', ')})`
      );

      const stack = new Error(prop).stack;

      let result;
      try {
        result = origFn.call(this, ...args);
      } catch (error) {
        // In this case the method threw synchronously
        augmentError(error, stack);
        throw error;
      }

      if (result && result.then) {
        // If the result looks like a promise, resolve it and look for errors
        return result.catch((error) => {
          augmentError(error, stack);
          throw error;
        });
      }

      // return the synchronous result
      return result;
    };
    Object.defineProperty(clientProto, prop, descriptor);
  }
}

function augmentError(error, stack) {
  const lines = stack.split('\n');
  const strippedLines = lines.filter((line, index) => {
    // try to only contain lines that originated in this workspace
    if (index === 0) {
      return true;
    }
    if (line.startsWith('    at augmentError')) {
      return false;
    }
    if (line.startsWith('    at Object.descriptor.value [as')) {
      return false;
    }
    if (line.includes('node_modules')) {
      return false;
    }
    if (line.includes('helpers/')) {
      return true;
    }
    if (line.includes('tests/')) {
      return true;
    }
    return false;
  });

  if (strippedLines.length === 1) {
    return;
  }

  error.stack = `${error.stack}\nvia ${strippedLines.join('\n')}`;
}

/**
 * @param {ExtendedApplication} app
 * @param {string} imgPathName
 */
async function capturePage(
  app,
  imgPathName = `screenshot-${formattedDate()}-${++j}.png`
) {
  try {
    const buffer = await app.browserWindow.capturePage();
    await fs.mkdir(LOG_PATH, { recursive: true });
    // @ts-expect-error buffer is Electron.NativeImage not a real buffer, but it
    //                  can be used as a buffer when storing an image
    await fs.writeFile(path.join(LOG_PATH, imgPathName), buffer);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * @param {ExtendedApplication} app
 * @param {string} htmlPathName
 */
async function savePage(
  app,
  htmlPathName = `page-${formattedDate()}-${++k}.html`
) {
  try {
    await app.webContents.savePage(
      path.join(LOG_PATH, htmlPathName),
      'HTMLComplete'
    );
    return true;
  } catch (err) {
    return false;
  }
}

async function beforeTests() {
  const keychain = createUnlockedKeychain();
  keychain.activate();
  const compass = await startCompass();

  const { client } = compass;

  // XXX: This seems to be a bit unstable in GitHub CI on macOS machines, for
  // that reason we want to do a few retries here (in most other cases this
  // should pass on first attempt)
  await retryWithBackoff(async () => {
    await client.waitForConnectionScreen();
    await client.closeTourModal();
    await client.closePrivacySettingsModal();
  });

  return { keychain, compass };
}

async function afterTests({ keychain, compass }) {
  try {
    if (compass) {
      if (process.env.CI) {
        await capturePage(compass);
        await savePage(compass);
      }

      await compass.stop();
      compass = null;
    }
  } finally {
    if (keychain) {
      keychain.reset();
    }
  }
}

function pathName(text) {
  return text
    .replace(/ /g, '-') // spaces to dashes
    .replace(/[^a-z0-9-_]/gi, ''); // strip everything non-ascii (for now)
}

function screenshotPathName(text) {
  return `screenshot-${pathName(text)}.png`;
}

function pagePathName(text) {
  return `page-${pathName(text)}.html`;
}

async function afterTest(compass, test) {
  if (test.state == 'failed') {
    await capturePage(compass, screenshotPathName(test.fullTitle()));
    await savePage(compass, pagePathName(test.fullTitle()));
  }
}

module.exports = {
  startCompass,
  rebuildNativeModules,
  compileCompassAssets,
  getCompassBuildMetadata,
  getCompassBinPath,
  getAtlasConnectionOptions,
  buildCompass,
  capturePage,
  savePage,
  Selectors,
  COMPASS_PATH,
  LOG_PATH,
  beforeTests,
  afterTests,
  screenshotPathName,
  pagePathName,
  afterTest,
};