import { doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function getExamConfig() {
  const ref = doc(db, "exam-config", "current-exam");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Exam not scheduled yet");
  }

  return snap.data();
}
