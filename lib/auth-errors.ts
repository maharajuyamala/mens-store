import type { FirebaseError } from "firebase/app";

export function getAuthErrorMessage(error: unknown, fallback = "Something went wrong.") {
  const code = (error as FirebaseError)?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Pop-up was blocked. Allow pop-ups for this site.";
    case "auth/operation-not-allowed":
      return "Google sign-in is turned off for this project. In Firebase Console → Authentication → Sign-in method, enable Google, save, and add this site under Authorized domains.";
    default:
      return (error as FirebaseError)?.message || fallback;
  }
}
