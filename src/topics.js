import moment from "moment";
import { FLARUM_DB_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, asyncForEach, formatText, sqlEscape, slugify } from "./utils";

export const migrateTopics = async (phpbbConnection, flarumConnection) => {

  console.log(`Migrating Topics`);

  const topics = await query(phpbbConnection, `
    SELECT topic_id, topic_poster, forum_id, topic_title, topic_time
    FROM ${PHPBB_DB_PREFIX}topics
    ORDER BY topic_id DESC;
  `);

  console.log(`Found ${topics.length} entries`);

  let migratedTopics = 0;
  let migratedPosts = 0;
  let deletedPosts = 0;

  const failedTopics = [];
  const failedLinks = [];
  const failedPosts = [];

  await asyncForEach(topics, async (topic) => {
    const { topic_id, topic_title, topic_time, topic_poster, forum_id } = topic;

    const participants = [];
    let lastPosterID = 0;

    const posts = await query(phpbbConnection, `
      SELECT * FROM ${PHPBB_DB_PREFIX}posts WHERE topic_id = '${parseInt(topic_id)}'
    `);

    if (posts.length === 0 || (posts.length === 1 && posts[0].post_delete_time > 0))
      return;

    await asyncForEach(posts, async (post, index) => {

      const { post_id, post_time, post_text, poster_id, post_delete_time } = post;

      if (!!post_delete_time)
        return deletedPosts++;

      const posterId = poster_id === 1 ? 99999999 : poster_id;
      const postDate = moment.unix(post_time).utc().format('YYYY-MM-DD HH:mm:ss');
      const postText = sqlEscape(formatText(post_text));

      if (!participants.includes(posterId))
        participants.push(posterId)

      if (index === posts.length)
        lastPosterID = posterId;

      try {

        const result = await query(flarumConnection, `
           INSERT INTO ${FLARUM_DB_PREFIX}posts (id, user_id, discussion_id, created_at, type, content)
           VALUES ('${post_id}', '${posterId}', '${topic_id}', '${postDate}', 'comment', '${postText}')`
        );

        if (!result)
          failedPosts.push({ post_id, topic_id, posterId });
        else
          migratedPosts++;

      } catch (error) {
        failedPosts.push({ post_id, topic_id, posterId, error: error.message });
      }
    });

    const date = moment.unix(topic_time).utc().format('YYYY-MM-DD hh:mm:ss');

    // Linka il topic al tag

    try {
      await query(flarumConnection, `
        INSERT INTO ${FLARUM_DB_PREFIX}discussion_tag (discussion_id, tag_id)
        VALUES('${topic_id}', '${forum_id}')`
      );

    } catch (error) {
      failedLinks.push({ topic: topic_id, tag: forum_id, reason: error?.sqlMessage, error: error.message })
    }

    // Link il topic anche al parent del tag (se presente)

    const parents = await query(phpbbConnection,
      `SELECT parent_id FROM ${PHPBB_DB_PREFIX}forums WHERE forum_id = '${forum_id}'`);

    await asyncForEach(parents, async (parent) => {
      const { parent_id } = parent;

      try {
        await query(flarumConnection, `
          INSERT INTO ${FLARUM_DB_PREFIX}discussion_tag (discussion_id, tag_id)
          VALUES('${topic_id}', '${parent_id}')`
        );

      } catch (error) {
        console.log(`Topic parent linking error: ${error?.sqlMessage}`);
        console.log(error?.sqlMessage);
      }
    });

    if (lastPosterID == 0)
      lastPosterID = topic_poster;

    const title = sqlEscape(formatText(topic_title));
    const slug = slugify(topic_title);

    try {
      const result = await query(flarumConnection, `
        INSERT INTO ${FLARUM_DB_PREFIX}discussions (id, title, slug, created_at, comment_count, participant_count, first_post_id, last_post_id, user_id, last_posted_user_id, last_posted_at)
        VALUES('${topic_id}', '${title}', '${slug}', '${date}', '${posts.length}', '${participants.length}', 1, 1, '${topic_poster}', '${lastPosterID}', '${date}')
      `);

      if (result) migratedTopics++;
      else failedTopics.push({ ...topic });

    } catch (error) {
      failedTopics.push({ ...topic, error: error.message });
    }
  });

  console.log(`Migrated ${migratedTopics} topics with ${migratedPosts} posts. Ignored deleted posts (${deletedPosts})`);

  if (failedTopics.length > 0) {
    console.log("Failed Topics:");
    console.table(failedTopics);
  }

  if (failedLinks.length > 0) {
    console.log("Failed Links:");
    console.table(failedLinks);
  }

  if (failedPosts.length > 0) {
    console.log("Failed Posts:");
    console.table(failedPosts);
  }
}

