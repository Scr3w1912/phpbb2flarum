import moment from "moment";
import { FLARUM_DB_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, asyncForEach, formatPost, sqlEscape, slugify } from "./utils";

export const migrateTopics = async (phpbbConnection, flarumConnection) => {

  console.log(`Migrating Topics`);

  const topics = await query(phpbbConnection, `
    SELECT topic_id, topic_poster, forum_id, topic_title, topic_time
    FROM ${PHPBB_DB_PREFIX}topics
    ORDER BY topic_id DESC;
  `);

  let migratedTopics = 0;
  let failedTopics = [];

  await asyncForEach(topics, async (topic) => {
    const { topic_id, topic_title, topic_time, topic_poster, forum_id } = topic;

    console.log(`  Migrating Topic: ${topic_id} ${topic_title}`);

    const participants = [];
    let lastPosterID = 0;

    const posts = await query(phpbbConnection, `
      SELECT * FROM ${PHPBB_DB_PREFIX}posts WHERE topic_id = '${parseInt(topic_id)}'
    `);

    let migratedPosts = 0;
    let failedPosts = [];

    await asyncForEach(posts, async (post, index) => {

      const { post_id, post_time, post_text, poster_id } = post;

      console.log({ poster_id });

      const postDate = moment.unix(post_time).format('YYYY-MM-DD hh:mm:ss');
      const postText = sqlEscape(formatPost(post_text));

      if (!participants.includes(poster_id))
        participants.push(poster_id)

      if (index === posts.length)
        lastPosterID = poster_id;

      try {

        const result = await query(flarumConnection, `
          INSERT INTO ${FLARUM_DB_PREFIX}posts (id, user_id, discussion_id, created_at, type, content)
          VALUES ('${post_id}', '${poster_id}', '${topic_id}', '${postDate}', 'comment', '${postText}')`
        );

        if (result) migratedPosts++;
        else failedPosts.push(post);

      } catch (err) {
        failedPosts.push(post);
      }
    });

    console.log(`  Topic Posts migration completed`);
    console.log({ migratedPosts, failedPosts: failedTopics.length });

    // Converti i topic nel formato di Flarum

    const date = moment.unix(topic_time).format('YYYY-MM-DD hh:mm:ss');

    // Linka il topic al tag

    try {
      await query(flarumConnection, `
        INSERT INTO ${FLARUM_DB_PREFIX}discussion_tag (discussion_id, tag_id)
        VALUES('${topic_id}', '${forum_id}')`
      );

    } catch (error) {
      console.log(`Failed linking topic '${topic_id}' to tag '${forum_id}'`);
      console.log(error?.sqlMessage);
    }

    // Controlla se abbiamo il parent

    const parentForum = await query(phpbbConnection,
      `SELECT parent_id FROM ${PHPBB_DB_PREFIX}forums WHERE forum_id = '${forum_id}'`);

    if (parentForum?.parent_id) {

      //$topicid = $topic["topic_id"];
      try {

        await query(flarumConnection, `
          INSERT INTO ${FLARUM_DB_PREFIX}discussion_tag (discussion_id, tag_id)
          VALUES('${topic_id}', '${parentForum.parent_id}')`
        );

      } catch (error) {
        console.log(`Topic parent linking error: ${error?.sqlMessage}`);
        console.log(error?.sqlMessage);
      }
    }

    if (lastPosterID == 0)
      lastPosterID = topic_poster;

    const slug = slugify(topic_title);

    try {
      const result = await query(flarumConnection, `
        INSERT INTO ${FLARUM_DB_PREFIX}discussions (id, title, slug, created_at, comment_count, participant_count, first_post_id, last_post_id, user_id, last_posted_user_id, last_posted_at)
        VALUES('${topic_id}', '${sqlEscape(topic_title)}', '${slug}', '${date}', '${posts.length}', '${participants.length}', 1, 1, '${topic_poster}', '${lastPosterID}', '${date}')
      `);

      if (result) migratedTopics++;
      else failedTopics.push(topic);

    } catch (err) {
      failedTopics.push(topic);
    }

  });

  console.log("")
  console.log(`Topics migration completed`);
  console.log({ migratedTopics, failedTopics: failedTopics.length });

}

