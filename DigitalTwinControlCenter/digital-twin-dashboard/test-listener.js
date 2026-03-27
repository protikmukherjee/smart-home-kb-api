import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

const app = initializeApp({
  databaseURL: "https://smart-fire-system-684fb-default-rtdb.firebaseio.com"
});

const db = getDatabase(app);
const notifRef = ref(db, "notifications");

console.log("Listening for Firebase notifications...");
onValue(notifRef, (snapshot) => {
  console.log("RECEIVED PAYLOAD:");
  console.log(JSON.stringify(snapshot.val(), null, 2));
  process.exit(0);
});
