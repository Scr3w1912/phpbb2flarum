import moment from "moment";
import { FLARUM_DB_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, unixTimestamp } from "./utils";

export const migrateUsers = (phpbbConnection, flarumConnection) => new Promise(async resolve => {
  console.log(`Migrating users`);

  const users = await query(phpbbConnection, `SELECT user_id, user_regdate, username, username_clean, user_avatar, user_email FROM ${PHPBB_DB_PREFIX}users`)

  let ignoredUsers = 0;
  let migratedUsers = 0;
  let failedUsers = [];

  users.forEach((user) => {

    if (!user.user_email) {
      ignoredUsers++;
      return;
    }

    const { username, username_clean, user_id, user_regdate, user_avatar, user_email = null } = user;

    const formattedUsername = username
      ? username.replaceAll(" ", "")
      : username_clean.replaceAll(" ", "");

    const password = unixTimestamp();

    query(flarumConnection, `
      INSERT INTO ${FLARUM_DB_PREFIX}users (id, username, email, password, joined_at, is_email_confirmed, avatar_url)
      VALUES ('${user_id}', '${formattedUsername}', '${user_email}', '${password}', '${moment.unix(user_regdate).format("YYYY-MM-DD hh:mm:ss")}', 1, '${user_avatar}')`

    ).then(() => {
      migratedUsers++;

    }).catch(() => {
      // Se fallisce significa che l'utenza è doppia, quindi riprova aggiungendo all'email l'id.
      // la scelta dell'utenza finale sarà dell'utene

      query(flarumConnection, `
        INSERT INTO ${FLARUM_DB_PREFIX}users (id, username, email, password, joined_at, is_email_confirmed, avatar_url)
        VALUES ('${user_id}', '${formattedUsername}', '${user_email + user_id}', '${password}', '${moment.unix(user_regdate).format("YYYY-MM-DD hh:mm:ss")}', 1, '${user_avatar}')`

      ).then(() => {
        migratedUsers++;

      }).catch(() => {
        failedUsers.push({ user_id, username, user_email });
      });

    });
  });

  let interval = setInterval(() => {
    if (!(migratedUsers + ignoredUsers + failedUsers.length === users.length))
      return

    clearInterval(interval);

    console.log(`Migrated ${migratedUsers} users, ignored: ${ignoredUsers}`);
    if (failedUsers.length > 0) {
      console.log("Failed Users:")
      console.table(failedUsers);
    }

    resolve();

  }, 500);
});
