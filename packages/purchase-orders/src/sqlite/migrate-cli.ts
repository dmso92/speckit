import { closeDatabase, openDatabase } from "./connection.js";

const database = openDatabase();
closeDatabase(database);
console.log("Purchase-order SQLite migrations are current.");
