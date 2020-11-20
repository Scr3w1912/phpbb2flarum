import moment from "moment";
import { FLARUM_DB_PREFIX, PHPBB_AVATAR_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, unixTimestamp } from "./utils";

export const migrateUsers = (phpbbConnection, flarumConnection) => new Promise(async resolve => {
  console.log(`Migrating users`);

  const users = await query(phpbbConnection, `SELECT user_id, user_regdate, username, username_clean, user_avatar, user_email FROM ${PHPBB_DB_PREFIX}users`)

  console.log(`Found ${users.length} entries`);

  let ignoredUsers = 0;
  let migratedUsers = 0;
  let failedUsers = [];
  let modifiedUsers = []

  users.forEach((user) => {

    if (!user.user_email) {
      ignoredUsers++;
      return;
    }

    const { username_clean, user_id, user_regdate, user_avatar, user_email = null } = user;

    const formattedUsername = username_clean.replaceAll(" ", "");

    const password = unixTimestamp();

    let userAvatar = ""

    if (user_avatar.includes("http")) {
      if (user_avatar.length > 99)
        userAvatar = "";
    } else {
      userAvatar = PHPBB_AVATAR_PREFIX + user_avatar.substr(0, user_avatar.indexOf("_")) + "." + user_avatar.substr(user_avatar.lastIndexOf(".") + 1);
    }

    const discussions = await query(phpbbConnection, `
      SELECT * FROM ${PHPBB_DB_PREFIX}discussions_user WHERE user_id = '${parseInt(user_id)}'
    `);

    const comments = await query(phpbbConnection, `
      SELECT * FROM ${PHPBB_DB_PREFIX}posts WHERE user_id = '${parseInt(user_id)}'
    `);

    query(flarumConnection, `
      INSERT INTO ${FLARUM_DB_PREFIX}users (id, username, email, password, joined_at, is_email_confirmed, avatar_url, discussion_count, comment_count)
      VALUES ('${user_id}', '${formattedUsername}', '${user_email}', '${password}', '${moment.unix(user_regdate).format("YYYY-MM-DD hh:mm:ss")}', 1, '${userAvatar}', ${discussions.length}, ${comments.length})`

    ).then(() => {
      migratedUsers++;

    }).catch(() => {
      // Se fallisce significa che l'utenza è doppia, quindi riprova aggiungendo all'email l'id.
      // la scelta dell'utenza finale sarà dell'utene

      query(flarumConnection, `
        INSERT INTO ${FLARUM_DB_PREFIX}users (id, username, email, password, joined_at, is_email_confirmed, avatar_url)
        VALUES ('${user_id}', '${formattedUsername + "ID" + user_id}', '${user_email + "ID" + user_id}', '${password}', '${moment.unix(user_regdate).format("YYYY-MM-DD hh:mm:ss")}', 1, '${userAvatar}')`

      ).then(() => {
        migratedUsers++;
        modifiedUsers.push(user)

      }).catch((error) => {
        failedUsers.push({ user_id, username: formattedUsername, user_email, error: error.message });
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

    if (modifiedUsers.length > 0) {
      console.log("Modified Users: (added 'ID{user_id}' to username and email")
      console.table(modifiedUsers);
    }

    resolve();

  }, 500);
});
