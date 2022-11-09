 A utility script allows one to run batch updates in the background on MySQL (either updates, inserts or deletes). This avoids long running table level locks. Configure the connection and parameters below.

 ### Settings things up

Install the `mysql2` dependency:

 ```bash
 npm install
 ```

 Configure the following parameters in `index.js`:

 * `connection`: MySQL connection details, can be hard coded or passed in as env params
 * `batchSize`: how many records to process in each batch
 * `id`: starting id (leave as 0 to process all data)
 * `query`: the query to select/generate the data to process
 * `command`: the query to process the data (insert it, update it, delete it etc)

 If you want to avoid editing the script and hardcoding values, you can set the following env vars:

 * mysql_host
 * mysql_password
 * mysql_user
 * mysql_database
 * batch_size
 * start_id
 * sql_query
 * sql_command

 ### Running the script

 ```
 npm start
 ```