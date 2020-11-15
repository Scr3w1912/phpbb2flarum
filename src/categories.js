import { FLARUM_DB_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, randomColor, sqlEscape, slugify, stripTags, stripBBCode } from "./utils";

export const migrateCategories = (phpbbConnection, flarumConnection) => new Promise(async resolve => {

  console.log(`Converting Categories to tags`);

  const categories = await query(phpbbConnection, `
    SELECT forum_id, forum_name, forum_desc, parent_id
    FROM ${PHPBB_DB_PREFIX}forums
  `);


  let migratedCategories = 0;
  let failedCategories = [];

  categories.forEach(async (category, index) => {

    const { forum_id, forum_name, forum_desc, parent_id } = category;

    const name = sqlEscape(forum_name);
    const description = sqlEscape(stripTags(stripBBCode(forum_desc)));
    const color = randomColor();
    const position = index;

    let slug = "";
    const slugs = [forum_name];

    const recursiveSlug = async (forumID) => {
      const tags = await query(phpbbConnection, `
        SELECT forum_name, parent_id
        FROM ${PHPBB_DB_PREFIX}forums
        WHERE forum_id = '${forumID}'
      `);

      tags.forEach(tag => {
        const { forum_name, parent_id } = tag;

        slugs.push(forum_name)
        if (parent_id > 0)
          recursiveSlug(parent_id)
      });
    }

    if (parent_id > 0)
      await recursiveSlug(parent_id);

    const formattedSlug = sqlEscape(slugify(slugs.reverse().join("-")));

    query(flarumConnection, `
      INSERT INTO ${FLARUM_DB_PREFIX}tags (id, name, description, slug, color, position, parent_id)
      VALUES ( '${forum_id}', '${name}', '${description}', '${formattedSlug}', '${color}', '${position}', '${parent_id}')`

    ).then(() => {
      migratedCategories++;

    }).catch(() => {
      failedCategories.push({ id: forum_id, name, slug: formattedSlug });
    });

  });

  let interval = setInterval(() => {
    if (!(migratedCategories + failedCategories.length === categories.length))
      return;

    clearInterval(interval);

    console.log("")
    console.log(`Migrated ${migratedCategories} categories`);
    if (failedCategories.length > 0) {
      console.log("Failed Categories");
      console.table(failedCategories);
    }

    console.log("")

    resolve();

  }, 500);
});
