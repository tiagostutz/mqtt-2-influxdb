const path = require("path");
const process = require("process");
const fs = require("fs");

const logger = require("../lib/logger.js");
const nconf = require("nconf");

const InfluxClient    = require("../lib/influx.js").InfluxClient;

const log = logger("app");

// ---

log.info("Application start");

// Configuration --------------------------------------------------------------

nconf
    .argv()
    .env()
    .defaults({config: 'config.ini'});

const configFile = path.resolve(process.cwd(), nconf.get("config"));

// check if config is accessible
fs.accessSync(configFile, fs.R_OK);

log.info("Config file: ", configFile);

nconf.file({ file: configFile, format: nconf.formats.ini });

nconf.required(['mqtt:host', 'influxdb:host']);

if (nconf.get("verbose")) {
    logger.level = logger.levels.trace;
} else {
    logger.level = logger.levels.info;
}

const influxClient = new InfluxClient(nconf.get("influxdb"))
influxClient.store("id", "topic", { name: 'perf', tags: { }, values: 	{ 'user.name': 'NILSON-JUNIOR\\nilso',
  'machine.name': 'NILSON-JUNIOR',
  'machine.ip': '192.168.0.14',
  'machine.mac': '025041000001',
  'analysis.timestamp': '27/06/2017 21:02:33',
  'analysis.processes.name': 'Calculadora',
  'analysis.processes.isActive': 'false' } } );
