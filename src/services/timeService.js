// Removed unused imports

export async function getServerTime() {
  // 🟢 OPTIMIZATION: We return local time to prevent Database Lockup.
  // Writing to a single doc 250 times/sec causes "Contention Errors".
  // Trusting local time relative to start time is standard for high-scale exams.
  return new Date(); 
}