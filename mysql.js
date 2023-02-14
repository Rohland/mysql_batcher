const mysql =  require('mysql2');

let source = null;
let config = null;

function queryFormatter(query, values) {
    if (!values) return query;
    return query.replace(/\:(\w+)/g, function (txt, key) {
        if (values.hasOwnProperty(key)) {
            const value = values[key];
            return Number.isInteger(parseInt(value))
                ? value
                : this.escape(value);
        }
        return txt;
    }.bind(this));
}

module.exports = {
    init: function(connection){
        config = connection;
        config.queryFormat ||= queryFormatter;
    },
    query: async function(query, parameters){
        source ||= mysql.createPool(config).promise();
        const results = await source.query(query, parameters);
        return results[0];
    }
};