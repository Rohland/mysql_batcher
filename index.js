/**
 * A utility script allows one to run batch updates in the background on MySQL (either updates, inserts or deletes).
 * This avoids long running table level locks. Configure the connection and parameters below.
 * 
 * Configure the:
 * 	- connection (MySQL connection details, can be hard coded or passed in as env params)
 * - batchSize (how many records to process in each batch)
 * - starting id (leave as 0 to process all data)
 * - query: the query to select the data to process
 * - command: the query to process the data (insert it, update it, delete it etc)
 */

const mysql = require('./mysql');
const fs = require('fs');
const readline = require('readline');

const connection = {
    host: process.env.mysql_host || "localhost",
    user: process.env.mysql_user || "",
    password: process.env.mysql_password || "",
    database: process.env.mysql_database || "",
    multipleStatements: true,
    timezone: "+00:00"
};

const batchSize = process.env.batch_size || 1;
let id = process.env.start_id || 0;

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
};

/**
 * Fetches the data to be process in a batch
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
        setImmediate(async () => await fetchData()); // avoids memory leaks with deep stack
    } catch(err) {
        logError(`❌ Error executing process: ${err.toString()}`, err);
        process.exit(-1);
    }
};

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
        fetchData();
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