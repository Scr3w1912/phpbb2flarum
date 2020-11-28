import * as mysql from "mysql";
import { debugQuery } from "./convert";

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

  try {
    connection.query(sql, (error, results) => {
      if (error) {

        if (debugQuery) {
          console.error("\nQuery failed:")
          console.error(error?.message)
          console.error(sql)
        }
        reject(error);

      } else {
        resolve(results);
      }
    });
  } catch (error) {
    reject(error)
  }
});

export const unixTimestamp = () => Math.round((new Date()).getTime() / 1000);

export const stripTags = (string) => string.replace(/(<([^>]+)>)/gi, "");

export const stripBBCode = (string) => string.replace(/\[(\w+)[^w]*?](.*?)\[\/\1]/g, '$2');

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

  return string
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, '') // Trim - from end of text
}

// Formatta  la sintassi dei post di PHPBB nel formato che usa Flarum
export const formatText = (text) => {

  const post = convertBBCodeToHTML(text)
    // Rimuovi tutti i simboli che non ci servono
    .replace(/#\:\w+#/g, "") // Rimuove le faccine
    .replaceAll("&quot;", '\"') // Sostituisce le virgolette
    .replaceAll("&apos;", '\'') // Sostituisce gli apostrofi
    .replace(/[[\/\!]*?[^\[\]]*?]/gsi, "") // Rimuove tutto quello incapsulato in parentesi quadre
    .replaceAll("\n", "")

  // Ingloba i newline in paragrafi
  //.split("\n")
  //.map(piece => piece.length > 1 ? `<p>${piece}</p>` : piece)
  //.join(" ");

  // i posts con le citazioni diventano richtext
  // const tag = post.includes("&gt;") ? "r" : "t";
  // return `<${tag}>${post}<${tag}>`;

  return post
}

export const convertBBCodeToHTML = (string) =>
  string
    .replace(/\[b](.+)\[\/b]/g, "<b>$1</b>")
    .replace(/\[i](.+)\[\/i]/g, "<i>$1</i>")
    .replace(/\[u](.+)\[\/u]/g, "<u>$1</u>")
    .replace(/\[img](.+?)\[\/img]/gis, "<img src='$1'\>")
    .replace(/\[quote=(.+?)](.+?)\[\/quote]/gis, "<QUOTE><i>&gt;</i>$2</QUOTE>")
    .replace(/\[code:\w+](.+?)\[\/code:\w+]/gis, "<CODE class='hljs'>$1<CODE>")
    .replace(/\[pre](.+?)\[\/pre]/gis, "<code>$1<code>")
    .replace(/\[u](.+)\[\/u]/g, "<u>$1</u>")
    .replace(/\[\*](.+?)\[\/\*]/gis, "<li>$1</li>")
    .replace(/\[color=\#\w+](.+?)\[\/color]/gis, "$1")
    .replace(/\[url=(.+?)](.+?)\[\/url]/gis, "<a href='$1'>$2</a>")
    .replace(/\[url](.+?)\[\/url]/gis, "<a href='$1'>$1</a>")
    .replace(/\[list](.+?)\[\/list]/gis, "<ul>$1</ul>")
    .replace(/\[size=200](.+?)\[\/size]/gis, "<h1>$1</h1>")
    .replace(/\[size=170](.+?)\[\/size]/gis, "<h2>$1</h2>")
    .replace(/\[size=150](.+?)\[\/size]/gis, "<h3>$1</h3>")
    .replace(/\[size=120](.+?)\[\/size]/gis, "<h4>$1</h4>")
    .replace(/\[size=85](.+?)\[\/size]/gis, "<h5>$1</h5>")

export const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

export const randomColor = () => {
  const tagColors = [
    "#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3", "#03A9F4", "#00BCD4", "#009688",
    "#4CAF50", "#8BC34A", "#CDDC39", "#FFC107", "#FF9800", "#FF5722", "#795548", "#607D8BF", "#374046",
  ];

  return tagColors[Math.round(Math.random() * tagColors.length)]
}
