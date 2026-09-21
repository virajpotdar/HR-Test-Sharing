export function evaluateSession(session, questions) {
  let score = 0;

  for (const q of questions) {
    const ans = session.answers?.[q.qid];
    
    // Safety check: if no answer, skip
    if (ans === undefined || ans === null || ans === "") continue;

    const marks = Number(q.marks || 0);
    const negative = Number(q.negative || 0);

    /* ---------- MCQ SINGLE ---------- */
    if (q.type === "mcq_single") {
      const studentAns = String(Array.isArray(ans) ? ans[0] : ans).trim().toLowerCase();
      const correctAns = String(Array.isArray(q.correct) ? q.correct[0] : q.correct).trim().toLowerCase();

      if (studentAns === correctAns) score += marks;
      else score -= negative;
    }

    /* ---------- MCQ MULTI ---------- */
    else if (q.type === "mcq_multi") {
      const safeAns = Array.isArray(ans) ? ans : [ans];
      const safeCorrect = Array.isArray(q.correct) ? q.correct : [q.correct];
      
      const correctSet = new Set(safeCorrect.map(a => String(a).trim().toLowerCase()));
      const answerSet = new Set(safeAns.map(a => String(a).trim().toLowerCase()));

      const isExact =
        correctSet.size === answerSet.size &&
        [...correctSet].every(x => answerSet.has(x));

      if (isExact) score += marks;
      else score -= negative;
    }

    /* ---------- SHORT ANSWER ---------- */
    else if (q.type === "short") {
      const studentAnswer = String(ans).trim().toLowerCase();
      const correctAnswers = (Array.isArray(q.correct) ? q.correct : [q.correct])
        .map(a => String(a).trim().toLowerCase());

      if (correctAnswers.includes(studentAnswer)) score += marks;
      else score -= negative;
    }

    /* ---------- CODE / DEBUGGER ---------- */
    else if (q.type === "code") {
      const studentCode = String(ans).trim();
      
      // Keywords are usually stored in q.correct as an array or comma-separated string
      const keywords = (Array.isArray(q.correct) ? q.correct : String(q.correct).split(","))
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (keywords.length === 0) {
        // If no keywords, any non-empty answer might get marks? 
        // Or maybe it's an exact match skip. Let's assume keywords are required.
        score += marks; 
      } else {
        const allMatch = keywords.every(kw => 
          studentCode.toLowerCase().includes(kw.toLowerCase())
        );

        if (allMatch) score += marks;
        else score -= negative;
      }
    }
  }

  return Math.max(score, 0);
}