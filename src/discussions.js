import { FLARUM_DB_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, asyncForEach } from "./utils";

export const migrateDiscussions = async (phpbbConnection, flarumConnection) => {
  console.log(`Migrating discussions`);

  // await query(phpbbConnection, `
  //   INSERT INTO ${PHPBB_DB_PREFIX}topics_posted (user_id, topic_id, topic_posted)
  //   SELECT DISTINCT 'poster_id', 'topic_id', '1' FROM '${PHPBB_DB_PREFIX}posts'
  // `);

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

      console.log(`Migrated discussion ${topic_id}`)

      if (result) migratedDiscussions++;
      else failedDiscussions.push(discussion);

    } catch (err) {
      failedDiscussions.push(discussion);
    }
  });

  console.log(`Discussions migration completed`);
  console.log({ migratedDiscussions, ignoredDiscussions, failedDiscussions: failedDiscussions.length });
}
