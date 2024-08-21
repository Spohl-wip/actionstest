const { createClient } = require("@sanity/client");
const fs = require("fs");

const filename = `backup-${new Date().toISOString()}.ndjson`;

const stagingClient = createClient({
  projectId: "n2r47ce3",
  dataset: "staging",
  token: process.env.SANITY_PROJECT_TOKEN,
  useCdn: false,
  apiVersion: "2023-05-03",
});

const productionClient = createClient({
  projectId: "n2r47ce3",
  dataset: "production",
  token: process.env.SANITY_PROJECT_TOKEN,
  useCdn: false,
  apiVersion: "2023-05-03",
});

async function migrateData() {
  try {
    const documents = await stagingClient.fetch('*[!(_id in path("_.**"))]');

    for (const doc of documents) {
      try {
        await productionClient.createOrReplace(doc);
        console.log(`Migrated document: ${doc._id}`);
      } catch (error) {
        console.error(`Error migrating document: ${doc._id}\n ERROR: `, error);
      }
    }
  } catch (error) {
    console.error("Error during migration:", error);
  }
}

// This function will save a backup of the production dataset
async function saveBackup() {
  try {
    const documents = await productionClient.fetch('*[!(_id in path("_.**"))]');

    // Save the documents to a file or cloud storage
    fs.writeFileSync(filename, JSON.stringify(documents, null, 2));
    console.log(`Backup saved to ${filename}`);
  } catch (error) {
    console.error("-----------------------------------");
    console.error("Error during backup:", error);
    console.error("-----------------------------------");
    console.error("Error: Backup failed, migration stopped");
    process.exit(1);
  }
}

async function loadBackup() {
  try {
    // see what backups are available and choose the newest one
    const backupFiles = fs.readdirSync("./");
    const backupFile = backupFiles
      .filter((file) => file.startsWith("backup-"))
      .sort()
      .reverse()[0];
    console.log("newest backup was: ", backupFile);
    const backupData = fs.readFileSync(backupFile, "utf8");
    const documents = JSON.parse(backupData);
    for (const doc of documents) {
      await stagingClient.createOrReplace(doc);
      console.log(`Migrated document: ${doc._id}`);
    }
    console.log("Backup loaded");
  } catch (error) {
    console.error("Error during migration:", error);
  }
}

saveBackup().then(() => {
  migrateData().catch((error) => {
    console.error("Error: Migration failed, backup was saved");
    process.exit(1);
  });
});
// TODO:
