import { FLARUM_DB_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, asyncForEach } from "./utils";

export const migrateDiscussions = async (phpbbConnection, flarumConnection) => {
  console.log(`Migrating discussions`);

  const discussions = await query(phpbbConnection, `SELECT user_id, topic_id FROM ${PHPBB_DB_PREFIX}topics_posted`);

  let migratedDiscussions = 0;
  let failedDiscussions = [];

  await asyncForEach(discussions, async (discussion) => {

    const { user_id, topic_id } = discussion;

    try {
      const result = await query(flarumConnection, `
        INSERT INTO ${FLARUM_DB_PREFIX}discussion_user (user_id, discussion_id)
        VALUES ('${user_id}', '${topic_id}')
      `);

      if (result) migratedDiscussions++;
      else failedDiscussions.push(discussion);

    } catch (err) {
      failedDiscussions.push(discussion);
    }
  });

  console.log(`Migrated ${migratedDiscussions} discussions`);
  if (failedDiscussions.length > 0) {
    console.log("Failed Discussions");
    console.table({ failedDiscussions });
  }
}
