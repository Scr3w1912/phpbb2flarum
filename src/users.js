import moment from "moment";
import { FLARUM_DB_PREFIX, PHPBB_AVATAR_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { asyncForEach, query, unixTimestamp } from "./utils";

export const migrateUsers = async (phpbbConnection, flarumConnection) => {
  console.log(`Migrating users`);

  const users = await query(phpbbConnection, `SELECT user_id, user_regdate, username, username_clean, user_avatar, user_email FROM ${PHPBB_DB_PREFIX}users`)

  console.log(`Found ${users.length} entries`);

  let ignoredUsers = 0;
  let migratedUsers = 0;
  let failedUsers = [];
  let modifiedUsers = []

  await asyncForEach(users, async (user) => {

    if (!user.user_email) {
      ignoredUsers++;
      return;
    }

    const { username_clean, user_id, user_regdate, user_avatar, user_email = null } = user;

    const password = unixTimestamp();
    const registrationDate = moment.unix(user_regdate).format("YYYY-MM-DD hh:mm:ss");
    const username = username_clean.replaceAll(" ", "");
    let avatar = "";

    if (user_avatar.includes("http")) {
      if (user_avatar.length > 99)
        avatar = "";

    } else {
      const fileName = user_avatar.substr(0, user_avatar.indexOf("_"));
      const extension = user_avatar.substr(user_avatar.lastIndexOf(".") + 1);

      if (!fileName || fileName === "") avatar = "";
      else avatar = `${PHPBB_AVATAR_PREFIX}${fileName}.${extension}`;
    }

    try {
      await query(flarumConnection, `
        INSERT INTO ${FLARUM_DB_PREFIX}users (id, username, email, password, joined_at, is_email_confirmed, avatar_url)
        VALUES ('${user_id}', '${username}', '${user_email}', '${password}', '${registrationDate}', 1, '${avatar}')`
      );
      migratedUsers++;

    } catch (error) {

      try {
        await query(flarumConnection, `
          INSERT INTO ${FLARUM_DB_PREFIX}users (id, username, email, password, joined_at, is_email_confirmed, avatar_url)
          VALUES ('${user_id}', '${username + "_ID" + user_id}', '${user_email + "_ID" + user_id}', '${password}', '${registrationDate}', 1, '${avatar}')`
        );
        migratedUsers++;
        modifiedUsers.push(user)

      } catch (error) {
        failedUsers.push({ user_id, username: username, user_email, error: error.message });
      }
    }
  });

  console.log(`Migrated ${migratedUsers} users, ignored: ${ignoredUsers}`);
  if (failedUsers.length > 0) {
    console.log("Failed Users:")
    console.table(failedUsers);
  }

  if (modifiedUsers.length > 0) {
    console.log("Modified Users: (added 'ID{user_id}' to username and email")
    console.table(modifiedUsers);
  }
};
