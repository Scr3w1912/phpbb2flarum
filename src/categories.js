import { FLARUM_DB_PREFIX, PHPBB_DB_PREFIX } from "./convert";
import { query, randomColor, sqlEscape, slugify, stripTags, stripBBCode } from "./utils";

export const migrateCategories = (phpbbConnection, flarumConnection) => new Promise(async resolve => {

  console.log(`Converting Categories to tags`);

  const categories = await query(phpbbConnection, `
    SELECT forum_id, forum_name, forum_desc, parent_id
    FROM ${PHPBB_DB_PREFIX}forums
  `)

  let migratedCategories = 0;
  let failedCategories = [];

  categories.forEach((category, index) => {

    const { forum_id, forum_name, forum_desc, parent_id } = category;

    const slug = sqlEscape(slugify(forum_name));
    const name = sqlEscape(forum_name);
    const description = sqlEscape(stripTags(stripBBCode(forum_desc)));
    const color = randomColor();
    const position = index;

    query(flarumConnection, `
      INSERT INTO ${FLARUM_DB_PREFIX}tags (id, name, description, slug, color, position, parent_id)
      VALUES ( '${forum_id}', '${name}', '${description}', '${slug}', '${color}', '${position}', '${parent_id}')`

    ).then(() => {
      migratedCategories++;

    }).catch(() => {

      console.log(`Category '${name}' insert failed, trying update`);

      query(flarumConnection, `
        UPDATE ${FLARUM_DB_PREFIX}tags SET name = '${name}', description = '${description}', slug = '${slug}'
        WHERE id = '${forum_id}'`

      ).then(() => {
        migratedCategories++;

      }).catch(() => {
        failedCategories.push({ id: forum_id, name, slug });
      })
    });

  });

  let interval = setInterval(() => {
    if (!(migratedCategories + failedCategories.length === categories.length))
      return;

    clearInterval(interval);

    console.log("")
    console.log(`Migrated ${migratedCategories} categories`);
    if (failedCategories.length > 0) {
      console.logtable("Failed Categories");
      console.table({ failedCategories });
    }

    console.log("")

    resolve();

  }, 500);
});
