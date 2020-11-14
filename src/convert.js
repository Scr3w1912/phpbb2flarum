import "core-js/stable";
import "regenerator-runtime/runtime";

import * as CryptoJS from "crypto-js";
import {
  connect,
  query,
  unixTimestamp,
  randomColor,
  sqlEscape,
  slugify
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

    //await migrateUsers(phpbbConnection, flarumConnection);
    await migrateCategories(phpbbConnection, flarumConnection);

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

  users.forEach((entry) => {

    if (!entry.user_email) {
      ignoredUsers++;
      return;
    }

    const { username_clean, user_id, user_regdate, user_email = null } = entry
    const username = username_clean.replaceAll(" ", "");
    const password = CryptoJS.SHA1(CryptoJS.MD5(unixTimestamp()).toString()).toString();

    query(flarumConnection, `
      INSERT INTO ${FLARUM_DB_PREFIX}users (id, username, email, password, joined_at, is_email_confirmed)
      VALUES ('${user_id}', '${username}', '${user_email}', '${password}', '${user_regdate}', 1)`

    ).then(() => {
      migratedUsers++;

    }).catch(error => {
      failedUsers.push(entry);
      console.log(error?.message);
    });
  });

  let interval = setInterval(() => {
    if (migratedUsers + ignoredUsers + failedUsers.length === users.length) {
      clearInterval(interval);
      console.log(`Users migration completed`);
      console.log({ migratedUsers, ignoredUsers, failedUsers: failedUsers.length });
      resolve();
    }
  }, 500);
});

export const migrateCategories = (phpbbConnection, flarumConnection) => new Promise(async resolve => {

  console.log(`Converting Categories to tags`);

  const categories = await query(phpbbConnection, `SELECT forum_id, forum_name, forum_desc  FROM ${PHPBB_DB_PREFIX}forums`)

  let migratedCategories = 0;
  let failedCategories = [];

  categories.forEach((entry, index) => {

    const { forum_id, forum_name, forum_desc } = entry;
    const position = index;
    const color = randomColor();
    const slug = sqlEscape(slugify(forum_name));

    query(flarumConnection, `
      INSERT INTO ${FLARUM_DB_PREFIX}tags (id, name, description, slug, color, position)
      VALUES ( '${forum_id}', '${forum_name}', '${forum_desc}', '${slug}', '${color}', '${position}')`

    ).then(() => {
      migratedCategories++;

    }).catch(() => {

      console.log(`Category '${forum_name}' insert failed, trying update`);

      query(flarumConnection, `
        UPDATE ${FLARUM_DB_PREFIX}tags SET name = '${forum_name}', description = '${forum_desc}', slug = '${slug}'
        WHERE id = '${forum_id}'`

      ).then(() => {
        migratedCategories++;

      }).catch(error => {
        failedCategories.push(entry);
        console.log(error?.message);
      })
    });

  });

  let interval = setInterval(() => {
    if (migratedCategories + failedCategories.length === categories.length) {
      clearInterval(interval);
      console.log(`Categories migration completed`);
      console.log({ migratedCategories, failedCategories: failedCategories.length });
      resolve();
    }
  }, 500);
});
