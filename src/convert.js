import "core-js/stable";
import "regenerator-runtime/runtime";

import { connect, query } from "./utils";
import { migrateCategories } from "./categories";
import { migrateTopics } from "./topics";
import { migrateUsers } from "./users";
import { migrateDiscussions } from "./discussions";
import { migrateUsersStats } from "./usersStats";

// Configurazioni

export const debugQuery = false;

export const FLARUM_DB_NAME = "flarum1";
export const FLARUM_DB_PREFIX = "flarum_";
export const PHPBB_DB_NAME = "psiconauti2";
export const PHPBB_DB_PREFIX = "phpbb_";
export const PHPBB_AVATAR_PREFIX = "gm6yzwjxa9q6l8g3lzobexpgawa5keu3_";

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

    await query(flarumConnection, `
      SET FOREIGN_KEY_CHECKS=0
    `);

    await migrateUsers(phpbbConnection, flarumConnection);
    await migrateCategories(phpbbConnection, flarumConnection);
    await migrateTopics(phpbbConnection, flarumConnection);
    await migrateDiscussions(phpbbConnection, flarumConnection);
    await migrateUsersStats(phpbbConnection, flarumConnection);

    flarumConnection.end();
    phpbbConnection.end();

    process.exit();

  } catch (error) {
    console.error(error?.message)
    process.exit()
  }
})();
