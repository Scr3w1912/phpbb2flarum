import * as mysql from "mysql";

export const connect = (config, name) => new Promise((resolve, reject) => {

  const connection = mysql.createConnection(config);

  connection.connect((error) => {
    if (error) {
      reject(error);

    } else {
      console.log(`Connection to "${name}" established`);
      resolve(connection);
    }
  });
});

export const query = (connection, sql) => new Promise((resolve, reject) => {

  connection.query(sql, (error, results) => {
    if (error) {
      reject(error);

    } else {
      resolve(results);
    }
  });
});


export const unixTimestamp = () => Math.round((new Date()).getTime() / 1000);

export const randomColor = () => Math.floor(Math.random() * 16777215).toString(16);
