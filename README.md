 A utility script allows one to run batch updates in the background on MySQL (either updates, inserts or deletes). This avoids long running table level locks. Configure the connection and parameters below.

 ### Settings things up

Install the dependencies

 ```bash
 npm install
 ```

 Configure the following parameters in `index.js`:

 * `connection`: MySQL connection details, can be hard coded or passed in as env params
 * `batchSize`: how many records to process in each batch
 * `id`: starting id (leave as 0 to process all data)
 * `query`: the query to select/generate the data to process
 * `command`: the query to process the data (insert it, update it, delete it etc)
 * `maxReconnectionAttempts`: the maximum number of consecutive reconnection attempts that will be made following a `PROTOCOL_CONNECTION_LOST` error before the process should give up

 If you want to avoid editing the script and hardcoding values, you can set the following env vars:

 * mysql_host
 * mysql_password
 * mysql_user
 * mysql_database
 * batch_size
 * start_id
 * sql_query
 * sql_command
 * max_reconnection_attempts
 * reconnect_timeout_seconds

 ### Running the script

 ```
 npm start
 ```