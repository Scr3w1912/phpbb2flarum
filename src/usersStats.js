import { FLARUM_DB_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, asyncForEach } from "./utils";

export const migrateUsersStats = async (phpbbConnection, flarumConnection) => {
  console.log(`Migrating User Stats`);

  const users = await query(phpbbConnection, `SELECT user_id FROM ${PHPBB_DB_PREFIX}users`)

  let migratedStats = 0;
  let failedStats = [];

  await asyncForEach(users, async ({ user_id }) => {

    const discussions = await query(flarumConnection, `
      SELECT * FROM ${FLARUM_DB_PREFIX}discussion_user WHERE user_id = '${parseInt(user_id)}'
    `);

    const comments = await query(flarumConnection, `
      SELECT * FROM ${FLARUM_DB_PREFIX}posts WHERE user_id = '${parseInt(user_id)}'
    `);

    try {

      await query(flarumConnection, `
        UPDATE ${FLARUM_DB_PREFIX}users
        SET discussion_count = '${discussions.length}', comment_count = '${comments.length}'
        WHERE id = '${user_id}'
      `);

      migratedStats++;

    } catch (error) {
      failedStats.push({ ...user_id, error: error.message });
    }
  });

  console.log(`Migrated ${migratedStats} Stats`);
  if (failedStats.length > 0) {
    console.log("Failed Stats");
    console.table(failedStats);
  }
}
