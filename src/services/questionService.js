import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export async function getQuestions(examId) {
  // 1. REMOVE 'orderBy' here. 
  // Firestore allows 'where' queries easily, but 'where' + 'orderBy' crashes without an index.
  const q = query(
    collection(db, "exam_questions"),
    where("examId", "==", examId)
  );

  const snap = await getDocs(q);
  
  const data = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      qid: d.qid,
      question: d.question,
      questionImg: d.questionImg,
      options: d.options,
      type: d.type,
      marks: d.marks,
      negative: d.negative,
      order: d.order // We need this field for the next step
    };
  });

  // 2. SORT HERE instead of in the database
  // This is safe, reliable, and requires no Firebase Console setup.
  data.sort((a, b) => (a.order || 0) - (b.order || 0));

  return data;
}