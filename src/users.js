import { FLARUM_DB_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, unixTimestamp } from "./utils";

export const migrateUsers = (phpbbConnection, flarumConnection) => new Promise(async resolve => {
  console.log(`Migrating users`);

  const users = await query(phpbbConnection, `SELECT user_id, from_unixtime(user_regdate) as user_regdate, username_clean, user_email FROM ${PHPBB_DB_PREFIX}users`)

  let ignoredUsers = 0;
  let migratedUsers = 0;
  let failedUsers = [];

  users.forEach((user) => {

    if (!user.user_email) {
      ignoredUsers++;
      return;
    }

    const { username_clean, user_id, user_regdate, user_email = null } = user
    const username = username_clean.replaceAll(" ", "");
    const password = unixTimestamp();

    query(flarumConnection, `
      INSERT INTO ${FLARUM_DB_PREFIX}users (id, username, email, password, joined_at, is_email_confirmed)
      VALUES ('${user_id}', '${username}', '${user_email}', '${password}', '${user_regdate}', 1)`

    ).then(() => {
      migratedUsers++;

    }).catch(() => {
      failedUsers.push(user);
    });
  });

  let interval = setInterval(() => {
    if (!(migratedUsers + ignoredUsers + failedUsers.length === users.length))
      return

    clearInterval(interval);

    console.log(`Users migration completed`);
    console.log({ migratedUsers, ignoredUsers, failedUsers: failedUsers.length });
    console.log("")

    resolve();

  }, 500);
});
