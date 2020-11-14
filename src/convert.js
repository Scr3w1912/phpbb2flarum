import "core-js/stable";
import "regenerator-runtime/runtime";

import * as CryptoJS from "crypto-js";
import {
  connect,
  query,
  unixTimestamp,
  randomColor
} from "./utils";

// Configurazioni

const FLARUM_DB_NAME = "flarum";
const FLARUM_DB_PREFIX = "flarum";

const PHPBB_DB_NAME = "psiconauti";
const PHPBB_DB_PREFIX = "phpbb_";

const MYSQL_CONFIG = {
  host: "localhost",
  user: "root",
  password: "",
};

(async () => {
  try {

    // Connessioni

    const phpbbConnection = await connect({ ...MYSQL_CONFIG, database: PHPBB_DB_NAME }, PHPBB_DB_NAME);
    const flarumConnection = await connect({ ...MYSQL_CONFIG, database: FLARUM_DB_NAME }, FLARUM_DB_NAME);

    // Conversione tabelle

    await migrateUsers(phpbbConnection, flarumConnection);

    flarumConnection.end();
    phpbbConnection.end();

    process.exit();

  } catch (error) {
    console.log("")
    console.error(error?.message)
    console.error(error?.sqlMessage)

    process.exit()
  }
})();

export const migrateUsers = (phpbbConnection, flarumConnection) => new Promise(async resolve => {
  console.log(`Migrating users`);

  const users = await query(phpbbConnection, `SELECT user_id, from_unixtime(user_regdate) as user_regdate, username_clean, user_email FROM ${PHPBB_DB_PREFIX}users`)

  let ignoredUsers = 0;
  let migratedUsers = 0;
  let failedUsers = [];

  users.forEach(({ username_clean, user_id, user_regdate, user_email = null }) => {

    if (!user_email) {
      ignoredUsers++;
      return;
    }

    const password = CryptoJS.SHA1(CryptoJS.MD5(unixTimestamp()).toString()).toString();

    query(flarumConnection, `
      INSERT INTO ${FLARUM_DB_PREFIX}users (id, username, email, password, joined_at, is_email_confirmed)
      VALUES ('${user_id}', '${username_clean.replaceAll(" ", "")}', '${user_email}', '${password}', '${user_regdate}', 1)`
    ).then(result => {
      if (result) migratedUsers++;
      else failedUsers.push(entry);

    }).catch(error => {
      failedUsers.push(entry);
      console.log(error?.message);
    });
  });

  let interval = setInterval(() => {
    if (migratedUsers + ignoredUsers + failedUsers.length === users.length) {
      clearInterval(interval);
      console.log(`Users migration commplete`);
      console.log({ migratedUsers, ignoredUsers, failedUsers: failedUsers.length });
      resolve();
    }
  }, 500);
});

