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

export const sqlEscape = (string) =>
  (typeof string === 'string' || string instanceof String) ?
    string
      .replaceAll("\\", "\\\\")
      .replaceAll("\0", "\\0")
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "\\r")
      .replaceAll("\'", "\\'")
      .replaceAll('\"', '\\"')
      .replaceAll("\x1a", "\\Z")
    : string

// https://gist.github.com/hagemann/382adfc57adbd5af078dc93feef01fe1#file-slugify-js
export const slugify = (string) => {

  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')

  return string.toString().toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, '') // Trim - from end of text
}
