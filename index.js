/**
 * A utility script allows one to run batch updates in the background on MySQL (either updates, inserts or deletes).
 * This avoids long-running table level locks. Configure the connection and parameters below.
 * 
 * Configure the:
 * 	- connection (MySQL connection details, can be hard coded or passed in as env params)
 * - batchSize (how many records to process in each batch)
 * - starting id (leave as 0 to process all data)
 * - query: the query to select the data to process
 * - command: the query to process the data (insert it, update it, delete it etc)
 */

const mysql = require("./mysql");
const fs = require("fs");
const readline = require("readline");
const dotenv = require("dotenv");
dotenv.config();

const connection = {
    host: process.env.mysql_host || "localhost",
    user: process.env.mysql_user || "",
    password: process.env.mysql_password || "",
    database: process.env.mysql_database || "",
    multipleStatements: true,
    timezone: "+00:00"
};

const maxReconnectionAttempts = process.env.max_reconnection_attempts || 3;
const reconnectTimeoutMs = (process.env.reconnect_timeout_seconds || 3) * 1000;
const currentPositionFilePath = "./position.json";
const batchSize = process.env.batch_size || 1;
let currentId = fetchCurrentId();
let id = currentId || process.env.start_id || 0;

const query = process.env.sql_query || `
        select id as id
        from source_table
        where id > :id
        order by id
        limit :batchSize`;

const command = process.env.sql_command || `
	insert into destination_table
	select * from source_table
	where id in (:ids);
`;

const log = function(msg, ...args){ console.log((new Date().toISOString()) + ': [INFO] '+  msg, ...args);};
const logError = function(msg, ...args) { console.error((new Date().toISOString()) + ': [ERROR] ' + msg, ...args)};

// -------------------------------------------------------------------------------------------------------------
mysql.init(connection);
let rowCount = 0;
let consecutiveReconnectCount = 0;

/**
 * Processes the array of identifiers retrieved by the fetch statement
 * @param {array} data
 */
async function processUpdatesFor(data) {
    const ids = data.map(x => x.id);
    const minId = ids[0];
    const [maxId] = ids.slice(-1);
    log('   Processing batch for ids %s → %s', minId, maxId)
    await mysql.query(command, { ids: ids});
    id = maxId;
    rowCount += ids.length;
    log('   Processed batch, row count: %s', rowCount);
}

/**
 * Fetches the data to be processed in a batch
 */
async function fetchData(){
    log('Fetching batch with id > %s', id);
    try {
        const results = await mysql.query(query, {
                id: id,
                batchSize: batchSize
            });
        if (results.length === 0){
            log(`✅ Processed ${ rowCount } rows`);
            process.exit(0);
            return;
        }
        await processUpdatesFor(results);
        saveCurrentId();
        setImmediate(async () => await fetchData()); // avoids memory leaks with deep stack
        consecutiveReconnectCount = 0;
    } catch(err) {
        const shouldAttemptToReconnect = err.code === 'PROTOCOL_CONNECTION_LOST'
            && consecutiveReconnectCount < maxReconnectionAttempts;
        if (shouldAttemptToReconnect) {
            logError(`😣 Connection to MySQL was lost, trying again in ${ reconnectTimeoutMs / 1000 } seconds: ${err.toString()}`, err);
            setTimeout(() => {
                consecutiveReconnectCount++;
                log('Connection attempt #%s', consecutiveReconnectCount);
                fetchData();
            }, reconnectTimeoutMs);
            return;
        }
        logError(`❌ Error executing process: ${err.toString()}`, err);
        process.exit(-1);
    }
}

function fetchCurrentId() {
    const raw = fs.readFileSync(currentPositionFilePath);
    if (!raw || raw.length === 0) {
        return 0;
    }
    const data = JSON.parse(raw);
    return data.id || 0;
}

function saveCurrentId() {
    const data = {
        id: id,
    };
    const text = JSON.stringify(data);
    fs.writeFileSync(currentPositionFilePath, text);
}

const confirm = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const output = [];
output.push('mysql.host: ' + connection.host);
output.push('mysql.user: ' + connection.user);
output.push('mysql.database: ' + connection.database);
output.push('config.batchSize: ' + batchSize);
output.push('config.startId: ' + id);
output.push('-----------------------');
output.push('query: ' + query);
output.push('');
output.push('command:' + command);
output.push('');
output.push('Reply y to start: ');

(async () => {
    if (process.argv[2] === 'f') {
        await fetchData();
        return;
    }
    confirm.question(`Are you sure you want to run the batch process with the following configuration: \r\n\r\n` + output.join('\r\n'), function(answer){
        if (answer.toLowerCase() === 'y'){
            fetchData();
        }
        else {
            log('Aborted!');
            process.exit(0);
        }
    });
})();