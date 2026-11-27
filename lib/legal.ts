/** Legal text shared by the signup agreement and the sign-in footer popup. */
export const LEGAL_SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Privacy Policy",
    body: [
      "LINC collects your school email, student number, username, and a hashed password so you can sign in. Passwords and recovery codes are never stored in readable form.",
      "Posts, comments, and reactions you make are visible to the LINC community under your username. Posts submitted anonymously are not linked to your account in the public feed.",
      "We use your information only to run LINC: authenticating you, showing your activity, sending in-app notifications, and moderating content. We do not sell your data or share it with third parties.",
      "You may update your username and profile picture in Settings. To request deletion of your account, contact the LINC administrators.",
    ],
  },
  {
    title: "Terms and Conditions",
    body: [
      "LINC is for current students of De La Salle Araneta University. You must register with your own @dlsau.edu.ph email and student number, and keep your login details and recovery code private.",
      "You are responsible for what you post. Do not post content that is unlawful, harassing, discriminatory, misleading, or that infringes on the privacy of others.",
      "The USC administrator may review, hide, or remove posts and may suspend accounts that violate these terms or university policy.",
      "Anonymous posting is a privilege for honest concerns. It does not exempt you from these terms, and abuse may lead to restrictions.",
      "These terms may be updated. Continued use of LINC after changes means you accept the updated terms.",
    ],
  },
];
